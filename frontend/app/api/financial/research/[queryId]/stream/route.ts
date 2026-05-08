import { requireAuthenticatedUser } from "@/lib/server/auth";
import {
  executeResearchQuery,
  getResearchResult,
  getResearchQuery,
  transitionQueryToRunning,
  type StreamEventPayload,
} from "@/lib/server/research";
import type { ModelResponseOut } from "@/types/financial";

export const runtime = "nodejs";

function ssePayload(event: StreamEventPayload) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ queryId: string }> },
) {
  const user = await requireAuthenticatedUser();
  const { queryId } = await context.params;
  const query = await getResearchQuery(user.id, queryId);

  if (!query) {
    return new Response("query not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = async (event: StreamEventPayload) => {
        controller.enqueue(encoder.encode(ssePayload(event)));
      };

      try {
        if (query.status === "complete" || query.status === "failed") {
          const existing = await getResearchResult(user.id, queryId);
          if (existing) {
            await send({ type: "query_started", query_id: queryId });
            existing.responses.forEach((response: ModelResponseOut) => {
              controller.enqueue(
                encoder.encode(
                  ssePayload({
                    type: response.status === "ok" ? "model_completed" : "model_failed",
                    query_id: queryId,
                    provider_id: response.provider_id,
                    model_id: response.model_id,
                    response: response.status === "ok" ? response : undefined,
                    error:
                      response.status === "ok"
                        ? undefined
                        : { code: "provider_error", message: response.error ?? "Provider failed" },
                  }),
                ),
              );
            });
            if (existing.synthesis || existing.financial_synthesis) {
              await send({
                type: "synthesis_ready",
                query_id: queryId,
                synthesis: existing.synthesis ?? undefined,
                financial_synthesis: existing.financial_synthesis ?? undefined,
              });
            }
            await send({
              type: query.status === "complete" ? "done" : "error",
              query_id: queryId,
              error:
                query.status === "failed"
                  ? { code: "pipeline_failed", message: query.error ?? "Query failed" }
                  : undefined,
            });
          }
          controller.close();
          return;
        }

        const transitioned = await transitionQueryToRunning(user.id, queryId);
        if (!transitioned && query.status === "running") {
          const existing = await getResearchResult(user.id, queryId);
          if (existing?.responses) {
            await send({ type: "query_started", query_id: queryId });
            existing.responses.forEach((response: ModelResponseOut) => {
              controller.enqueue(
                encoder.encode(
                  ssePayload({
                    type: response.status === "ok" ? "model_completed" : "model_failed",
                    query_id: queryId,
                    provider_id: response.provider_id,
                    model_id: response.model_id,
                    response: response.status === "ok" ? response : undefined,
                    error:
                      response.status === "ok"
                        ? undefined
                        : { code: "provider_error", message: response.error ?? "Provider failed" },
                  }),
                ),
              );
            });
          }
          controller.close();
          return;
        }

        await executeResearchQuery({
          userId: user.id,
          query: transitioned ?? query,
          onEvent: send,
        });
      } catch (error) {
        await send({
          type: "error",
          query_id: queryId,
          error: {
            code: "internal",
            message: error instanceof Error ? error.message : "Streaming failed",
          },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
