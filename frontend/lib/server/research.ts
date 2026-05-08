/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret, maskKey } from "@/lib/server/crypto";
import { runModelCompletion } from "@/lib/server/providers/llm";
import { formatOpenWebContext, gatherOpenWebContext, type OpenWebContext } from "@/lib/server/providers/open-web";
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
    {
      onConflict: "user_id,provider_id,label",
    },
  );

  if (error) {
    throw error;
  }
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

  if (error) {
    throw error;
  }

  return normalizeQuery(data);
}

export async function listResearchQueries(userId: string) {
  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("research_queries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

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

  if (error) {
    throw error;
  }

  return data ? normalizeQuery(data) : null;
}

export async function getResearchResult(userId: string, queryId: string) {
  const admin = getSupabaseAdmin() as any;
  const query = await getResearchQuery(userId, queryId);
  if (!query) {
    return null;
  }

  const [{ data: responses, error: responsesError }, { data: synthesis, error: synthesisError }] =
    await Promise.all([
      admin.from("model_responses").select("*").eq("query_id", queryId).order("created_at", { ascending: true }),
      admin.from("syntheses").select("*").eq("query_id", queryId).maybeSingle(),
    ]);

  if (responsesError) {
    throw responsesError;
  }

  if (synthesisError) {
    throw synthesisError;
  }

  return {
    query,
    responses: (responses ?? []).map(normalizeResponse),
    synthesis: synthesis ? normalizeSynthesis(synthesis) : null,
    financial_synthesis: synthesis?.financial_synthesis ? normalizeFinancialSynthesis(synthesis.financial_synthesis) : null,
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

  if (error) {
    throw error;
  }

  return data ? normalizeQuery(data) : null;
}

async function resolveProviderKey(userId: string, providerId: string) {
  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("provider_keys")
    .select("*")
    .eq("user_id", userId)
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(`No API key configured for provider '${providerId}'`);
  }

  return decryptSecret({
    ciphertext: data.ciphertext,
    iv: data.iv,
    authTag: data.auth_tag,
  });
}

export async function executeResearchQuery(input: {
  userId: string;
  query: ResearchQueryRecord;
  onEvent: (event: StreamEventPayload) => Promise<void> | void;
}) {
  const admin = getSupabaseAdmin() as any;
  const responses: ModelResponseOut[] = [];

  await input.onEvent({
    type: "query_started",
    query_id: input.query.id,
  });

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
        const apiKey = await resolveProviderKey(input.userId, selection.provider_id);
        const result = await runModelCompletion({
          providerId: selection.provider_id,
          modelId: selection.model_id,
          apiKey,
          prompt: input.query.prompt,
        });

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

        await input.onEvent({
          type: "model_completed",
          query_id: input.query.id,
          response: responseRecord,
        });
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
          error: {
            code: "provider_error",
            message: responseRecord.error ?? "Provider request failed",
          },
        });
      }
    }),
  );

  void settled;

  const successful = responses.filter((response) => response.status === "ok" && response.text);

  if (successful.length === 0) {
    await admin
      .from("research_queries")
      .update({
        status: "failed",
        error: "All selected models failed. Check your API keys and provider model IDs.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", input.query.id);

    await input.onEvent({
      type: "error",
      query_id: input.query.id,
      error: {
        code: "provider_error",
        message: "All selected models failed. Check your API keys and provider model IDs.",
      },
    });
    return;
  }

  await input.onEvent({
    type: "synthesis_started",
    query_id: input.query.id,
  });

  const synthesized = await buildFinancialSynthesis({
    userId: input.userId,
    query: input.query,
    responses: successful,
  });

  const synthesisRecord = await persistSynthesis(input.query.id, synthesized);

  await admin
    .from("research_queries")
    .update({
      status: "complete",
      completed_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", input.query.id);

  await input.onEvent({
    type: "synthesis_ready",
    query_id: input.query.id,
    synthesis: synthesisRecord.synthesis,
    financial_synthesis: synthesisRecord.financial_synthesis,
  });

  await input.onEvent({
    type: "done",
    query_id: input.query.id,
  });
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

  if (error) {
    throw error;
  }
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

  if (error) {
    throw error;
  }

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
        (response) =>
          `Provider ${response.provider_id} / ${response.model_id}:\n${response.text ?? ""}`,
      ),
      openWebContext ? `Open-web citations:\n${openWebContext.citations
        .slice(0, 12)
        .map((citation) => `- ${citation.source}: ${citation.title} (${citation.url})`)
        .join("\n")}` : null,
    ].join("\n\n");

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

function buildFallbackFinancialSynthesis(query: ResearchQueryRecord, responses: ModelResponseOut[]): FinancialSynthesis {
  const openWebContext = query.options.open_web_context ?? null;
  const excerpts = responses
    .map((response) => (response.text ?? "").split(/\n+/).find(Boolean)?.trim())
    .filter(Boolean)
    .slice(0, 3) as string[];

  return {
    ticker: query.options.ticker ?? undefined,
    summary:
      excerpts.join(" ") ||
      openWebContext?.company_overview[0] ||
      "Research completed successfully.",
    consensus: excerpts.slice(0, 3).map((claim, index) => ({
      id: `consensus-${index + 1}`,
      claim,
      supporting_models: responses.slice(0, 2).map((response) => `${response.provider_id}:${response.model_id}`),
      confidence: 0.6,
    })),
    disagreements: [],
    unique_insights: responses.slice(0, 4).map((response, index) => ({
      id: `insight-${index + 1}`,
      insight: (response.text ?? "").slice(0, 220),
      provider_id: response.provider_id,
      model_id: response.model_id,
    })),
    citations: (openWebContext?.citations ?? []).slice(0, 8).map((citation, index) => ({
      id: `citation-${index + 1}`,
      title: citation.title,
      url: citation.url,
      snippet: citation.source,
      claim_ids: [],
    })),
    confidence_score: {
      consensus_agreement: 0.6,
      bullish_confidence: 0.55,
      bearish_confidence: 0.45,
    },
    investment_thesis:
      excerpts[0] ??
      openWebContext?.company_overview[0] ??
      "Further evidence needed before conviction increases.",
    key_risks:
      openWebContext?.sec_risks.length
        ? openWebContext.sec_risks.slice(0, 4)
        : excerpts[1]
          ? [excerpts[1]]
          : [],
    bullish_theses: responses.slice(0, 2).map((response, index) => ({
      id: `bull-${index + 1}`,
      title: `${response.provider_id} upside case`,
      confidence: 0.6,
      supporting_points: [(response.text ?? "").slice(0, 180)],
      growth_catalysts: [],
      valuation_opportunities: [],
      provider_id: response.provider_id,
      model_id: response.model_id,
    })),
    bearish_theses: responses.slice(0, 2).map((response, index) => ({
      id: `bear-${index + 1}`,
      title: `${response.provider_id} risk case`,
      confidence: 0.45,
      supporting_points: [(response.text ?? "").slice(0, 180)],
      risks: [],
      valuation_concerns: [],
      macro_threats: [],
      provider_id: response.provider_id,
      model_id: response.model_id,
    })),
    consensus_points: excerpts.slice(0, 3).map((point, index) => ({
      id: `point-${index + 1}`,
      point,
      supporting_providers: responses.map((response) => response.provider_id),
      confidence: 0.6,
      evidence_strength: "medium",
    })),
    contradictions: [],
    investment_score: 0.2,
    key_questions:
      openWebContext?.news.slice(0, 2).map((item) => `Validate: ${item}`) ?? [],
    next_research_areas: [
      ...(openWebContext?.macro.length ? ["Track macro series changes from FRED overlays."] : []),
      ...(openWebContext?.reddit.length ? ["Watch sentiment shifts across investing communities."] : []),
    ],
  };
}

function mergeFinancialSynthesis(base: FinancialSynthesis, patch: Partial<FinancialSynthesis>): FinancialSynthesis {
  return {
    ...base,
    ...patch,
    confidence_score: {
      ...base.confidence_score,
      ...patch.confidence_score,
    },
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
    next_research_areas: Array.isArray(patch.next_research_areas)
      ? patch.next_research_areas
      : base.next_research_areas,
  };
}

function parseJsonObject<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("No JSON object found");
  }
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
