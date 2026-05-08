import type { MarketSnapshot } from "@/types/financial";
import {
  getYahooCompanyProfile,
  getYahooEarnings,
  getYahooExtendedQuote,
  getYahooMarketSnapshot,
  searchYahooTickers,
} from "@/lib/server/providers/yahoo";

export interface TickerLookup {
  symbol: string;
  description: string;
}

export interface QuoteData {
  symbol: string;
  current_price: number;
  change_percent: number;
  high_price?: number | null;
  low_price?: number | null;
  volume?: number | null;
  market_cap?: number | null;
  pe_ratio?: number | null;
  fifty_two_week_high?: number | null;
  fifty_two_week_low?: number | null;
  after_hours_price?: number | null;
  after_hours_change_percent?: number | null;
}

export interface CompanyProfile {
  symbol: string;
  company_name: string;
  exchange?: string | null;
  industry?: string | null;
  sector?: string | null;
  website?: string | null;
  market_cap?: number | null;
  description?: string | null;
}

export interface EarningsData {
  date: string;
  eps_actual?: number | null;
  eps_estimate?: number | null;
  revenue_actual?: number | null;
  revenue_estimate?: number | null;
  surprise_percent?: number | null;
}

type ProviderName = "finnhub" | "polygon" | "alpha_vantage" | "fmp";

function getConfiguredMarketProvider(): ProviderName | null {
  if (process.env.FINNHUB_API_KEY) return "finnhub";
  if (process.env.POLYGON_API_KEY) return "polygon";
  if (process.env.ALPHA_VANTAGE_API_KEY) return "alpha_vantage";
  if (process.env.FMP_API_KEY) return "fmp";
  return null;
}

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Market provider request failed: ${response.status}`);
  }
  return response.json();
}

async function finnhubSearch(query: string, limit: number): Promise<TickerLookup[]> {
  const data = await fetchJson(
    `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${process.env.FINNHUB_API_KEY}`,
  );
  return (data.result ?? []).slice(0, limit).map((item: Record<string, unknown>) => ({
    symbol: String(item.symbol ?? ""),
    description: String(item.description ?? item.displaySymbol ?? ""),
  }));
}

async function finnhubQuote(symbol: string): Promise<QuoteData | null> {
  const data = await fetchJson(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${process.env.FINNHUB_API_KEY}`,
  );
  if (!data?.c) return null;
  const previousClose = Number(data.pc ?? data.c);
  const current = Number(data.c);
  return {
    symbol,
    current_price: current,
    change_percent: previousClose ? ((current - previousClose) / previousClose) * 100 : 0,
    high_price: Number(data.h ?? 0) || null,
    low_price: Number(data.l ?? 0) || null,
    volume: null,
  };
}

async function finnhubCompany(symbol: string): Promise<CompanyProfile | null> {
  const data = await fetchJson(
    `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${process.env.FINNHUB_API_KEY}`,
  );
  if (!data?.ticker) return null;
  return {
    symbol: String(data.ticker),
    company_name: String(data.name ?? data.ticker),
    exchange: data.exchange ?? null,
    industry: data.finnhubIndustry ?? null,
    sector: null,
    website: data.weburl ?? null,
    market_cap: Number(data.marketCapitalization ?? 0) || null,
    description: null,
  };
}

async function finnhubEarnings(symbol: string, limit: number): Promise<EarningsData[]> {
  const data = await fetchJson(
    `https://finnhub.io/api/v1/stock/earnings?symbol=${encodeURIComponent(symbol)}&token=${process.env.FINNHUB_API_KEY}`,
  );
  return (data ?? []).slice(0, limit).map((item: Record<string, unknown>) => ({
    date: String(item.period ?? item.date ?? ""),
    eps_actual: Number(item.actual ?? 0) || null,
    eps_estimate: Number(item.estimate ?? 0) || null,
    revenue_actual: null,
    revenue_estimate: null,
    surprise_percent: Number(item.surprisePercent ?? 0) || null,
  }));
}

async function finnhubMarketSnapshot(): Promise<MarketSnapshot> {
  const symbols = [
    { symbol: "SPY", name: "S&P 500" },
    { symbol: "QQQ", name: "NASDAQ 100" },
    { symbol: "DIA", name: "Dow Jones" },
  ];

  const quotes = await Promise.all(symbols.map(({ symbol }) => finnhubQuote(symbol)));

  return {
    indices: symbols.map((index, idx) => ({
      symbol: index.symbol,
      name: index.name,
      price: quotes[idx]?.current_price ?? 0,
      change_percent: quotes[idx]?.change_percent ?? 0,
    })),
    top_gainers: [],
    top_losers: [],
    sector_performance: [],
  };
}

export async function searchTickers(query: string, limit: number) {
  const provider = getConfiguredMarketProvider();
  if (provider === "finnhub") return finnhubSearch(query, limit);
  return searchYahooTickers(query, limit);
}

export async function getQuote(symbol: string): Promise<QuoteData | null> {
  const provider = getConfiguredMarketProvider();

  if (provider === "finnhub") {
    const quote = await finnhubQuote(symbol);
    if (quote) return quote;
  }

  return getYahooExtendedQuote(symbol);
}

export async function getCompanyProfile(symbol: string) {
  const provider = getConfiguredMarketProvider();

  if (provider === "finnhub") {
    const company = await finnhubCompany(symbol);
    if (company) return company;
  }

  return getYahooCompanyProfile(symbol);
}

export async function getEarnings(symbol: string, limit: number) {
  const provider = getConfiguredMarketProvider();

  if (provider === "finnhub") {
    const earnings = await finnhubEarnings(symbol, limit);
    if (earnings.length > 0) return earnings;
  }

  return getYahooEarnings(symbol, limit);
}

export async function getMarketSnapshot() {
  const provider = getConfiguredMarketProvider();
  if (provider === "finnhub") return finnhubMarketSnapshot();
  return getYahooMarketSnapshot();
}
