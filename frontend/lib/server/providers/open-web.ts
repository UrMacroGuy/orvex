import { getMacroOverlay } from "@/lib/server/providers/fred";
import { getNewsArticles } from "@/lib/server/providers/news";
import { getRedditSentiment } from "@/lib/server/providers/reddit";
import { getSecCompanyOverview, getSecRiskSummary } from "@/lib/server/providers/sec";
import { getYahooAnalystSummary, getYahooCompanyProfile, getYahooEarnings, getYahooQuote } from "@/lib/server/providers/yahoo";
import type { FinancialQuery } from "@/types/financial";

export interface OpenWebContext {
  company_overview: string[];
  sec_risks: string[];
  earnings_summary: string[];
  news: string[];
  reddit: string[];
  macro: string[];
  citations: Array<{ title: string; url: string; source: string }>;
}

function addCitation(
  citations: OpenWebContext["citations"],
  source: string,
  title: string,
  url: string | null | undefined,
) {
  if (!url) {
    return;
  }

  citations.push({ source, title, url });
}

export async function gatherOpenWebContext(query: FinancialQuery): Promise<OpenWebContext> {
  const ticker = query.ticker?.trim().toUpperCase();
  const companyName = query.company_name?.trim();
  const citations: OpenWebContext["citations"] = [];

  const [company, quote, analyst, earnings, secOverview, secRisks, news, reddit, macro] =
    await Promise.all([
      ticker ? getYahooCompanyProfile(ticker).catch(() => null) : Promise.resolve(null),
      ticker ? getYahooQuote(ticker).catch(() => null) : Promise.resolve(null),
      ticker ? getYahooAnalystSummary(ticker).catch(() => null) : Promise.resolve(null),
      ticker ? getYahooEarnings(ticker, 4).catch(() => []) : Promise.resolve([]),
      ticker ? getSecCompanyOverview(ticker).catch(() => null) : Promise.resolve(null),
      ticker ? getSecRiskSummary(ticker).catch(() => ({ filing: null, extracted_text: null, risk_factors: [] })) : Promise.resolve({ filing: null, extracted_text: null, risk_factors: [] }),
      getNewsArticles({ ticker, companyName, limit: 6 }).catch(() => []),
      ticker || companyName
        ? getRedditSentiment([ticker, companyName].filter(Boolean).join(" ")).catch(() => null)
        : Promise.resolve(null),
      getMacroOverlay().catch(() => ({ summary: [], series: [] })),
    ]);

  const companyOverview = [
    company
      ? `${company.company_name} (${company.symbol}) operates in ${company.sector ?? "unknown sector"} / ${company.industry ?? "unknown industry"}.`
      : null,
    company?.description ?? null,
    quote
      ? `Latest price ${quote.current_price.toFixed(2)} with ${quote.change_percent.toFixed(2)}% move vs previous close.`
      : null,
    analyst?.target_price
      ? `Yahoo analyst target mean price: ${analyst.target_price}. Recommendation: ${analyst.recommendation ?? "n/a"}.`
      : null,
    secOverview?.sic_description
      ? `SEC industry classification: ${secOverview.sic_description}.`
      : null,
  ].filter((item): item is string => Boolean(item));

  const secRiskLines = secRisks.risk_factors;
  if (secRisks.filing) {
    addCitation(
      citations,
      "SEC EDGAR",
      `${ticker ?? secRisks.filing.form} ${secRisks.filing.form} filed ${secRisks.filing.filing_date}`,
      secRisks.filing.filing_url,
    );
  }

  const earningsSummary = earnings.map((item) => {
    const date = item.date ? new Date(item.date).toISOString().slice(0, 10) : "unknown date";
    return `Earnings event around ${date}${item.eps_actual !== null && item.eps_actual !== undefined ? ` with trailing EPS ${item.eps_actual}` : ""}.`;
  });

  const newsLines = news.map((item) => {
    addCitation(citations, item.source, item.title, item.url);
    return `${item.source}: ${item.title}${item.snippet ? ` - ${item.snippet}` : ""}`;
  });

  const redditLines = reddit
    ? [
        reddit.summary,
        ...reddit.top_posts.slice(0, 5).map(
          (post) =>
            `r/${post.subreddit} (${post.sentiment}, score ${post.score}): ${post.title}`,
        ),
      ]
    : [];

  if (reddit) {
    reddit.top_posts.slice(0, 5).forEach((post) => {
      addCitation(citations, `Reddit r/${post.subreddit}`, post.title, post.url);
    });
  }

  const macroLines = macro.summary;

  if (ticker && secOverview) {
    secOverview.filings.slice(0, 5).forEach((filing) => {
      addCitation(
        citations,
        "SEC EDGAR",
        `${ticker} ${filing.form} filed ${filing.filing_date}`,
        filing.filing_url,
      );
    });
  }

  return {
    company_overview: companyOverview,
    sec_risks: secRiskLines,
    earnings_summary: earningsSummary,
    news: newsLines,
    reddit: redditLines,
    macro: macroLines,
    citations,
  };
}

export function formatOpenWebContext(context: OpenWebContext) {
  const sectionEntries: Array<[string, string[]]> = [
    ["Company overview", context.company_overview],
    ["SEC risk factors", context.sec_risks],
    ["Earnings context", context.earnings_summary],
    ["News aggregation", context.news],
    ["Reddit sentiment", context.reddit],
    ["Macro overlay", context.macro],
  ];

  const sections = sectionEntries
    .filter(([, lines]) => lines.length > 0)
    .map(([title, lines]) => `${title}:\n${lines.map((line) => `- ${line}`).join("\n")}`);

  const citations =
    context.citations.length > 0
      ? `Sources:\n${context.citations
          .slice(0, 15)
          .map((citation) => `- [${citation.source}] ${citation.title}: ${citation.url}`)
          .join("\n")}`
      : null;

  return [...sections, citations].filter(Boolean).join("\n\n");
}
