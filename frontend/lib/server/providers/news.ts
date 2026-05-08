export interface NewsArticle {
  id: string;
  source: string;
  title: string;
  url: string;
  published_at: string | null;
  snippet: string | null;
}

const FEEDS = [
  {
    source: "Yahoo Finance",
    url: "https://finance.yahoo.com/rss/topstories",
  },
  {
    source: "CNBC",
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
  },
  {
    source: "MarketWatch",
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
  },
  {
    source: "Reuters",
    url: "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best",
  },
] as const;

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
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeXmlEntities(match[1].trim()) : null;
}

async function fetchFeed(source: string, url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Orvex/1.0",
      Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
    },
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`${source} feed request failed: ${response.status}`);
  }

  return response.text();
}

function parseFeed(source: string, xml: string, terms: string[]): NewsArticle[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  return items
    .map((item, index) => ({
      id: `${source.toLowerCase().replace(/\s+/g, "-")}-${index + 1}`,
      source,
      title: getTagValue(item, "title") ?? "Untitled",
      url: getTagValue(item, "link") ?? "",
      published_at: getTagValue(item, "pubDate"),
      snippet: getTagValue(item, "description"),
    }))
    .filter((article) => article.url)
    .filter((article) => {
      if (terms.length === 0) {
        return true;
      }

      const haystack = `${article.title} ${article.snippet ?? ""}`.toLowerCase();
      return terms.some((term) => haystack.includes(term.toLowerCase()));
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

  const settled = await Promise.allSettled(
    FEEDS.map(async (feed) => parseFeed(feed.source, await fetchFeed(feed.source, feed.url), terms)),
  );

  const combined = settled
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort((a, b) => {
      const aTime = a.published_at ? Date.parse(a.published_at) : 0;
      const bTime = b.published_at ? Date.parse(b.published_at) : 0;
      return bTime - aTime;
    });

  return combined.slice(0, query.limit ?? 8);
}
