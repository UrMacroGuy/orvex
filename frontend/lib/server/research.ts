/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret, maskKey } from "@/lib/server/crypto";
import { runModelCompletion } from "@/lib/server/providers/llm";
import { formatOpenWebContext, gatherOpenWebContext, type OpenWebContext } from "@/lib/server/providers/open-web";
import { getOptionalProviderKey } from "@/lib/server/auth";
import type { FinancialQuery, FinancialSynthesis, ModelResponseOut, ModelSelection, SynthesisOut } from "@/types/financial";

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
        ticker: input.query.ticker ?? null,
        company_name: input.query.company_name ?? null,
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
  const ticker = query.options.ticker ?? "";
  const sectionEntries: Array<[string, string[]]> = [
    ["Company overview", ctx?.company_overview ?? []],
    ["Market data", ctx?.market_data ?? []],
    ["Analyst consensus", ctx?.analyst_data ?? []],
    ["SEC risk factors", ctx?.sec_risks ?? []],
    ["Earnings context", ctx?.earnings_summary ?? []],
    ["Recent news", ctx?.news ?? []],
    ["Reddit sentiment", ctx?.reddit ?? []],
    ["Macro overlay", ctx?.macro ?? []],
  ];

  const sections = sectionEntries
    .filter(([, lines]) => lines.length > 0)
    .map(([title, lines]) => `${title}:\n${lines.map((l) => `• ${l}`).join("\n")}`);

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

  const successful = responses.filter((r) => r.status === "ok" && r.text);

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
      "summary, consensus, disagreements, unique_insights, citations, confidence_score, investment_thesis, key_risks, bullish_theses, bearish_theses, consensus_points, contradictions, investment_score, key_questions, next_research_areas.",
      "Use arrays and objects consistent with a financial research UI.",
      "Ground the answer in the open-web evidence and preserve source citations where possible.",
      `Original prompt:\n${input.query.prompt}`,
      "Model responses:",
      ...input.responses.map(
        (r) => `Provider ${r.provider_id} / ${r.model_id}:\n${r.text ?? ""}`,
      ),
      openWebContext
        ? `Open-web citations:\n${openWebContext.citations
            .slice(0, 12)
            .map((c) => `- ${c.source}: ${c.title} (${c.url})`)
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
    query.ticker ? `Ticker: ${query.ticker.toUpperCase()}` : null,
    query.company_name ? `Company: ${query.company_name}` : null,
    query.time_horizon ? `Time horizon: ${query.time_horizon}` : null,
    `Research focus: ${query.research_type}`,
    "Produce: company overview, risk factors, earnings context, bullish vs bearish theses, sentiment read, macro overlay, and a final synthesis.",
    openWebContext ? `Open-web intelligence:\n${formatOpenWebContext(openWebContext)}` : null,
    "",
    query.query,
  ].filter(Boolean);

  return parts.join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bullishNewsSignals(news: string[]): string[] {
  return news
    .filter((line) => line.includes("[BULLISH]"))
    .slice(0, 4)
    .map((line) => line.replace(/.*\[BULLISH\]:\s?/, "").split(" — ")[0].trim());
}

function bearishNewsSignals(news: string[]): string[] {
  return news
    .filter((line) => line.includes("[BEARISH]"))
    .slice(0, 4)
    .map((line) => line.replace(/.*\[BEARISH\]:\s?/, "").split(" — ")[0].trim());
}

function calcInvestmentScore(ctx: OpenWebContext | null): number {
  if (!ctx) return 0;
  let score = 0;

  // News signals (±0.08 each, max ±0.4)
  const newsNet = Math.min(ctx.news_signals.bullish, 5) - Math.min(ctx.news_signals.bearish, 5);
  score += newsNet * 0.08;

  // Reddit sentiment
  if (ctx.reddit.length > 0) {
    const summary = ctx.reddit[0].toLowerCase();
    if (summary.includes("bullish")) score += 0.15;
    else if (summary.includes("bearish")) score -= 0.15;
  }

  // Analyst recommendation
  const analystLine = ctx.analyst_data.find((l) => l.toLowerCase().includes("rating:"));
  if (analystLine) {
    const rating = analystLine.toLowerCase();
    if (rating.includes("strong_buy") || rating.includes("buy")) score += 0.2;
    else if (rating.includes("strong_sell") || rating.includes("sell")) score -= 0.2;
    else if (rating.includes("hold") || rating.includes("neutral")) score += 0.05;
  }

  // SEC risks reduce score slightly
  if (ctx.sec_risks.length > 3) score -= 0.05;

  return Math.max(-1, Math.min(1, score));
}

function buildFallbackFinancialSynthesis(
  query: ResearchQueryRecord,
  responses: ModelResponseOut[],
): FinancialSynthesis {
  const ctx = query.options.open_web_context ?? null;
  const ticker = query.options.ticker ?? "";
  const investmentScore = calcInvestmentScore(ctx);

  // ── Summary (multi-section) ─────────────────────────────────────────────────
  const summaryParts: string[] = [];

  if (ctx?.company_overview[0]) {
    summaryParts.push(ctx.company_overview[0]);
  }

  if (ctx?.market_data.length) {
    summaryParts.push(`Market activity: ${ctx.market_data.slice(0, 3).join(" | ")}.`);
  }

  if (ctx?.analyst_data.length) {
    summaryParts.push(`Analyst view: ${ctx.analyst_data[0]}`);
  }

  const sig = ctx?.news_signals;
  if (sig) {
    const totalNews = sig.bullish + sig.bearish + sig.neutral;
    const sentiment =
      sig.bullish > sig.bearish ? "leaning bullish" : sig.bearish > sig.bullish ? "leaning bearish" : "mixed";
    summaryParts.push(
      `News signal across ${totalNews} articles is ${sentiment} (${sig.bullish} bullish, ${sig.bearish} bearish).`,
    );
  }

  if (ctx?.macro.length) {
    summaryParts.push(`Macro context: ${ctx.macro.slice(0, 2).join(" ")}`);
  }

  const summary =
    summaryParts.length > 0
      ? summaryParts.join(" ")
      : ctx?.company_overview[0] ?? `Intelligence report for ${ticker || "this query"} compiled from open-web sources.`;

  // ── Investment thesis ───────────────────────────────────────────────────────
  const thesisLines: string[] = [];
  if (ctx?.company_overview[0]) thesisLines.push(ctx.company_overview[0]);
  if (ctx?.analyst_data[0]) thesisLines.push(ctx.analyst_data[0]);
  if (ctx?.market_data[0]) thesisLines.push(`Current: ${ctx.market_data[0]}`);
  const investmentThesis =
    thesisLines.join(" ") || `Analysis of ${ticker || "this asset"} based on aggregated open-web intelligence.`;

  // ── Bull theses ─────────────────────────────────────────────────────────────
  const bullNews = bullishNewsSignals(ctx?.news ?? []);
  const bullPoints: string[] = [
    ...(ctx?.analyst_data.filter((l) => l.toLowerCase().includes("buy") || l.toLowerCase().includes("upside")).slice(0, 2) ?? []),
    ...bullNews,
    ...(ctx?.analyst_data.filter((l) => l.includes("growth") || l.includes("revenue")).slice(0, 2) ?? []),
  ].filter(Boolean).slice(0, 6);

  // Add macro tailwinds
  const fedLine = ctx?.macro.find((l) => l.toLowerCase().includes("fed funds"));
  if (fedLine && fedLine.match(/[0-9]+\.[0-9]+/) ) {
    const rate = parseFloat(fedLine.match(/(\d+\.\d+)/)?.[1] ?? "0");
    if (rate < 3.5) bullPoints.push("Low Fed Funds Rate provides accommodative monetary environment for equity valuations.");
  }

  if (bullPoints.length < 3 && ctx?.company_overview[1]) {
    bullPoints.push(`Strong business foundation: ${ctx.company_overview[1].slice(0, 120)}`);
  }

  const bullishTheses = bullPoints.length > 0
    ? [{
        id: "bull-1",
        title: `${ticker || "Asset"} Upside Case`,
        confidence: 0.55 + Math.max(0, investmentScore) * 0.3,
        supporting_points: bullPoints.slice(0, 6),
        growth_catalysts: bullNews.slice(0, 3),
        valuation_opportunities: ctx?.analyst_data.filter((l) => l.includes("target")).slice(0, 2) ?? [],
        provider_id: "orvex",
        model_id: "open-web-intelligence",
      }]
    : responses.slice(0, 1).map((r, i) => ({
        id: `bull-${i + 1}`,
        title: `Open-web upside case`,
        confidence: 0.55,
        supporting_points: [(r.text ?? "").slice(0, 200)],
        growth_catalysts: [],
        valuation_opportunities: [],
        provider_id: r.provider_id,
        model_id: r.model_id,
      }));

  // ── Bear theses ─────────────────────────────────────────────────────────────
  const bearNews = bearishNewsSignals(ctx?.news ?? []);
  const bearPoints: string[] = [
    ...(ctx?.sec_risks.slice(0, 3) ?? []),
    ...bearNews,
  ].filter(Boolean).slice(0, 6);

  // Add macro headwinds
  const tenYearLine = ctx?.macro.find((l) => l.includes("10Y Treasury"));
  if (tenYearLine) {
    const rate = parseFloat(tenYearLine.match(/(\d+\.\d+)/)?.[1] ?? "0");
    if (rate > 4.0) {
      bearPoints.push(`Elevated 10Y Treasury yield (${rate.toFixed(2)}%) compresses equity risk premium and increases discount rate pressure.`);
    }
  }

  const spreadLine = ctx?.macro.find((l) => l.includes("10Y-2Y spread"));
  if (spreadLine && spreadLine.includes("-")) {
    bearPoints.push("Inverted yield curve (negative 10Y-2Y spread) historically signals elevated recession risk.");
  }

  if (bearPoints.length < 3 && ctx?.analyst_data.find((l) => l.toLowerCase().includes("sell") || l.toLowerCase().includes("risk"))) {
    const sellLine = ctx.analyst_data.find((l) => l.toLowerCase().includes("sell") || l.toLowerCase().includes("risk"));
    if (sellLine) bearPoints.push(sellLine);
  }

  const bearishTheses = bearPoints.length > 0
    ? [{
        id: "bear-1",
        title: `${ticker || "Asset"} Risk Case`,
        confidence: 0.5 + Math.max(0, -investmentScore) * 0.3,
        supporting_points: bearPoints.slice(0, 6),
        risks: ctx?.sec_risks.slice(0, 3) ?? [],
        valuation_concerns: ctx?.market_data.filter((l) => l.includes("P/E")).slice(0, 2) ?? [],
        macro_threats: ctx?.macro.slice(0, 2) ?? [],
        provider_id: "orvex",
        model_id: "open-web-intelligence",
      }]
    : responses.slice(0, 1).map((r, i) => ({
        id: `bear-${i + 1}`,
        title: `Open-web risk case`,
        confidence: 0.45,
        supporting_points: [(r.text ?? "").slice(0, 200)],
        risks: [],
        valuation_concerns: [],
        macro_threats: [],
        provider_id: r.provider_id,
        model_id: r.model_id,
      }));

  // ── Consensus & insights ────────────────────────────────────────────────────
  const consensusClaims = [
    ctx?.company_overview[0],
    ctx?.market_data[0],
    ctx?.analyst_data[0],
  ].filter((c): c is string => Boolean(c)).slice(0, 3).map((claim, i) => ({
    id: `consensus-${i + 1}`,
    claim,
    supporting_models: ["orvex:open-web-intelligence"],
    confidence: 0.7,
  }));

  const uniqueInsights = [
    ...(ctx?.news.slice(0, 3).map((n, i) => ({
      id: `insight-news-${i + 1}`,
      insight: n.replace(/\[BULLISH\]|\[BEARISH\]/, "").trim(),
      provider_id: "orvex",
      model_id: "open-web-intelligence",
    })) ?? []),
    ...(ctx?.reddit.slice(0, 2).map((r, i) => ({
      id: `insight-reddit-${i + 1}`,
      insight: r,
      provider_id: "orvex",
      model_id: "open-web-intelligence",
    })) ?? []),
  ];

  const citations = (ctx?.citations ?? []).slice(0, 12).map((c, i) => ({
    id: `citation-${i + 1}`,
    title: c.title,
    url: c.url,
    snippet: `${c.source}${c.published_at ? ` • ${formatRelativeTime(c.published_at)}` : ""}`,
    claim_ids: [],
  }));

  const keyRisks = [
    ...(ctx?.sec_risks.slice(0, 3) ?? []),
    ...bearNews.slice(0, 2),
  ].filter(Boolean).slice(0, 5);

  // ── Confidence scores ───────────────────────────────────────────────────────
  const sig2 = ctx?.news_signals ?? { bullish: 0, bearish: 0, neutral: 0 };
  const total = sig2.bullish + sig2.bearish + sig2.neutral || 1;
  const bullConf = Math.min(0.9, 0.4 + (sig2.bullish / total) * 0.5);
  const bearConf = Math.min(0.9, 0.4 + (sig2.bearish / total) * 0.5);

  return {
    ticker: ticker || undefined,
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
    bullish_theses: bullishTheses,
    bearish_theses: bearishTheses,
    consensus_points: consensusClaims.map((c) => ({
      id: c.id,
      point: c.claim,
      supporting_providers: ["orvex"],
      confidence: 0.7,
      evidence_strength: "medium",
    })),
    contradictions: [],
    investment_score: investmentScore,
    key_questions: ctx?.news.slice(0, 2).map((n) => `Validate: ${n.split(":").pop()?.trim().slice(0, 80)}`) ?? [],
    next_research_areas: [
      ...(ctx?.macro.length ? ["Monitor FRED macro series for rate and inflation shifts."] : []),
      ...(ctx?.reddit.length ? ["Track sentiment changes in r/stocks, r/wallstreetbets."] : []),
      ...(ctx?.sec_risks.length ? ["Review latest SEC 10-K/10-Q for updated risk disclosures."] : []),
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

