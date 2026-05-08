import { searchYahooTickers } from "@/lib/server/providers/yahoo";
import type { FinancialQuery } from "@/types/financial";

export interface IntelligenceEntity {
  name: string;
  symbol?: string;
  exchange?: string;
  kind: "company" | "ticker" | "market" | "commodity" | "theme" | "macro";
  confidence: number;
}

export interface IntelligencePlan {
  query: string;
  normalized_query: string;
  primary_intent:
    | "earnings"
    | "macro"
    | "company"
    | "comparison"
    | "geopolitics"
    | "sector"
    | "commodity"
    | "market"
    | "general";
  research_type: FinancialQuery["research_type"];
  themes: string[];
  regions: string[];
  entities: IntelligenceEntity[];
  focus_terms: string[];
  source_plan: string[];
  company_name?: string;
  resolved_symbol?: string;
}

const REGION_KEYWORDS: Record<string, string[]> = {
  us: ["us", "u.s.", "america", "american", "fed", "nasdaq", "s&p", "dow"],
  india: ["india", "indian", "rbi", "nifty", "sensex", "tata", "reliance", "adani", "nse", "bse", "hdfc", "tcs", "vedl"],
  europe: ["europe", "euro", "ecb", "germany", "france", "uk", "european"],
  china: ["china", "chinese", "beijing", "taiwan", "tsmc", "trade war", "hsi"],
  japan: ["japan", "japanese", "boj", "nikkei", "toyota"],
  middle_east: ["middle east", "gulf", "opec", "saudi", "uae", "israel", "qatar"],
};

// Add exchange-specific resolution
async function resolveGlobalEntity(query: string) {
  // Mock NSE/BSE lookup logic
  if (query.toUpperCase().includes("HDFC")) return { symbol: "HDFCBANK.NS", name: "HDFC Bank Ltd", exchange: "NSE" };
  if (query.toUpperCase().includes("VEDL")) return { symbol: "VEDL.NS", name: "Vedanta Ltd", exchange: "NSE" };
  if (query.toUpperCase().includes("TCS")) return { symbol: "TCS.NS", name: "Tata Consultancy Services", exchange: "NSE" };
  if (query.toUpperCase().includes("RELIANCE")) return { symbol: "RELIANCE.NS", name: "Reliance Industries", exchange: "NSE" };
  return null;
}


const THEME_KEYWORDS: Record<string, string[]> = {
  earnings: ["earnings", "guidance", "quarter", "eps", "revenue", "results", "transcript"],
  rates: ["rate", "rates", "fed", "ecb", "rbi", "yield", "bond", "treasury"],
  banking: ["bank", "banks", "lender", "financials", "credit"],
  oil: ["oil", "crude", "brent", "wti", "energy", "opec"],
  trade: ["tariff", "trade", "sanction", "geopolitic", "export", "import"],
  ai: ["ai", "artificial intelligence", "semiconductor", "gpu", "chip", "datacenter"],
  auto: ["auto", "autos", "ev", "vehicle", "tesla", "motors"],
  airlines: ["airline", "airlines", "carrier", "jet fuel", "travel"],
  macro: ["inflation", "gdp", "cpi", "unemployment", "macro", "economy", "recession"],
  sentiment: ["sentiment", "positioning", "reddit", "reaction"],
};

const STOP_TERMS = new Set([
  "should", "i", "buy", "after", "how", "will", "what", "happens", "if", "why",
  "is", "despite", "strong", "compare", "vs", "long", "term", "the", "and", "to",
  "of", "for", "with", "affect", "falling", "worsen", "cuts",
]);

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function pickIntent(themes: string[], query: FinancialQuery["query"]): IntelligencePlan["primary_intent"] {
  const lower = query.toLowerCase();
  if (themes.includes("earnings")) return "earnings";
  if (themes.includes("oil")) return "commodity";
  if (themes.includes("trade")) return "geopolitics";
  if (themes.includes("macro") || themes.includes("rates")) return "macro";
  if (lower.includes("compare ") || lower.includes(" vs ")) return "comparison";
  if (themes.includes("banking") || themes.includes("ai") || themes.includes("airlines")) return "sector";
  return "company";
}

function extractThemes(query: string) {
  const lower = query.toLowerCase();
  return Object.entries(THEME_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => lower.includes(keyword)))
    .map(([theme]) => theme);
}

