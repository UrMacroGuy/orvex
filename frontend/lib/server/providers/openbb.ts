/**
 * OpenBB integration for institutional-grade financial data.
 * Used for: market aggregation, macro, options, financial statements, crypto.
 */

export interface OpenBBResult {
  data: Record<string, unknown>;
  error?: string;
}

async function openBbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  // Mock endpoint structure for implementation
  const url = new URL(`https://api.openbb.co/v1/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

  const response = await fetch(url.toString(), {
    headers: {
      "Authorization": `Bearer ${process.env.OPENBB_API_KEY}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`OpenBB request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getOpenBBFinancials(symbol: string): Promise<Record<string, unknown> | null> {
  try {
    return await openBbFetch<Record<string, unknown>>(`equity/fundamentals/balance?symbol=${symbol}`);
  } catch {
    return null;
  }
}

export async function getOpenBBMacro(indicator: string): Promise<Record<string, unknown> | null> {
  try {
    return await openBbFetch<Record<string, unknown>>(`macro/indicators/${indicator}`);
  } catch {
    return null;
  }
}
