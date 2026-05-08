import { dedupeFeedItems, fetchFeedXml, parseFeedItems } from "@/lib/server/providers/rss";

export interface NewsArticle {
  id: string;
  source: string;
  title: string;
  url: string;
  published_at: string | null;
  snippet: string | null;
  signal: "bullish" | "bearish" | "neutral";
}

const GENERIC_FEEDS = [
  { source: "Yahoo Finance", url: "https://finance.yahoo.com/rss/topstories" },
  { source: "Yahoo Finance News", url: "https://finance.yahoo.com/news/rssindex" },
  { source: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { source: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
  { source: "Reuters", url: "https://feeds.reuters.com/reuters/businessNews" },
  { source: "Reuters Markets", url: "https://feeds.reuters.com/news/wealth" },
  { source: "Investopedia", url: "https://www.investopedia.com/feedbuilder/feed/getfeed/?feedName=rss_headline" },
  { source: "Seeking Alpha", url: "https://seekingalpha.com/feed.xml" },
  { source: "Benzinga", url: "https://feeds2.benzinga.com/benzinga" },
  { source: "Investing.com", url: "https://www.investing.com/rss/news.rss" },
  { source: "The Motley Fool", url: "https://www.fool.com/feeds/index.aspx" },
] as const;

const BULLISH_SIGNALS = [
  "beat", "beats", "surge", "surges", "rally", "rallies", "strong", "upgrade", "upgrades",
  "buy", "growth", "record", "positive", "boost", "gain", "rise", "jump", "profit",
  "earnings beat", "outperform", "bullish", "breakout", "momentum", "high",
];
const BEARISH_SIGNALS = [
  "miss", "misses", "plunge", "plunges", "fall", "falls", "weak", "downgrade", "downgrades",
  "sell", "decline", "cut", "negative", "drop", "loss", "risk", "concern", "warn",
  "earnings miss", "underperform", "bearish", "breakdown", "layoff", "lawsuit",
];

function detectNewsSentiment(text: string): "bullish" | "bearish" | "neutral" {
  const lower = text.toLowerCase();
  const bullScore = BULLISH_SIGNALS.filter((t) => lower.includes(t)).length;
  const bearScore = BEARISH_SIGNALS.filter((t) => lower.includes(t)).length;
  if (bullScore > bearScore) return "bullish";
  if (bearScore > bullScore) return "bearish";
  return "neutral";
}

function parseFeed(source: string, xml: string, terms: string[]): NewsArticle[] {
  return parseFeedItems(source, xml)
    .map((item) => ({
      ...item,
      signal: detectNewsSentiment(`${item.title} ${item.snippet ?? ""}`),
    }))
    .filter((article) => article.url)
    .filter((article) => {
      if (terms.length === 0) return true;
      const haystack = `${article.title} ${article.snippet ?? ""}`.toLowerCase();
      return terms.some((term) => haystack.includes(term.toLowerCase()));
    });
}

export async function getNewsArticles(query: {
  ticker?: string;
  companyName?: string;
  keywords?: string[];
  limit?: number;
}) {
  const terms = [query.ticker, query.companyName, ...(query.keywords ?? [])]
    .filter((item): item is string => Boolean(item))
    .map((item) => item.trim())
    .filter(Boolean);

  const limit = query.limit ?? 20;

  const fetchJobs: Array<Promise<NewsArticle[]>> = [
    ...GENERIC_FEEDS.map((feed) =>
      fetchFeedXml(feed.source, feed.url)
        .then((xml) => parseFeed(feed.source, xml, terms))
        .catch(() => []),
    ),
  ];

  // Ticker-specific Yahoo Finance feed — highest relevance
  if (query.ticker) {
    const tickerUrl = `https://finance.yahoo.com/rss/headline?s=${encodeURIComponent(query.ticker)}`;
    fetchJobs.push(
      fetchFeedXml("Yahoo Finance", tickerUrl)
        .then((xml) => parseFeed("Yahoo Finance", xml, []))
        .catch(() => []),
    );
  }

  const settled = await Promise.allSettled(fetchJobs);

  const combined = dedupeFeedItems(
    settled
      .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
      .sort((a, b) => {
        const aTime = a.published_at ? Date.parse(a.published_at) : 0;
        const bTime = b.published_at ? Date.parse(b.published_at) : 0;
        return bTime - aTime;
      }),
  );

  return combined.slice(0, limit);
}