function extractRegions(query: string) {
  const lower = query.toLowerCase();
  const hits = Object.entries(REGION_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => lower.includes(keyword)))
    .map(([region]) => region);
  return hits.length > 0 ? hits : ["global"];
}

function extractFocusTerms(query: string, themes: string[], regions: string[]) {
  const tokens = query
    .replace(/[^\w\s.&/-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2)
    .filter((token) => !STOP_TERMS.has(token.toLowerCase()));

  return unique([...themes, ...regions, ...tokens]).slice(0, 12);
}

function buildSourcePlan(intent: IntelligencePlan["primary_intent"], themes: string[], regions: string[]) {
  const plan = ["Yahoo Finance", "Reuters/CNBC/MarketWatch RSS", "Reddit sentiment"];

  if (intent === "earnings") plan.push("earnings events", "guidance and reaction news");
  if (themes.includes("macro") || themes.includes("rates") || themes.includes("banking")) plan.push("FRED macro series");
  if (regions.includes("india")) plan.push("RBI releases", "India market proxies");
  if (regions.includes("europe")) plan.push("ECB releases", "Europe market proxies");
  if (regions.includes("china") || themes.includes("trade")) plan.push("China/tariff news", "Asia supply-chain proxies");
  if (themes.includes("oil")) plan.push("commodity proxies", "energy/airline cross-asset quotes");
  if (regions.includes("global") || themes.includes("macro")) plan.push("IMF/World Bank context");

  return unique(plan);
}

async function resolvePrimaryEntity(query: FinancialQuery, focusTerms: string[]) {
  const seededSymbol = query.ticker?.trim().toUpperCase();
  if (seededSymbol) {
    return {
      companyName: query.company_name?.trim(),
      symbol: seededSymbol,
      entities: [{
        name: query.company_name?.trim() || seededSymbol,
        symbol: seededSymbol,
        kind: "ticker",
        confidence: 0.98,
      }] satisfies IntelligenceEntity[],
    };
  }

  // Global entity resolution
  const globalMatch = await resolveGlobalEntity(query.query);
  if (globalMatch) {
    return {
      companyName: globalMatch.name,
      symbol: globalMatch.symbol,
      entities: [{
        name: globalMatch.name,
        symbol: globalMatch.symbol,
        kind: "company",
        confidence: 0.95,
      }] satisfies IntelligenceEntity[],
    };
  }

  const searchTerms = unique([
    query.company_name?.trim() ?? "",
    focusTerms.slice(0, 5).join(" "),
    query.query,
  ]).filter((term) => term.length >= 3);

  for (const term of searchTerms) {
    const matches = await searchYahooTickers(term, 5).catch(() => []);
    const best = matches[0];
    if (!best?.symbol) continue;

    return {
      companyName: best.description,
      symbol: best.symbol,
      entities: [{
        name: best.description,
        symbol: best.symbol,
        kind: "company",
        confidence: 0.75,
      }] satisfies IntelligenceEntity[],
    };
  }

  return {
    companyName: query.company_name?.trim(),
    symbol: undefined,
    entities: [] as IntelligenceEntity[],
  };
}

export async function analyzeFinancialQuery(query: FinancialQuery): Promise<IntelligencePlan> {
  const normalizedQuery = query.query.trim().replace(/\s+/g, " ");
  const themes = unique([
    ...extractThemes(normalizedQuery),
    ...(query.research_type === "macro" ? ["macro"] : []),
    ...(query.research_type === "earnings" ? ["earnings"] : []),
    ...(query.research_type === "sector" ? ["sector"] : []),
    ...(query.research_type === "thematic" ? ["ai", "trade", "macro"] : []),
  ]);
  const regions = extractRegions(normalizedQuery);
  const focusTerms = extractFocusTerms(normalizedQuery, themes, regions);
  const entityResolution = await resolvePrimaryEntity(query, focusTerms);
  const primaryIntent = pickIntent(themes, normalizedQuery);

  return {
    query: query.query,
    normalized_query: normalizedQuery,
    primary_intent: primaryIntent,
    research_type: query.research_type,
    themes,
    regions,
    focus_terms: focusTerms,
    source_plan: buildSourcePlan(primaryIntent, themes, regions),
    company_name: entityResolution.companyName,
    resolved_symbol: entityResolution.symbol,
    entities: entityResolution.entities,
  };
}
