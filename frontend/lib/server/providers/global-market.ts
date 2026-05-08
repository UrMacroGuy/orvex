export interface AssetQuote {
  symbol: string;
  name: string;
  price: number;
  change_percent: number;
  currency?: string;
}

export interface GlobalMarketData {
  indices: AssetQuote[];
  commodities: AssetQuote[];
  rates: AssetQuote[];
  crypto: AssetQuote[];
  fetched_at: string;
}

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

async function fetchYahooQuote(symbol: string): Promise<{ price: number; change_percent: number } | null> {
  try {
    const res = await fetch(`${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?interval=1d&range=1d`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Orvex/1.0)",
        Accept: "application/json",
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const price = Number(meta.regularMarketPrice);
    const prev = Number(meta.chartPreviousClose ?? meta.previousClose ?? price);
    const change_percent = prev ? ((price - prev) / prev) * 100 : 0;
    return { price, change_percent };
  } catch {
    return null;
  }
}

interface AssetConfig {
  symbol: string;
  name: string;
  currency?: string;
}

const INDICES: AssetConfig[] = [
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "^IXIC", name: "NASDAQ" },
  { symbol: "^DJI", name: "Dow Jones" },
  { symbol: "^RUT", name: "Russell 2000" },
  { symbol: "^FTSE", name: "FTSE 100" },
  { symbol: "^GDAXI", name: "DAX" },
  { symbol: "^N225", name: "Nikkei 225" },
  { symbol: "^HSI", name: "Hang Seng" },
  { symbol: "^NSEI", name: "Nifty 50" },
  { symbol: "^BSESN", name: "Sensex" },
];

const COMMODITIES: AssetConfig[] = [
  { symbol: "GC=F", name: "Gold", currency: "USD/oz" },
  { symbol: "SI=F", name: "Silver", currency: "USD/oz" },
  { symbol: "CL=F", name: "WTI Crude", currency: "USD/bbl" },
  { symbol: "BZ=F", name: "Brent Crude", currency: "USD/bbl" },
  { symbol: "NG=F", name: "Natural Gas", currency: "USD/MMBtu" },
  { symbol: "HG=F", name: "Copper", currency: "USD/lb" },
  { symbol: "ZW=F", name: "Wheat", currency: "USD/bu" },
  { symbol: "ZC=F", name: "Corn", currency: "USD/bu" },
];

const RATES: AssetConfig[] = [
  { symbol: "^IRX", name: "3M T-Bill", currency: "%" },
  { symbol: "^FVX", name: "5Y Treasury", currency: "%" },
  { symbol: "^TNX", name: "10Y Treasury", currency: "%" },
  { symbol: "^TYX", name: "30Y Treasury", currency: "%" },
  { symbol: "DX-Y.NYB", name: "DXY (Dollar)", currency: "" },
  { symbol: "EURUSD=X", name: "EUR/USD", currency: "" },
  { symbol: "GBPUSD=X", name: "GBP/USD", currency: "" },
  { symbol: "JPY=X", name: "USD/JPY", currency: "" },
];

const CRYPTO: AssetConfig[] = [
  { symbol: "BTC-USD", name: "Bitcoin", currency: "USD" },
  { symbol: "ETH-USD", name: "Ethereum", currency: "USD" },
  { symbol: "SOL-USD", name: "Solana", currency: "USD" },
  { symbol: "BNB-USD", name: "BNB", currency: "USD" },
  { symbol: "XRP-USD", name: "XRP", currency: "USD" },
];

async function fetchGroup(assets: AssetConfig[]): Promise<AssetQuote[]> {
  const results = await Promise.all(
    assets.map(async (asset) => {
      const q = await fetchYahooQuote(asset.symbol).catch(() => null);
      return {
        symbol: asset.symbol,
        name: asset.name,
        price: q?.price ?? 0,
        change_percent: q?.change_percent ?? 0,
        currency: asset.currency,
      } satisfies AssetQuote;
    }),
  );
  return results.filter((r) => r.price > 0);
}

export async function getGlobalMarketData(): Promise<GlobalMarketData> {
  const [indices, commodities, rates, crypto] = await Promise.all([
    fetchGroup(INDICES),
    fetchGroup(COMMODITIES),
    fetchGroup(RATES),
    fetchGroup(CRYPTO),
  ]);

  return {
    indices,
    commodities,
    rates,
    crypto,
    fetched_at: new Date().toISOString(),
  };
}
