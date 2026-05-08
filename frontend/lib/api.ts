export interface ApiEnvelope<T> {
  data?: T;
  error?: {
    message: string;
  };
}

export async function apiFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;

  if (!response.ok) {
    throw new Error(payload.error?.message || `Request failed with ${response.status}`);
  }

  if (payload.data === undefined) {
    throw new Error("Malformed API response");
  }

  return payload.data;
}
