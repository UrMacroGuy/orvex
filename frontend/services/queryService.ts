import { API_BASE_URL } from "@/lib/env";

export const streamQuery = (
  queryId: string,
  onEvent: (event: MessageEvent) => void,
  onError?: (error: Event) => void
) => {
  const url = `${API_BASE_URL}/api/v1/financial/research/${queryId}/stream`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    onEvent(event);
  };

  eventSource.onerror = (error) => {
    console.error("EventSource error for query:", queryId, error);
    if (onError) onError(error);
    eventSource.close();
  };

  return () => eventSource.close();
};
