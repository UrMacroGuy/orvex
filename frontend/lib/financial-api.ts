import { apiFetch } from "@/lib/api";
import { FinancialQuery, StreamEvent } from "@/types/financial";

export const financialApi = {
  async createResearch(query: FinancialQuery) {
    return apiFetch<{ id: string }>("/api/financial/research", {
      method: "POST",
      body: JSON.stringify(query),
    });
  },

  async getTickerData(ticker: string) {
    return apiFetch(`/api/financial/ticker/${ticker}`);
  },

  async getMarketSnapshot() {
    return apiFetch("/api/financial/market");
  },

  subscribeToStream(
    queryId: string,
    onEvent: (event: StreamEvent) => void,
    signal: AbortSignal,
  ) {
    fetch(`/api/financial/research/${queryId}/stream`, {
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
