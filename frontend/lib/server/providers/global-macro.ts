import { fetchFeedXml, parseFeedItems } from "@/lib/server/providers/rss";
import { getYahooQuotes } from "@/lib/server/providers/yahoo";
import type { IntelligencePlan } from "@/lib/server/providers/intelligence-router";

export interface MacroCitation {
  source: string;
  title: string;
  url: string;
  published_at?: string | null;
}

export interface GlobalMacroContext {
  summary: string[];
  theme_impacts: string[];
  market_proxies: string[];
  citations: MacroCitation[];
}

const REGIONAL_FEEDS = {
  ecb: { source: "ECB", url: "https://www.ecb.europa.eu/rss/press.html" },
  imf: { source: "IMF", url: "https://www.imf.org/en/News/RSS" },
  world_bank: { source: "World Bank", url: "https://www.worldbank.org/en/news/all?format=rss" },
  rbi: { source: "RBI", url: "https://www.rbi.org.in/Scripts/bs_rss.aspx" },
} as const;

const THEME_PROXY_SYMBOLS: Record<string, Array<{ symbol: string; label: string }>> = {
  oil: [
    { symbol: "CL=F", label: "WTI crude" },
    { symbol: "BZ=F", label: "Brent crude" },
    { symbol: "XLE", label: "US energy equities" },
    { symbol: "JETS", label: "Global airlines ETF" },
  ],
  rates: [
    { symbol: "^TNX", label: "US 10Y yield" },
    { symbol: "^FVX", label: "US 5Y yield" },
    { symbol: "KBE", label: "US bank ETF" },
    { symbol: "TLT", label: "Long-duration Treasuries" },
  ],
  banking: [
    { symbol: "KBE", label: "US banks ETF" },
    { symbol: "XLF", label: "US financials ETF" },
    { symbol: "EUFN", label: "Europe financials ETF" },
    { symbol: "INDA", label: "India ETF" },
  ],
  ai: [
    { symbol: "SOXX", label: "Semiconductor ETF" },
    { symbol: "NVDA", label: "Nvidia" },
    { symbol: "TSM", label: "TSMC" },
    { symbol: "ASML", label: "ASML" },
  ],
  airlines: [
    { symbol: "JETS", label: "Global airlines ETF" },
    { symbol: "AAL", label: "American Airlines" },
    { symbol: "DAL", label: "Delta Air Lines" },
    { symbol: "LUV", label: "Southwest" },
  ],
  trade: [
    { symbol: "FXI", label: "China large-cap ETF" },
    { symbol: "MCHI", label: "China broad ETF" },
    { symbol: "INDA", label: "India ETF" },
    { symbol: "EWH", label: "Hong Kong ETF" },
  ],
  macro: [
    { symbol: "SPY", label: "US equities" },
    { symbol: "VEU", label: "Global ex-US equities" },
    { symbol: "DBC", label: "Broad commodities" },
    { symbol: "UUP", label: "US dollar proxy" },
  ],
};

function toPct(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function toTitle(region: string) {
  switch (region) {
    case "us":
      return "US";
    case "india":
      return "India";
    case "europe":
      return "Europe";
    case "china":
      return "China";
    case "japan":
      return "Japan";
    case "middle_east":
      return "Middle East";
    default:
      return "Global";
  }
}

async function fetchRegionalReleases(plan: IntelligencePlan) {
  const feeds = [
    ...(plan.regions.includes("india") ? [REGIONAL_FEEDS.rbi] : []),
    ...(plan.regions.includes("europe") ? [REGIONAL_FEEDS.ecb] : []),
    ...(plan.regions.includes("global") || plan.themes.includes("macro") || plan.themes.includes("trade")
      ? [REGIONAL_FEEDS.imf, REGIONAL_FEEDS.world_bank]
      : []),
  ];

  const settled = await Promise.allSettled(
    feeds.map(async (feed) => {
      const xml = await fetchFeedXml(feed.source, feed.url, 1800);
      return parseFeedItems(feed.source, xml).slice(0, 5);
    }),
  );

  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

function selectProxySymbols(plan: IntelligencePlan) {
  const selected = new Map<string, { symbol: string; label: string }>();
  const themeKeys = plan.themes.length > 0 ? plan.themes : ["macro"];

  for (const theme of themeKeys) {
    for (const proxy of THEME_PROXY_SYMBOLS[theme] ?? []) {
      selected.set(proxy.symbol, proxy);
    }
  }

  if (plan.regions.includes("india")) selected.set("INDA", { symbol: "INDA", label: "India ETF" });
  if (plan.regions.includes("europe")) selected.set("EZU", { symbol: "EZU", label: "Eurozone ETF" });
  if (plan.regions.includes("china")) selected.set("FXI", { symbol: "FXI", label: "China ETF" });
  if (plan.regions.includes("japan")) selected.set("EWJ", { symbol: "EWJ", label: "Japan ETF" });

  return [...selected.values()].slice(0, 8);
}

function buildThemeImpacts(plan: IntelligencePlan) {
  const impacts: string[] = [];

  if (plan.themes.includes("oil") && plan.themes.includes("airlines")) {
    impacts.push("Oil is an input-cost transmission channel for airlines: sustained crude strength usually pressures margins unless fares or hedges offset the move.");
  }
  if (plan.themes.includes("rates") && plan.themes.includes("banking")) {
    impacts.push("Rate cuts can support loan demand but may compress bank net-interest margins if asset yields reset faster than funding costs.");
  }
  if (plan.themes.includes("trade")) {
    impacts.push("Trade or tariff shocks typically hit supply chains first, then flow into volume, pricing, and capex expectations.");
  }
  if (plan.themes.includes("ai")) {
    impacts.push("AI-linked names should be evaluated through the semiconductor stack: compute demand, foundry capacity, memory pricing, and hyperscaler capex discipline.");
  }
  if (impacts.length === 0) {
    impacts.push("Macro interpretation should focus on demand sensitivity, margin pressure, valuation multiple shifts, and cross-border supply-chain exposure.");
  }

  return impacts;
}

export async function getGlobalMacroContext(plan: IntelligencePlan): Promise<GlobalMacroContext> {
  const [regionalReleases, proxies] = await Promise.all([
    fetchRegionalReleases(plan).catch(() => []),
    (async () => {
      const selected = selectProxySymbols(plan);
      if (selected.length === 0) return [];
      const quotes = await getYahooQuotes(selected.map((item) => item.symbol)).catch(() => []);
      return selected.flatMap((item) => {
        const quote = quotes.find((entry) => entry.symbol.toUpperCase() === item.symbol.toUpperCase());
        if (!quote) return [];
        return [`${item.label} (${item.symbol}) ${toPct(quote.change_percent)} at ${quote.current_price.toFixed(2)}.`];
      });
    })(),
  ]);

  const releaseLines = regionalReleases
    .filter((item) => {
      const haystack = `${item.title} ${item.snippet ?? ""}`.toLowerCase();
      return plan.focus_terms.some((term) => haystack.includes(term.toLowerCase()));
    })
    .slice(0, 6)
    .map((item) => `${item.source}: ${item.title}`);

  const regionSummary = plan.regions
    .map((region) => `${toTitle(region)} policy backdrop is part of the query context.`)
    .slice(0, 3);

  return {
    summary: [...regionSummary, ...releaseLines].slice(0, 8),
    theme_impacts: buildThemeImpacts(plan),
    market_proxies: proxies,
    citations: regionalReleases.slice(0, 8).map((item) => ({
      source: item.source,
      title: item.title,
      url: item.url,
      published_at: item.published_at,
    })),
  };
}
