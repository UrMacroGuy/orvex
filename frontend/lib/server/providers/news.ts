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
  { source: "Reuters Markets", url: "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best" },
  { source: "Investopedia", url: "https://www.investopedia.com/feedbuilder/feed/getfeed/?feedName=rss_headline" },
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

function decodeXmlEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function getTagValue(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeXmlEntities(match[1].trim()) : null;
}

async function fetchFeed(source: string, url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Orvex/1.0; +https://orvex.app)",
      Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
    },
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`${source} feed failed: ${response.status}`);
  }

  return response.text();
}

function parseFeed(source: string, xml: string, terms: string[]): NewsArticle[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  return items
    .map((item, index) => {
      const title = getTagValue(item, "title") ?? "Untitled";
      const snippet = getTagValue(item, "description");
      const signal = detectNewsSentiment(`${title} ${snippet ?? ""}`);
      return {
        id: `${source.toLowerCase().replace(/\s+/g, "-")}-${index + 1}`,
        source,
        title,
        url: getTagValue(item, "link") ?? "",
        published_at: getTagValue(item, "pubDate"),
        snippet,
        signal,
      };
    })
    .filter((article) => article.url)
    .filter((article) => {
      if (terms.length === 0) return true;
      const haystack = `${article.title} ${article.snippet ?? ""}`.toLowerCase();
      return terms.some((term) => haystack.includes(term.toLowerCase()));
    });
}

function deduplicateByUrl(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  return articles.filter((a) => {
    const key = a.url.split("?")[0].toLowerCase().replace(/\/$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getNewsArticles(query: {
  ticker?: string;
  companyName?: string;
  limit?: number;
}) {
  const terms = [query.ticker, query.companyName]
    .filter((item): item is string => Boolean(item))
    .map((item) => item.trim())
    .filter(Boolean);

  const limit = query.limit ?? 20;

  const fetchJobs: Array<Promise<NewsArticle[]>> = [
    ...GENERIC_FEEDS.map((feed) =>
      fetchFeed(feed.source, feed.url)
        .then((xml) => parseFeed(feed.source, xml, terms))
        .catch(() => []),
    ),
  ];

  // Ticker-specific Yahoo Finance feed — highest relevance
  if (query.ticker) {
    const tickerUrl = `https://finance.yahoo.com/rss/headline?s=${encodeURIComponent(query.ticker)}`;
    fetchJobs.push(
      fetchFeed("Yahoo Finance", tickerUrl)
        .then((xml) => parseFeed("Yahoo Finance", xml, []))
        .catch(() => []),
    );
  }

  const settled = await Promise.allSettled(fetchJobs);

  const combined = deduplicateByUrl(
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
