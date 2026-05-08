export interface RssItem {
  id: string;
  source: string;
  title: string;
  url: string;
  published_at: string | null;
  snippet: string | null;
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

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchFeedXml(source: string, url: string, revalidate = 900) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Orvex/1.0; +https://orvex.app)",
      Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8",
    },
    next: { revalidate },
  });

  if (!response.ok) {
    throw new Error(`${source} feed failed: ${response.status}`);
  }

  return response.text();
}

export function parseFeedItems(source: string, xml: string): RssItem[] {
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi);
  const entryBlocks = xml.match(/<entry[\s\S]*?<\/entry>/gi);
  const blocks = itemBlocks ?? entryBlocks ?? [];

  return blocks
    .map((block, index) => {
      const linkTag = block.match(/<link[^>]+href="([^"]+)"/i)?.[1];
      const linkValue = getTagValue(block, "link");
      const title = getTagValue(block, "title") ?? "Untitled";
      const snippet =
        getTagValue(block, "description") ??
        getTagValue(block, "summary") ??
        getTagValue(block, "content");
      const publishedAt =
        getTagValue(block, "pubDate") ??
        getTagValue(block, "published") ??
        getTagValue(block, "updated");

      return {
        id: `${source.toLowerCase().replace(/\s+/g, "-")}-${index + 1}`,
        source,
        title: stripHtml(title),
        url: linkTag ?? linkValue ?? "",
        published_at: publishedAt,
        snippet: snippet ? stripHtml(snippet) : null,
      } satisfies RssItem;
    })
    .filter((item) => item.url);
}

export function dedupeFeedItems<T extends { url: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.url.split("?")[0].toLowerCase().replace(/\/$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
