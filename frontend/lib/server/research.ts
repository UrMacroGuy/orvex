/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import { getOptionalProviderKey } from "@/lib/server/auth";
import { decryptSecret, encryptSecret, maskKey } from "@/lib/server/crypto";
import { runModelCompletion } from "@/lib/server/providers/llm";
import {
  formatOpenWebContext,
  gatherOpenWebContext,
  type OpenWebContext,
} from "@/lib/server/providers/open-web";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  FinancialQuery,
  FinancialSynthesis,
  ModelResponseOut,
  ModelSelection,
  SynthesisOut,
} from "@/types/financial";

export type QueryStatus = "pending" | "running" | "complete" | "failed";

export interface ResearchQueryRecord {
  id: string;
  user_id: string;
  prompt: string;
  selected_models: ModelSelection[];
  options: {
    web_research?: boolean;
    research_type?: FinancialQuery["research_type"];
    ticker?: string;
    company_name?: string;
    region?: string;
    time_horizon?: FinancialQuery["time_horizon"];
    open_web_context?: OpenWebContext | null;
  };
  status: QueryStatus;
  error: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StreamEventPayload {
  type:
    | "query_started"
    | "model_started"
    | "model_completed"
    | "model_failed"
    | "synthesis_started"
    | "synthesis_ready"
    | "done"
    | "error";
  query_id: string;
  provider_id?: string;
  model_id?: string;
  response?: ModelResponseOut;
  synthesis?: SynthesisOut;
  financial_synthesis?: FinancialSynthesis;
  error?: { code: string; message: string };
}

export async function storeProviderKey(input: {
  userId: string;
  providerId: string;
  label: string;
  secret: string;
}) {
  const admin = getSupabaseAdmin() as any;
  const encrypted = encryptSecret(input.secret);

  const { error } = await admin.from("provider_keys").upsert(
    [{
      user_id: input.userId,
      provider_id: input.providerId,
      label: input.label,
      masked: maskKey(input.secret),
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      auth_tag: encrypted.authTag,
    }],
    { onConflict: "user_id,provider_id,label" },
  );

  if (error) throw error;
}

export async function createResearchQuery(input: {
  userId: string;
  query: FinancialQuery;
}) {
  const admin = getSupabaseAdmin() as any;
  const openWebContext =
    input.query.web_research !== false ? await gatherOpenWebContext(input.query) : null;
  const prompt = buildResearchPrompt(input.query, openWebContext);

  const { data, error } = await admin
    .from("research_queries")
    .insert({
      user_id: input.userId,
      prompt,
      selected_models: input.query.selected_models,
      options: {
        web_research: input.query.web_research ?? false,
        research_type: input.query.research_type,
        ticker: openWebContext?.analysis.resolved_symbol ?? input.query.ticker ?? null,
        company_name: openWebContext?.analysis.company_name ?? input.query.company_name ?? null,
        time_horizon: input.query.time_horizon ?? null,
        open_web_context: openWebContext,
      },
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw error;
  return normalizeQuery(data);
}

export async function listResearchQueries(userId: string) {
  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("research_queries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalizeQuery);
}

export async function getResearchQuery(userId: string, queryId: string) {
  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("research_queries")
    .select("*")
    .eq("id", queryId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeQuery(data) : null;
}

export async function getResearchResult(userId: string, queryId: string) {
  const admin = getSupabaseAdmin() as any;
  const query = await getResearchQuery(userId, queryId);
  if (!query) return null;

  const [{ data: responses, error: responsesError }, { data: synthesis, error: synthesisError }] =
    await Promise.all([
      admin.from("model_responses").select("*").eq("query_id", queryId).order("created_at", { ascending: true }),
      admin.from("syntheses").select("*").eq("query_id", queryId).maybeSingle(),
    ]);

  if (responsesError) throw responsesError;
  if (synthesisError) throw synthesisError;

  return {
    query,
    responses: (responses ?? []).map(normalizeResponse),
    synthesis: synthesis ? normalizeSynthesis(synthesis) : null,
    financial_synthesis: synthesis?.financial_synthesis
      ? normalizeFinancialSynthesis(synthesis.financial_synthesis)
      : null,
  };
}

export async function transitionQueryToRunning(userId: string, queryId: string) {
  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("research_queries")
    .update({ status: "running", error: null })
    .eq("id", queryId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeQuery(data) : null;
}

async function resolveProviderKey(userId: string, providerId: string) {
  const data = await getOptionalProviderKey(userId, providerId);
  if (!data) return null;
  return decryptSecret({ ciphertext: data.ciphertext, iv: data.iv, authTag: data.auth_tag });
}

function buildOpenWebModelResponse(query: ResearchQueryRecord): string {
  const ctx = query.options.open_web_context;
  const ticker = query.options.ticker ?? ctx?.analysis.resolved_symbol ?? "";
  const sectionEntries: Array<[string, string[]]> = [
    ["Query understanding", ctx?.analysis ? [
      `Intent: ${ctx.analysis.primary_intent}; themes: ${ctx.analysis.themes.join(", ") || "none"}; regions: ${ctx.analysis.regions.join(", ")}.`,
    ] : []],
    ["Direct answer basis", ctx?.direct_answer_basis ?? []],
    ["Company overview", ctx?.company_overview ?? []],
    ["Market data", ctx?.market_data ?? []],
    ["Analyst consensus", ctx?.analyst_data ?? []],
    ["SEC risk factors", ctx?.sec_risks ?? []],
    ["Earnings context", ctx?.earnings_summary ?? []],
    ["Recent news", ctx?.news ?? []],
    ["Reddit sentiment", ctx?.reddit ?? []],
    ["Macro overlay", ctx?.macro ?? []],
    ["Theme signals", ctx?.thematic_signals ?? []],
    ["Market sentiment", ctx?.market_sentiment ?? []],
  ];

  const sections = sectionEntries
    .filter(([, lines]) => lines.length > 0)
    .map(([title, lines]) => `${title}:\n${lines.map((line) => `- ${line}`).join("\n")}`);

  if (sections.length === 0) {
    return `Open-web intelligence completed for ${ticker || "this query"}, but source aggregation returned limited structured context.`;
  }

  const sig = ctx?.news_signals;
  if (sig) {
    sections.push(`News signal summary: ${sig.bullish} bullish, ${sig.bearish} bearish, ${sig.neutral} neutral articles.`);
  }

  return sections.join("\n\n");
}

function isFreeModel(selection: ModelSelection) {
  return selection.provider_id === "orvex";
}

function getMissingProviderMessage(selection: ModelSelection) {
  return `No API key configured for ${selection.provider_id}. Use Free Intelligence Mode immediately, or connect a premium provider in Settings.`;
}

export async function executeResearchQuery(input: {
  userId: string;
  query: ResearchQueryRecord;
  onEvent: (event: StreamEventPayload) => Promise<void> | void;
}) {
  const admin = getSupabaseAdmin() as any;
  const responses: ModelResponseOut[] = [];

  await input.onEvent({ type: "query_started", query_id: input.query.id });

  const settled = await Promise.all(
    input.query.selected_models.map(async (selection) => {
      await input.onEvent({
        type: "model_started",
        query_id: input.query.id,
        provider_id: selection.provider_id,
        model_id: selection.model_id,
      });

      const started = Date.now();

      try {
        let result;

        if (isFreeModel(selection)) {
          result = {
            text: buildOpenWebModelResponse(input.query),
            usage: { input_tokens: 0, output_tokens: 0 },
          };
        } else {
          const apiKey = await resolveProviderKey(input.userId, selection.provider_id);
          if (!apiKey && selection.provider_id !== "gemini") {
            throw new Error(getMissingProviderMessage(selection));
          }

          result = await runModelCompletion({
            providerId: selection.provider_id,
            modelId: selection.model_id,
            apiKey,
            prompt: input.query.prompt,
          });
        }

        const responseRecord = normalizeResponse({
          id: randomUUID(),
          query_id: input.query.id,
          provider_id: selection.provider_id,
          model_id: selection.model_id,
          status: "ok",
          text: result.text,
          latency_ms: Date.now() - started,
          input_tokens: result.usage?.input_tokens ?? 0,
          output_tokens: result.usage?.output_tokens ?? 0,
          error: null,
          error_code: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        responses.push(responseRecord);
        await persistResponse(responseRecord);
        await input.onEvent({ type: "model_completed", query_id: input.query.id, response: responseRecord });
      } catch (error) {
        const responseRecord = normalizeResponse({
          id: randomUUID(),
          query_id: input.query.id,
          provider_id: selection.provider_id,
          model_id: selection.model_id,
          status: "error",
          text: null,
          latency_ms: Date.now() - started,
          input_tokens: 0,
          output_tokens: 0,
          error: error instanceof Error ? error.message : "Provider request failed",
          error_code: "PROVIDER_ERROR",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        await persistResponse(responseRecord);
        await input.onEvent({
          type: "model_failed",
          query_id: input.query.id,
          provider_id: selection.provider_id,
          model_id: selection.model_id,
          error: { code: "provider_error", message: responseRecord.error ?? "Provider request failed" },
        });
      }
    }),
  );

  void settled;

  const successful = responses.filter((response) => response.status === "ok" && response.text);

  if (successful.length === 0) {
    const fallbackResponse = normalizeResponse({
      id: randomUUID(),
      query_id: input.query.id,
      provider_id: "orvex",
      model_id: "open-web-intelligence",
      status: "ok",
      text: buildOpenWebModelResponse(input.query),
      latency_ms: 0,
      input_tokens: 0,
      output_tokens: 0,
      error: null,
      error_code: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    responses.push(fallbackResponse);
    await persistResponse(fallbackResponse);
    await input.onEvent({ type: "model_completed", query_id: input.query.id, response: fallbackResponse });
    await input.onEvent({ type: "synthesis_started", query_id: input.query.id });

    const synthesized = await buildFinancialSynthesis({
      userId: input.userId,
      query: input.query,
      responses: [fallbackResponse],
    });

    const synthesisRecord = await persistSynthesis(input.query.id, synthesized);

    await admin
      .from("research_queries")
      .update({ status: "complete", error: null, completed_at: new Date().toISOString() })
      .eq("id", input.query.id);

    await input.onEvent({
      type: "synthesis_ready",
      query_id: input.query.id,
      synthesis: synthesisRecord.synthesis,
      financial_synthesis: synthesisRecord.financial_synthesis,
    });
    await input.onEvent({ type: "done", query_id: input.query.id });
    return;
  }

  await input.onEvent({ type: "synthesis_started", query_id: input.query.id });

  const synthesized = await buildFinancialSynthesis({
    userId: input.userId,
    query: input.query,
    responses: successful,
  });

  const synthesisRecord = await persistSynthesis(input.query.id, synthesized);

  await admin
    .from("research_queries")
    .update({ status: "complete", completed_at: new Date().toISOString(), error: null })
    .eq("id", input.query.id);

  await input.onEvent({
    type: "synthesis_ready",
    query_id: input.query.id,
    synthesis: synthesisRecord.synthesis,
    financial_synthesis: synthesisRecord.financial_synthesis,
  });
  await input.onEvent({ type: "done", query_id: input.query.id });
}

async function persistResponse(response: ModelResponseOut) {
  const admin = getSupabaseAdmin() as any;
  const { error } = await admin.from("model_responses").insert({
    id: response.id,
    query_id: response.query_id,
    provider_id: response.provider_id,
    model_id: response.model_id,
    status: response.status,
    text: response.text ?? null,
    latency_ms: response.latency_ms ?? 0,
    input_tokens: response.usage?.input_tokens ?? 0,
    output_tokens: response.usage?.output_tokens ?? 0,
    error: response.error ?? null,
    error_code: response.error ? "PROVIDER_ERROR" : null,
  });
  if (error) throw error;
}

async function persistSynthesis(queryId: string, payload: {
  synthesis: SynthesisOut;
  financial_synthesis: FinancialSynthesis;
}) {
  const admin = getSupabaseAdmin() as any;
  const { error } = await admin.from("syntheses").upsert([
    {
      query_id: queryId,
      summary: payload.synthesis.summary,
      consensus: payload.synthesis.consensus,
      disagreements: payload.synthesis.disagreements,
      unique_insights: payload.synthesis.unique_insights,
      citations: payload.synthesis.citations,
      financial_synthesis: payload.financial_synthesis,
    },
  ]);
  if (error) throw error;
  return payload;
}

async function buildFinancialSynthesis(input: {
  userId: string;
  query: ResearchQueryRecord;
  responses: ModelResponseOut[];
}) {
  const fallback = buildFallbackFinancialSynthesis(input.query, input.responses);
  const firstModel = input.responses[0];
  const openWebContext = input.query.options.open_web_context ?? null;

  try {
    if (firstModel.provider_id === "orvex") throw new Error("Skip premium synthesis");

    const apiKey = await resolveProviderKey(input.userId, firstModel.provider_id);
    const prompt = [
      "Synthesize these financial model responses into strict JSON.",
      "Return only JSON with keys:",
      "direct_answer, company_or_theme_context, summary, consensus, disagreements, unique_insights, citations, confidence_score, investment_thesis, key_risks, market_sentiment, macro_impact, key_catalysts, ai_consensus, bullish_theses, bearish_theses, consensus_points, contradictions, investment_score, confidence_detail, key_questions, next_research_areas.",
      "Use arrays and objects consistent with a financial research UI.",
      "Ground the answer in the open-web evidence and preserve source citations where possible.",
      `Original prompt:\n${input.query.prompt}`,
      "Model responses:",
      ...input.responses.map(
        (response) => `Provider ${response.provider_id} / ${response.model_id}:\n${response.text ?? ""}`,
      ),
      openWebContext
        ? `Open-web citations:\n${openWebContext.citations
            .slice(0, 12)
            .map((citation) => `- ${citation.source}: ${citation.title} (${citation.url})`)
            .join("\n")}`
        : null,
    ].filter(Boolean).join("\n\n");

    const synthesisResponse = await runModelCompletion({
      providerId: firstModel.provider_id,
      modelId: firstModel.model_id,
      apiKey,
      prompt,
    });

    const parsed = parseJsonObject<Partial<FinancialSynthesis>>(synthesisResponse.text);
    const financialSynthesis = mergeFinancialSynthesis(fallback, parsed);
    return {
      synthesis: {
        id: randomUUID(),
        query_id: input.query.id,
        summary: financialSynthesis.summary,
        consensus: financialSynthesis.consensus,
        disagreements: financialSynthesis.disagreements,
        unique_insights: financialSynthesis.unique_insights,
        citations: financialSynthesis.citations,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      financial_synthesis: financialSynthesis,
    };
  } catch {
    return {
      synthesis: {
        id: randomUUID(),
        query_id: input.query.id,
        summary: fallback.summary,
        consensus: fallback.consensus,
        disagreements: fallback.disagreements,
        unique_insights: fallback.unique_insights,
        citations: fallback.citations,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      financial_synthesis: fallback,
    };
  }
}

function buildResearchPrompt(query: FinancialQuery, openWebContext: OpenWebContext | null) {
  const parts = [
    openWebContext?.analysis.resolved_symbol
      ? `Ticker: ${openWebContext.analysis.resolved_symbol.toUpperCase()}`
      : query.ticker
        ? `Ticker: ${query.ticker.toUpperCase()}`
        : null,
    openWebContext?.analysis.company_name
      ? `Company: ${openWebContext.analysis.company_name}`
      : query.company_name
        ? `Company: ${query.company_name}`
        : null,
    query.time_horizon ? `Time horizon: ${query.time_horizon}` : null,
    `Research focus: ${query.research_type}`,
    openWebContext?.analysis
      ? `Detected intent: ${openWebContext.analysis.primary_intent}; themes: ${openWebContext.analysis.themes.join(", ") || "none"}; regions: ${openWebContext.analysis.regions.join(", ")}.`
      : null,
    "Produce: a direct answer, company/theme context, bullish factors, bearish risks, market sentiment, macro impact, catalysts, confidence score, and final AI consensus.",
    openWebContext ? `Open-web intelligence:\n${formatOpenWebContext(openWebContext)}` : null,
    "",
    query.query,
  ].filter(Boolean);

  return parts.join("\n");
}

function bullishNewsSignals(news: string[]): string[] {
  return news
    .filter((line) => line.includes("[BULLISH]"))
    .slice(0, 4)
    .map((line) => line.replace(/.*\[BULLISH\]:\s?/, "").split(" - ")[0].trim());
}

function bearishNewsSignals(news: string[]): string[] {
  return news
    .filter((line) => line.includes("[BEARISH]"))
    .slice(0, 4)
    .map((line) => line.replace(/.*\[BEARISH\]:\s?/, "").split(" - ")[0].trim());
}

function calcInvestmentScore(ctx: OpenWebContext | null): number {
  if (!ctx) return 0;
  let score = 0;

  const newsNet = Math.min(ctx.news_signals.bullish, 5) - Math.min(ctx.news_signals.bearish, 5);
  score += newsNet * 0.08;

  if (ctx.reddit.length > 0) {
    const summary = ctx.reddit[0].toLowerCase();
    if (summary.includes("bullish")) score += 0.15;
    else if (summary.includes("bearish")) score -= 0.15;
  }

  const analystLine = ctx.analyst_data.find((line) => line.toLowerCase().includes("rating:"));
  if (analystLine) {
    const rating = analystLine.toLowerCase();
    if (rating.includes("strong_buy") || rating.includes("buy")) score += 0.2;
    else if (rating.includes("strong_sell") || rating.includes("sell")) score -= 0.2;
    else if (rating.includes("hold") || rating.includes("neutral")) score += 0.05;
  }

  if (ctx.sec_risks.length > 3) score -= 0.05;

  return Math.max(-1, Math.min(1, score));
}

function buildDirectAnswer(ctx: OpenWebContext | null, investmentScore: number, subject: string) {
  const sentiment = ctx?.news_signals;
  const balance = sentiment
    ? sentiment.bullish > sentiment.bearish
      ? "recent coverage leans positive"
      : sentiment.bearish > sentiment.bullish
        ? "recent coverage leans negative"
        : "recent coverage is mixed"
    : "recent coverage is limited";

  if (investmentScore > 0.2) {
    return `${subject} screens moderately constructive right now because ${balance} and the cross-source evidence shows more upside catalysts than immediate downside triggers.`;
  }

  if (investmentScore < -0.2) {
    return `${subject} screens cautious right now because ${balance} and the current evidence set is tilted toward risk transmission rather than upside follow-through.`;
  }

  return `${subject} looks mixed right now: ${balance}, and the answer depends on whether the next catalyst confirms the bull case or validates the listed risks.`;
}

function buildConfidenceDetail(ctx: OpenWebContext | null) {
  const sourceCount = ctx?.citations.length ?? 0;
  const freshnessCount = (ctx?.citations ?? []).filter((item) => item.published_at).length;
  const directionalSignals = (ctx?.news_signals.bullish ?? 0) + (ctx?.news_signals.bearish ?? 0);
  const score = Math.min(
    0.92,
    0.45 +
      Math.min(0.25, sourceCount * 0.02) +
      Math.min(0.15, freshnessCount * 0.01) +
      Math.min(0.15, directionalSignals * 0.02),
  );

  return {
    score,
    explanation: `Confidence ${Math.round(score * 100)}% based on ${sourceCount} sources, ${freshnessCount} dated citations, and ${directionalSignals} directional news signals.`,
  };
}

function buildFallbackFinancialSynthesis(
  query: ResearchQueryRecord,
  responses: ModelResponseOut[],
): FinancialSynthesis {
  const ctx = query.options.open_web_context ?? null;
  const ticker = query.options.ticker ?? ctx?.analysis.resolved_symbol ?? "";
  const subject = ctx?.analysis.company_name ?? ticker ?? "this query";
  const investmentScore = calcInvestmentScore(ctx);
  const summaryParts: string[] = [];

  if (ctx?.company_overview[0]) summaryParts.push(ctx.company_overview[0]);
  if (ctx?.market_data.length) summaryParts.push(`Market activity: ${ctx.market_data.slice(0, 3).join(" | ")}.`);
  if (ctx?.analyst_data.length) summaryParts.push(`Analyst view: ${ctx.analyst_data[0]}`);

  const sig = ctx?.news_signals;
  if (sig) {
    const totalNews = sig.bullish + sig.bearish + sig.neutral;
    const sentiment = sig.bullish > sig.bearish ? "leaning bullish" : sig.bearish > sig.bullish ? "leaning bearish" : "mixed";
    summaryParts.push(`News signal across ${totalNews} articles is ${sentiment} (${sig.bullish} bullish, ${sig.bearish} bearish).`);
  }

  if (ctx?.macro.length) summaryParts.push(`Macro context: ${ctx.macro.slice(0, 2).join(" ")}`);
  if (ctx?.analysis) {
    summaryParts.push(`Orvex routed this as a ${ctx.analysis.primary_intent} query with ${ctx.analysis.themes.join(", ") || "broad-market"} exposure across ${ctx.analysis.regions.join(", ")}.`);
  }

  const summary =
    summaryParts.length > 0
      ? summaryParts.join(" ")
      : ctx?.company_overview[0] ?? `Intelligence report for ${subject} compiled from open-web sources.`;

  const thesisLines: string[] = [];
  if (ctx?.company_overview[0]) thesisLines.push(ctx.company_overview[0]);
  if (ctx?.analyst_data[0]) thesisLines.push(ctx.analyst_data[0]);
  if (ctx?.market_data[0]) thesisLines.push(`Current: ${ctx.market_data[0]}`);
  const investmentThesis = thesisLines.join(" ") || `Analysis of ${subject} based on aggregated open-web intelligence.`;

  const bullNews = bullishNewsSignals(ctx?.news ?? []);
  const bullPoints: string[] = [
    ...(ctx?.analyst_data.filter((line) => line.toLowerCase().includes("buy") || line.toLowerCase().includes("upside")).slice(0, 2) ?? []),
    ...bullNews,
    ...(ctx?.thematic_signals.slice(0, 2) ?? []),
    ...(ctx?.analyst_data.filter((line) => line.includes("growth") || line.includes("revenue")).slice(0, 2) ?? []),
  ].filter(Boolean).slice(0, 6);

  const fedLine = ctx?.macro.find((line) => line.toLowerCase().includes("fed funds"));
  if (fedLine && fedLine.match(/[0-9]+\.[0-9]+/)) {
    const rate = parseFloat(fedLine.match(/(\d+\.\d+)/)?.[1] ?? "0");
    if (rate < 3.5) {
      bullPoints.push("Low Fed Funds Rate provides accommodative monetary environment for equity valuations.");
    }
  }

  if (bullPoints.length < 3 && ctx?.company_overview[1]) {
    bullPoints.push(`Strong business foundation: ${ctx.company_overview[1].slice(0, 120)}`);
  }

  const bullishTheses = bullPoints.length > 0
    ? [{
        id: "bull-1",
        title: `${subject} Upside Case`,
        confidence: 0.55 + Math.max(0, investmentScore) * 0.3,
        supporting_points: bullPoints.slice(0, 6),
        growth_catalysts: bullNews.slice(0, 3),
        valuation_opportunities: ctx?.analyst_data.filter((line) => line.includes("target")).slice(0, 2) ?? [],
        provider_id: "orvex",
        model_id: "open-web-intelligence",
      }]
    : responses.slice(0, 1).map((response, index) => ({
        id: `bull-${index + 1}`,
        title: "Open-web upside case",
        confidence: 0.55,
        supporting_points: [(response.text ?? "").slice(0, 200)],
        growth_catalysts: [],
        valuation_opportunities: [],
        provider_id: response.provider_id,
        model_id: response.model_id,
      }));

  const bearNews = bearishNewsSignals(ctx?.news ?? []);
  const bearPoints: string[] = [
    ...(ctx?.sec_risks.slice(0, 3) ?? []),
    ...bearNews,
    ...(ctx?.macro.slice(0, 1) ?? []),
  ].filter(Boolean).slice(0, 6);

  const tenYearLine = ctx?.macro.find((line) => line.includes("10Y Treasury"));
  if (tenYearLine) {
    const rate = parseFloat(tenYearLine.match(/(\d+\.\d+)/)?.[1] ?? "0");
    if (rate > 4.0) {
      bearPoints.push(`Elevated 10Y Treasury yield (${rate.toFixed(2)}%) compresses equity risk premium and increases discount rate pressure.`);
    }
  }

  const spreadLine = ctx?.macro.find((line) => line.includes("10Y-2Y spread"));
  if (spreadLine && spreadLine.includes("-")) {
    bearPoints.push("Inverted yield curve (negative 10Y-2Y spread) historically signals elevated recession risk.");
  }

  if (bearPoints.length < 3) {
    const sellLine = ctx?.analyst_data.find((line) => line.toLowerCase().includes("sell") || line.toLowerCase().includes("risk"));
    if (sellLine) bearPoints.push(sellLine);
  }

  const bearishTheses = bearPoints.length > 0
    ? [{
        id: "bear-1",
        title: `${subject} Risk Case`,
        confidence: 0.5 + Math.max(0, -investmentScore) * 0.3,
        supporting_points: bearPoints.slice(0, 6),
        risks: ctx?.sec_risks.slice(0, 3) ?? [],
        valuation_concerns: ctx?.market_data.filter((line) => line.includes("P/E")).slice(0, 2) ?? [],
        macro_threats: ctx?.macro.slice(0, 2) ?? [],
        provider_id: "orvex",
        model_id: "open-web-intelligence",
      }]
    : responses.slice(0, 1).map((response, index) => ({
        id: `bear-${index + 1}`,
        title: "Open-web risk case",
        confidence: 0.45,
        supporting_points: [(response.text ?? "").slice(0, 200)],
        risks: [],
        valuation_concerns: [],
        macro_threats: [],
        provider_id: response.provider_id,
        model_id: response.model_id,
      }));

  const consensusClaims = [
    ctx?.direct_answer_basis[0],
    ctx?.company_overview[0],
    ctx?.market_data[0],
    ctx?.analyst_data[0],
  ].filter((claim): claim is string => Boolean(claim)).slice(0, 4).map((claim, index) => ({
    id: `consensus-${index + 1}`,
    claim,
    supporting_models: ["orvex:open-web-intelligence"],
    confidence: 0.7,
  }));

  const uniqueInsights = [
    ...(ctx?.thematic_signals.slice(0, 3).map((insight, index) => ({
      id: `insight-theme-${index + 1}`,
      insight,
      provider_id: "orvex",
      model_id: "open-web-intelligence",
    })) ?? []),
    ...(ctx?.news.slice(0, 3).map((item, index) => ({
      id: `insight-news-${index + 1}`,
      insight: item.replace(/\[BULLISH\]|\[BEARISH\]/, "").trim(),
      provider_id: "orvex",
      model_id: "open-web-intelligence",
    })) ?? []),
    ...(ctx?.reddit.slice(0, 2).map((item, index) => ({
      id: `insight-reddit-${index + 1}`,
      insight: item,
      provider_id: "orvex",
      model_id: "open-web-intelligence",
    })) ?? []),
  ];

  const citations = (ctx?.citations ?? []).slice(0, 12).map((citation, index) => ({
    id: `citation-${index + 1}`,
    title: citation.title,
    url: citation.url,
    snippet: `${citation.source}${citation.published_at ? ` â€¢ ${formatRelativeTime(citation.published_at)}` : ""}`,
    claim_ids: [],
  }));

  const keyRisks = [
    ...(ctx?.sec_risks.slice(0, 3) ?? []),
    ...bearNews.slice(0, 2),
  ].filter(Boolean).slice(0, 5);

  const sig2 = ctx?.news_signals ?? { bullish: 0, bearish: 0, neutral: 0 };
  const total = sig2.bullish + sig2.bearish + sig2.neutral || 1;
  const bullConf = Math.min(0.9, 0.4 + (sig2.bullish / total) * 0.5);
  const bearConf = Math.min(0.9, 0.4 + (sig2.bearish / total) * 0.5);
  const confidenceDetail = buildConfidenceDetail(ctx);

  return {
    ticker: ticker || undefined,
    direct_answer: buildDirectAnswer(ctx, investmentScore, subject),
    company_or_theme_context: [
      ...(ctx?.company_overview.slice(0, 2) ?? []),
      ...(ctx?.thematic_signals.slice(0, 2) ?? []),
    ].slice(0, 4),
    summary,
    consensus: consensusClaims,
    disagreements: [],
    unique_insights: uniqueInsights,
    citations,
    confidence_score: {
      consensus_agreement: 0.65,
      bullish_confidence: bullConf,
      bearish_confidence: bearConf,
    },
    investment_thesis: investmentThesis,
    key_risks: keyRisks,
    market_sentiment: ctx?.market_sentiment ?? [],
    macro_impact: ctx?.macro.slice(0, 4) ?? [],
    key_catalysts: [
      ...bullNews.slice(0, 2),
      ...(ctx?.earnings_summary.slice(0, 2) ?? []),
      ...(ctx?.thematic_signals.slice(0, 2) ?? []),
    ].slice(0, 5),
    ai_consensus: consensusClaims.length > 0
      ? `Leaning ${investmentScore > 0.1 ? "constructive" : investmentScore < -0.1 ? "cautious" : "mixed"} on ${subject} with ${consensusClaims.length} primary evidence points.`
      : `Mixed evidence on ${subject}; more confirmation needed.`,
    bullish_theses: bullishTheses,
    bearish_theses: bearishTheses,
    consensus_points: consensusClaims.map((claim) => ({
      id: claim.id,
      point: claim.claim,
      supporting_providers: ["orvex"],
      confidence: 0.7,
      evidence_strength: "medium",
    })),
    contradictions: [],
    investment_score: investmentScore,
    confidence_detail: confidenceDetail,
    key_questions: ctx?.news.slice(0, 2).map((item) => `Validate: ${item.split(":").pop()?.trim().slice(0, 80)}`) ?? [],
    next_research_areas: [
      ...(ctx?.macro.length ? ["Monitor FRED and regional macro releases for rate, inflation, and growth shifts."] : []),
      ...(ctx?.reddit.length ? ["Track sentiment changes across high-volume investing communities."] : []),
      ...(ctx?.sec_risks.length ? ["Review the latest filed disclosures for changes in stated risk concentration."] : []),
    ],
  };
}

function formatRelativeTime(dateStr: string): string {
  try {
    const ms = Date.now() - Date.parse(dateStr);
    const hours = Math.floor(ms / 3_600_000);
    if (hours < 1) return "< 1h ago";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return dateStr;
  }
}

function mergeFinancialSynthesis(base: FinancialSynthesis, patch: Partial<FinancialSynthesis>): FinancialSynthesis {
  return {
    ...base,
    ...patch,
    confidence_score: { ...base.confidence_score, ...patch.confidence_score },
    consensus: Array.isArray(patch.consensus) ? patch.consensus : base.consensus,
    disagreements: Array.isArray(patch.disagreements) ? patch.disagreements : base.disagreements,
    unique_insights: Array.isArray(patch.unique_insights) ? patch.unique_insights : base.unique_insights,
    citations: Array.isArray(patch.citations) ? patch.citations : base.citations,
    key_risks: Array.isArray(patch.key_risks) ? patch.key_risks : base.key_risks,
    bullish_theses: Array.isArray(patch.bullish_theses) ? patch.bullish_theses : base.bullish_theses,
    bearish_theses: Array.isArray(patch.bearish_theses) ? patch.bearish_theses : base.bearish_theses,
    consensus_points: Array.isArray(patch.consensus_points) ? patch.consensus_points : base.consensus_points,
    contradictions: Array.isArray(patch.contradictions) ? patch.contradictions : base.contradictions,
    key_questions: Array.isArray(patch.key_questions) ? patch.key_questions : base.key_questions,
    next_research_areas: Array.isArray(patch.next_research_areas) ? patch.next_research_areas : base.next_research_areas,
    company_or_theme_context: Array.isArray(patch.company_or_theme_context) ? patch.company_or_theme_context : base.company_or_theme_context,
    market_sentiment: Array.isArray(patch.market_sentiment) ? patch.market_sentiment : base.market_sentiment,
    macro_impact: Array.isArray(patch.macro_impact) ? patch.macro_impact : base.macro_impact,
    key_catalysts: Array.isArray(patch.key_catalysts) ? patch.key_catalysts : base.key_catalysts,
  };
}

function parseJsonObject<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found");
  return JSON.parse(match[0]) as T;
}

function normalizeQuery(row: Record<string, unknown>): ResearchQueryRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    prompt: String(row.prompt),
    selected_models: (row.selected_models as ModelSelection[]) ?? [],
    options: (row.options as ResearchQueryRecord["options"]) ?? {},
    status: row.status as QueryStatus,
    error: (row.error as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function normalizeResponse(row: Record<string, unknown>): ModelResponseOut {
  return {
    id: String(row.id),
    query_id: String(row.query_id),
    provider_id: String(row.provider_id),
    model_id: String(row.model_id),
    status: String(row.status),
    text: (row.text as string | null) ?? undefined,
    latency_ms: Number(row.latency_ms ?? 0),
    usage: {
      input_tokens: Number(row.input_tokens ?? 0),
      output_tokens: Number(row.output_tokens ?? 0),
    },
    error: (row.error as string | null) ?? undefined,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function normalizeSynthesis(row: Record<string, unknown>): SynthesisOut {
  return {
    id: String(row.id),
    query_id: String(row.query_id),
    summary: String(row.summary ?? ""),
    consensus: (row.consensus as SynthesisOut["consensus"]) ?? [],
    disagreements: (row.disagreements as SynthesisOut["disagreements"]) ?? [],
    unique_insights: (row.unique_insights as SynthesisOut["unique_insights"]) ?? [],
    citations: (row.citations as SynthesisOut["citations"]) ?? [],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function normalizeFinancialSynthesis(value: unknown): FinancialSynthesis {
  return value as FinancialSynthesis;
}
