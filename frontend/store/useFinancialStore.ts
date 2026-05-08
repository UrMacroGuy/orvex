"use client";

import { create } from "zustand";
import { StreamEvent, StockData, FinancialSynthesis, MarketSnapshot } from "@/types/financial";

export interface ModelResponse {
  provider_id: string;
  model_id: string;
  text: string;
  latency_ms: number;
  is_streaming: boolean;
  error?: string;
}

interface FinancialStore {
  selectedTicker: string;
  activePanels: string[];
  stockData: StockData | null;
  marketSnapshot: MarketSnapshot | null;
  synthesis: FinancialSynthesis | null;
  streamingResponses: Record<string, ModelResponse>;
  isLoading: boolean;
  error: string | null;

  setSelectedTicker: (ticker: string) => void;
  togglePanel: (panelId: string) => void;
  setStockData: (data: StockData) => void;
  setMarketSnapshot: (data: MarketSnapshot) => void;
  setSynthesis: (data: FinancialSynthesis) => void;
  addStreamEvent: (event: StreamEvent) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  selectedTicker: "",
  activePanels: ["bullish", "bearish", "earnings", "news"],
  stockData: null,
  marketSnapshot: null,
  synthesis: null,
  streamingResponses: {},
  isLoading: false,
  error: null,
};

function streamResponseKey(providerId?: string, modelId?: string) {
  return `${providerId ?? ""}:${modelId ?? ""}`;
}

export const useFinancialStore = create<FinancialStore>((set) => ({
  ...initialState,

  setSelectedTicker: (ticker) => set({ selectedTicker: ticker.toUpperCase() }),

  togglePanel: (panelId) =>
    set((state) => ({
      activePanels: state.activePanels.includes(panelId)
        ? state.activePanels.filter((p) => p !== panelId)
        : [...state.activePanels, panelId],
    })),

  setStockData: (data) => set({ stockData: data }),
  setMarketSnapshot: (data) => set({ marketSnapshot: data }),
  setSynthesis: (data) => set({ synthesis: data }),

  addStreamEvent: (event) =>
    set((state) => {
      // ── New query: wipe previous run's data ──────────────────────────────
      if (event.type === "query_started") {
        return { streamingResponses: {}, synthesis: null, error: null };
      }

      // ── Model lifecycle ──────────────────────────────────────────────────
      if (event.type === "model_started") {
        const key = streamResponseKey(event.provider_id, event.model_id);
        return {
          streamingResponses: {
            ...state.streamingResponses,
            [key]: {
              provider_id: event.provider_id ?? "",
              model_id: event.model_id ?? "",
              text: "",
              latency_ms: 0,
              is_streaming: true,
            },
          },
        };
      }

      if (event.type === "model_delta") {
        const key = streamResponseKey(event.provider_id, event.model_id);
        const existing = state.streamingResponses[key];
        return {
          streamingResponses: {
            ...state.streamingResponses,
            [key]: {
              ...existing,
              provider_id: existing?.provider_id ?? event.provider_id ?? "",
              model_id: existing?.model_id ?? event.model_id ?? "",
              text: (existing?.text ?? "") + (event.delta ?? ""),
              latency_ms: existing?.latency_ms ?? 0,
              is_streaming: true,
            },
          },
        };
      }

      if (event.type === "model_completed" && event.response) {
        const r = event.response;
        const key = streamResponseKey(r.provider_id, r.model_id);
        return {
          streamingResponses: {
            ...state.streamingResponses,
            [key]: {
              provider_id: r.provider_id,
              model_id: r.model_id,
              text: r.text ?? state.streamingResponses[key]?.text ?? "",
              latency_ms: r.latency_ms ?? 0,
              is_streaming: false,
            },
          },
        };
      }

      // ── Model failure (missing key, rate limit, provider error) ──────────
      if (event.type === "model_failed") {
        const key = streamResponseKey(event.provider_id, event.model_id);
        return {
          streamingResponses: {
            ...state.streamingResponses,
            [key]: {
              provider_id: event.provider_id ?? "",
              model_id: event.model_id ?? "",
              text: "",
              latency_ms: 0,
              is_streaming: false,
              error: event.error?.message ?? "Model failed",
            },
          },
        };
      }

      // ── Pipeline-level error ──────────────────────────────────────────────
      if (event.type === "error") {
        const msg = event.error?.message ?? "An error occurred";
        // Surface friendly message for common error cases
        const friendly = msg.includes("no API key configured")
          ? `${msg} — add it in Settings → API Keys`
          : msg;
        return { error: friendly, isLoading: false };
      }

      // ── Synthesis ─────────────────────────────────────────────────────────
      if (event.type === "synthesis_ready") {
        if (event.financial_synthesis) {
          return { synthesis: event.financial_synthesis };
        }
        if (event.synthesis) {
          const s = event.synthesis;
          return {
            synthesis: {
              summary: s.summary,
              consensus: s.consensus,
              disagreements: s.disagreements,
              unique_insights: s.unique_insights,
              citations: s.citations,
              confidence_score: {
                consensus_agreement: 0,
                bullish_confidence: 0,
                bearish_confidence: 0,
              },
              investment_thesis: "",
              key_risks: [],
              bullish_theses: [],
              bearish_theses: [],
              consensus_points: [],
              contradictions: [],
              investment_score: 0,
              key_questions: [],
              next_research_areas: [],
            },
          };
        }
      }

      return state;
    }),

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
