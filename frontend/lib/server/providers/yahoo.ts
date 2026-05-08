import type { CompanyProfile, EarningsData, QuoteData, TickerLookup } from "@/lib/server/providers/market";
import type { MarketSnapshot } from "@/types/financial";

interface YahooQuoteSummaryResult {
  price?: {
    symbol?: string;
    shortName?: string;
    longName?: string;
    exchangeName?: string;
    regularMarketPrice?: { raw?: number };
    regularMarketDayHigh?: { raw?: number };
    regularMarketDayLow?: { raw?: number };
    regularMarketVolume?: { raw?: number };
    regularMarketChangePercent?: { raw?: number };
    marketCap?: { raw?: number };
  };
  assetProfile?: {
    longBusinessSummary?: string;
    industry?: string;
    sector?: string;
    website?: string;
  };
  calendarEvents?: {
    earnings?: {
      earningsDate?: Array<{ raw?: number }>;
    };
  };
  defaultKeyStatistics?: {
    trailingEps?: { raw?: number };
  };
  financialData?: {
    currentPrice?: { raw?: number };
    targetMeanPrice?: { raw?: number };
    recommendationKey?: string;
  };
}

async function yahooFetch<T>(url: string, revalidate = 900): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Orvex/1.0",
      Accept: "application/json",
    },
    next: { revalidate },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function getQuoteSummary(symbol: string): Promise<YahooQuoteSummaryResult | null> {
  const data = await yahooFetch<{
    quoteSummary?: { result?: YahooQuoteSummaryResult[] };
  }>(
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=price,assetProfile,calendarEvents,defaultKeyStatistics,financialData`,
  );

  return data.quoteSummary?.result?.[0] ?? null;
}

export async function searchYahooTickers(query: string, limit: number): Promise<TickerLookup[]> {
  const data = await yahooFetch<{
    quotes?: Array<{ symbol?: string; shortname?: string; longname?: string }>;
  }>(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=${Math.max(limit, 5)}&newsCount=0`,
  );

  return (data.quotes ?? [])
    .filter((item) => item.symbol)
    .slice(0, limit)
    .map((item) => ({
      symbol: String(item.symbol),
      description: String(item.longname ?? item.shortname ?? item.symbol ?? ""),
    }));
}

export async function getYahooQuote(symbol: string): Promise<QuoteData | null> {
  const data = await yahooFetch<{
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number;
          previousClose?: number;
        };
        indicators?: {
          quote?: Array<{
            high?: Array<number | null>;
            low?: Array<number | null>;
            volume?: Array<number | null>;
          }>;
        };
      }>;
    };
  }>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`,
    300,
  );

  const chart = data.chart?.result?.[0];
  const meta = chart?.meta;

  if (!meta?.regularMarketPrice) {
    return null;
  }

  const quote = chart?.indicators?.quote?.[0];
  const highs = (quote?.high ?? []).filter((value): value is number => typeof value === "number");
  const lows = (quote?.low ?? []).filter((value): value is number => typeof value === "number");
  const volumes = (quote?.volume ?? []).filter((value): value is number => typeof value === "number");
  const previousClose = meta.previousClose ?? meta.regularMarketPrice;

  return {
    symbol,
    current_price: meta.regularMarketPrice,
    change_percent: previousClose
      ? ((meta.regularMarketPrice - previousClose) / previousClose) * 100
      : 0,
    high_price: highs.length > 0 ? Math.max(...highs) : null,
    low_price: lows.length > 0 ? Math.min(...lows) : null,
    volume: volumes.length > 0 ? volumes[volumes.length - 1] : null,
  };
}

export async function getYahooCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
  const summary = await getQuoteSummary(symbol);
  const price = summary?.price;

  if (!price?.symbol) {
    return null;
  }

  return {
    symbol: String(price.symbol),
    company_name: String(price.longName ?? price.shortName ?? price.symbol),
    exchange: price.exchangeName ?? null,
    industry: summary?.assetProfile?.industry ?? null,
    sector: summary?.assetProfile?.sector ?? null,
    website: summary?.assetProfile?.website ?? null,
    market_cap: price.marketCap?.raw ?? null,
    description: summary?.assetProfile?.longBusinessSummary ?? null,
  };
}

export async function getYahooEarnings(symbol: string, limit: number): Promise<EarningsData[]> {
  const summary = await getQuoteSummary(symbol);
  const dates = summary?.calendarEvents?.earnings?.earningsDate ?? [];

  return dates.slice(0, limit).map((date, index) => ({
    date: new Date((date.raw ?? 0) * 1000).toISOString(),
    eps_actual: index === 0 ? summary?.defaultKeyStatistics?.trailingEps?.raw ?? null : null,
    eps_estimate: null,
    revenue_actual: null,
    revenue_estimate: null,
    surprise_percent: null,
  }));
}

export async function getYahooMarketSnapshot(): Promise<MarketSnapshot> {
  const data = await yahooFetch<{
    quoteResponse?: {
      result?: Array<{
        symbol?: string;
        shortName?: string;
        regularMarketPrice?: number;
        regularMarketChangePercent?: number;
      }>;
    };
  }>(
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=SPY,QQQ,DIA,IWM,^VIX,^TNX",
    300,
  );

  const result = data.quoteResponse?.result ?? [];

  return {
    indices: result.slice(0, 4).map((item) => ({
      symbol: String(item.symbol ?? ""),
      name: String(item.shortName ?? item.symbol ?? ""),
      price: Number(item.regularMarketPrice ?? 0),
      change_percent: Number(item.regularMarketChangePercent ?? 0),
    })),
    top_gainers: [],
    top_losers: [],
    sector_performance: [
      {
        sector: "Volatility",
        change_percent: Number(result.find((item) => item.symbol === "^VIX")?.regularMarketChangePercent ?? 0),
        top_performer: "VIX",
      },
      {
        sector: "10Y Yield",
        change_percent: Number(result.find((item) => item.symbol === "^TNX")?.regularMarketChangePercent ?? 0),
        top_performer: "US10Y",
      },
    ],
  };
}

export async function getYahooAnalystSummary(symbol: string) {
  const summary = await getQuoteSummary(symbol);
  const price = summary?.price;
  const financialData = summary?.financialData;

  if (!price?.symbol) {
    return null;
  }

  return {
    symbol: String(price.symbol),
    current_price: price.regularMarketPrice?.raw ?? financialData?.currentPrice?.raw ?? null,
    target_price: financialData?.targetMeanPrice?.raw ?? null,
    recommendation: financialData?.recommendationKey ?? null,
  };
}
