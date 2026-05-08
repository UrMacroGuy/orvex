export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  url: string;
  score: number;
  comments: number;
  sentiment: "bullish" | "bearish" | "neutral";
}

export interface RedditSentimentSummary {
  overall_sentiment: "bullish" | "bearish" | "neutral";
  bullish_posts: number;
  bearish_posts: number;
  neutral_posts: number;
  top_posts: RedditPost[];
  summary: string;
}

const SUBREDDITS = ["wallstreetbets", "stocks", "investing", "options"] as const;
const BULLISH_TERMS = ["beat", "bull", "upside", "growth", "buy", "breakout", "long"];
const BEARISH_TERMS = ["miss", "bear", "downside", "sell", "put", "short", "risk"];

async function fetchRedditJson(subreddit: string, query: string) {
  const response = await fetch(
    `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=relevance&t=month&limit=8`,
    {
      headers: {
        "User-Agent": "Orvex/1.0",
        Accept: "application/json",
      },
      next: { revalidate: 900 },
    },
  );

  if (!response.ok) {
    throw new Error(`Reddit request failed: ${response.status}`);
  }

  return response.json() as Promise<{
    data?: {
      children?: Array<{
        data?: {
          id?: string;
          title?: string;
          permalink?: string;
          score?: number;
          num_comments?: number;
        };
      }>;
    };
  }>;
}

function detectSentiment(text: string): "bullish" | "bearish" | "neutral" {
  const lower = text.toLowerCase();
  const bullScore = BULLISH_TERMS.filter((term) => lower.includes(term)).length;
  const bearScore = BEARISH_TERMS.filter((term) => lower.includes(term)).length;

  if (bullScore > bearScore) {
    return "bullish";
  }

  if (bearScore > bullScore) {
    return "bearish";
  }

  return "neutral";
}

export async function getRedditSentiment(query: string): Promise<RedditSentimentSummary> {
  const settled = await Promise.allSettled(
    SUBREDDITS.map(async (subreddit) => {
      const data = await fetchRedditJson(subreddit, query);
      return (data.data?.children ?? []).map((child) => {
        const title = child.data?.title ?? "";
        return {
          id: child.data?.id ?? `${subreddit}-${Math.random()}`,
          subreddit,
          title,
          url: child.data?.permalink ? `https://www.reddit.com${child.data.permalink}` : "",
          score: Number(child.data?.score ?? 0),
          comments: Number(child.data?.num_comments ?? 0),
          sentiment: detectSentiment(title),
        } satisfies RedditPost;
      });
    }),
  );

  const posts = settled
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((post) => post.url)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const bullishPosts = posts.filter((post) => post.sentiment === "bullish").length;
  const bearishPosts = posts.filter((post) => post.sentiment === "bearish").length;
  const neutralPosts = posts.filter((post) => post.sentiment === "neutral").length;
  const overallSentiment =
    bullishPosts > bearishPosts ? "bullish" : bearishPosts > bullishPosts ? "bearish" : "neutral";

  return {
    overall_sentiment: overallSentiment,
    bullish_posts: bullishPosts,
    bearish_posts: bearishPosts,
    neutral_posts: neutralPosts,
    top_posts: posts,
    summary: `Reddit sentiment is ${overallSentiment} from ${posts.length} relevant posts across ${SUBREDDITS.length} investing subreddits.`,
  };
}
