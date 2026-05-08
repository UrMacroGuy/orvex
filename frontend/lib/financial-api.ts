/**
 * Financial research API client.
 *
 * POST /api/v1/financial/research
 * GET /api/v1/financial/research/{query_id}/stream
 */
import api from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { API_BASE_URL } from "@/lib/env";
import { FinancialQuery, StreamEvent } from "@/types/financial";

function serializeSelectedModels(selectedModels: FinancialQuery["selected_models"]) {
  return selectedModels.map(({ provider_id, model_id }) => [provider_id, model_id]);
}

export const financialApi = {
  async createResearch(query: FinancialQuery) {
    try {
      const response = await api.post("/financial/research", {
        query: query.query,
        selected_models: serializeSelectedModels(query.selected_models),
        research_type: query.research_type,
        ticker: query.ticker,
        company_name: query.company_name,
        time_horizon: query.time_horizon,
        web_research: query.web_research ?? false,
      });
      return response.data.data as { id: string };
    } catch (error) {
      console.error("Failed to create research:", error);
      throw error;
    }
  },

  async getTickerData(ticker: string) {
    try {
      const response = await api.get(`/financial/ticker/${ticker}`);
      return response.data.data;
    } catch (error) {
      console.error(`Failed to fetch ticker data for ${ticker}:`, error);
      throw error;
    }
  },

  async getMarketSnapshot() {
    try {
      const response = await api.get("/financial/market");
      return response.data.data;
    } catch (error) {
      console.error("Failed to fetch market snapshot:", error);
      throw error;
    }
  },

  subscribeToStream(
    queryId: string,
    onEvent: (event: StreamEvent) => void,
    signal: AbortSignal,
  ) {
    const token = useAuthStore.getState().token;
    const url = `${API_BASE_URL}/api/v1/financial/research/${queryId}/stream`;

    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          console.error("Stream connection failed:", res.statusText);
          return;
        }
        if (!res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";
          for (const chunk of chunks) {
            const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
            if (!dataLine) continue;
            try {
              const event = JSON.parse(dataLine.slice(5).trim()) as StreamEvent;
              onEvent(event);
            } catch (e) {
              console.error("Failed to parse stream event:", e);
            }
          }
        }
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name !== "AbortError") {
          console.error("Stream error", err);
        }
      });
  },
};
