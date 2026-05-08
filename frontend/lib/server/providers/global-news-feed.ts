import { dedupeFeedItems, fetchFeedXml, parseFeedItems } from "@/lib/server/providers/rss";

export interface GlobalNewsItem {
  id: string;
  source: string;
  title: string;
  url: string;
  published_at: string | null;
  snippet: string | null;
  signal: "bullish" | "bearish" | "neutral";
  category: NewsCategory;
}

export type NewsCategory =
  | "all"
  | "macro"
  | "earnings"
  | "commodities"
  | "rates"
  | "crypto"
  | "geopolitics"
  | "tech"
  | "equities"
  | "central-banks";

interface FeedConfig {
  source: string;
  url: string;
  category: NewsCategory;
  revalidate?: number;
}

const GLOBAL_FEEDS: FeedConfig[] = [
  // Broad market
  { source: "Yahoo Finance", url: "https://finance.yahoo.com/rss/topstories", category: "equities", revalidate: 300 },
  { source: "Yahoo Finance News", url: "https://finance.yahoo.com/news/rssindex", category: "equities", revalidate: 300 },
  { source: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", category: "equities", revalidate: 300 },
  { source: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", category: "equities", revalidate: 300 },
  { source: "Reuters Business", url: "https://feeds.reuters.com/reuters/businessNews", category: "macro", revalidate: 300 },
  { source: "Reuters Markets", url: "https://feeds.reuters.com/news/wealth", category: "equities", revalidate: 300 },
  // Tech / AI
  { source: "Seeking Alpha", url: "https://seekingalpha.com/feed.xml", category: "tech", revalidate: 600 },
  { source: "Benzinga", url: "https://feeds2.benzinga.com/benzinga", category: "equities", revalidate: 300 },
  { source: "Investing.com", url: "https://www.investing.com/rss/news.rss", category: "equities", revalidate: 300 },
  { source: "Motley Fool", url: "https://www.fool.com/feeds/index.aspx", category: "equities", revalidate: 600 },
  // Commodities & energy
  { source: "Investing.com Commodities", url: "https://www.investing.com/rss/news_14.rss", category: "commodities", revalidate: 300 },
  { source: "Investing.com Energy", url: "https://www.investing.com/rss/news_25.rss", category: "commodities", revalidate: 300 },
  // Rates & macro
  { source: "Investing.com Bonds", url: "https://www.investing.com/rss/news_95.rss", category: "rates", revalidate: 600 },
  { source: "Investing.com Forex", url: "https://www.investing.com/rss/news_1.rss", category: "rates", revalidate: 600 },
  // Crypto
  { source: "CoinDesk", url: "https://feeds2.feedburner.com/CoinDesk", category: "crypto", revalidate: 300 },
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss", category: "crypto", revalidate: 300 },
];

const BULLISH_WORDS = new Set([
  "beat", "surge", "rally", "strong", "upgrade", "record", "growth", "gain",
  "rise", "jump", "profit", "outperform", "bullish", "breakout", "momentum",
  "positive", "high", "top", "soar", "best", "boom", "expand", "recover",
]);
const BEARISH_WORDS = new Set([
  "miss", "plunge", "fall", "weak", "downgrade", "cut", "decline", "drop",
  "loss", "risk", "warn", "underperform", "bearish", "breakdown", "layoff",
  "lawsuit", "concern", "crash", "recession", "fear", "sell", "outage", "ban",
]);

const CATEGORY_KEYWORDS: Record<NewsCategory, string[]> = {
  all: [],
  macro: ["gdp", "inflation", "cpi", "pce", "unemployment", "jobs", "payroll", "fiscal", "recession", "economy"],
  earnings: ["earnings", "quarter", "eps", "revenue", "guidance", "results", "beat", "miss", "profit"],
  commodities: ["oil", "gold", "silver", "copper", "wheat", "corn", "lumber", "brent", "wti", "crude", "commodity"],
  rates: ["rate", "yield", "treasury", "bond", "fed", "ecb", "rbi", "boj", "boe", "interest rate", "fomc"],
  crypto: ["bitcoin", "ethereum", "crypto", "blockchain", "defi", "nft", "btc", "eth", "altcoin", "stablecoin"],
  geopolitics: ["tariff", "sanction", "war", "conflict", "geopolitic", "trade war", "china", "taiwan", "opec", "nato"],
  tech: ["ai", "artificial intelligence", "nvidia", "semiconductor", "chip", "cloud", "datacenter", "apple", "microsoft"],
  equities: ["stock", "equity", "market", "s&p", "nasdaq", "dow", "shares", "ipo", "dividend"],
  "central-banks": ["fed", "federal reserve", "ecb", "rbi", "boj", "boe", "rate hike", "rate cut", "tapering", "qe"],
};

function detectSentiment(text: string): "bullish" | "bearish" | "neutral" {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  let bull = 0;
  let bear = 0;
  for (const w of words) {
    if (BULLISH_WORDS.has(w)) bull++;
    if (BEARISH_WORDS.has(w)) bear++;
  }
  if (bull > bear) return "bullish";
  if (bear > bull) return "bearish";
  return "neutral";
}

function classifyCategory(title: string, snippet: string | null, defaultCategory: NewsCategory): NewsCategory {
  const text = `${title} ${snippet ?? ""}`.toLowerCase();
  // Try more specific categories first
  for (const cat of ["earnings", "commodities", "rates", "crypto", "geopolitics", "tech", "macro", "central-banks"] as NewsCategory[]) {
    if (CATEGORY_KEYWORDS[cat].some((kw) => text.includes(kw))) return cat;
  }
  return defaultCategory;
}

export interface GlobalNewsFeedResult {
  items: GlobalNewsItem[];
  signals: { bullish: number; bearish: number; neutral: number };
  categories: Record<NewsCategory, number>;
  fetched_at: string;
}

export async function getGlobalNewsFeed(options: {
  category?: NewsCategory;
  limit?: number;
} = {}): Promise<GlobalNewsFeedResult> {
  const { category = "all", limit = 60 } = options;

  const selectedFeeds = category === "all"
    ? GLOBAL_FEEDS
    : GLOBAL_FEEDS.filter((f) => f.category === (category as NewsCategory));

  const fetchJobs = selectedFeeds.map((feed) =>
    fetchFeedXml(feed.source, feed.url, feed.revalidate ?? 300)
      .then((xml) => {
        const raw = parseFeedItems(feed.source, xml);
        return raw.map((item) => {
          const text = `${item.title} ${item.snippet ?? ""}`;
          const resolvedCategory = classifyCategory(item.title, item.snippet, feed.category);
          return {
            ...item,
            signal: detectSentiment(text),
            category: resolvedCategory,
          } satisfies GlobalNewsItem;
        });
      })
      .catch(() => [] as GlobalNewsItem[]),
  );

  const results = await Promise.all(fetchJobs);
  const flat = results.flat();
  const deduped = dedupeFeedItems(flat) as GlobalNewsItem[];

  // Filter by category if requested
  const filtered = category === "all"
    ? deduped
    : deduped.filter((item) => item.category === category);

  // Sort by recency (items with dates first, then by index)
  const sorted = filtered.sort((a, b) => {
    if (a.published_at && b.published_at) {
      return Date.parse(b.published_at) - Date.parse(a.published_at);
    }
    if (a.published_at) return -1;
    if (b.published_at) return 1;
    return 0;
  });

  const limited = sorted.slice(0, limit);

  const signals = { bullish: 0, bearish: 0, neutral: 0 };
  const categories = {} as Record<NewsCategory, number>;

  for (const item of limited) {
    signals[item.signal]++;
    categories[item.category] = (categories[item.category] ?? 0) + 1;
  }

  return {
    items: limited,
    signals,
    categories,
    fetched_at: new Date().toISOString(),
  };
}
