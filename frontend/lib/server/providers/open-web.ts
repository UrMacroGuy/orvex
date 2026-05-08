import { getMacroOverlay } from "@/lib/server/providers/fred";
import { getGlobalMacroContext } from "@/lib/server/providers/global-macro";
import {
  analyzeFinancialQuery,
  type IntelligencePlan,
} from "@/lib/server/providers/intelligence-router";
import { getNewsArticles } from "@/lib/server/providers/news";
import { getRedditSentiment } from "@/lib/server/providers/reddit";
import {
  getSecCompanyOverview,
  getSecRiskSummary,
} from "@/lib/server/providers/sec";
import {
  getYahooAnalystSummary,
  getYahooCompanyProfile,
  getYahooEarnings,
  getYahooExtendedQuote,
} from "@/lib/server/providers/yahoo";
import type { FinancialQuery } from "@/types/financial";

export interface OpenWebContext {
  analysis: IntelligencePlan;
  company_overview: string[];
  market_data: string[];
  analyst_data: string[];
  sec_risks: string[];
  earnings_summary: string[];
  news: string[];
  news_signals: { bullish: number; bearish: number; neutral: number };
  reddit: string[];
  macro: string[];
  thematic_signals: string[];
  direct_answer_basis: string[];
  market_sentiment: string[];
  citations: Array<{ title: string; url: string; source: string; published_at?: string }>;
}

function formatMarketCap(val: number | null | undefined): string | null {
  if (!val) return null;
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
}

function formatVolume(val: number | null | undefined): string | null {
  if (!val) return null;
  if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(0)}K`;
  return String(val);
}

function formatPct(val: number | null | undefined): string | null {
  if (val === null || val === undefined) return null;
  const sign = val >= 0 ? "+" : "";
  return `${sign}${(val * 100).toFixed(1)}%`;
}

function addCitation(
  citations: OpenWebContext["citations"],
  source: string,
  title: string,
  url: string | null | undefined,
  published_at?: string | null,
) {
  if (!url) return;
  citations.push({ source, title, url, published_at: published_at ?? undefined });
}

function buildDirectAnswerBasis(
  analysis: IntelligencePlan,
  quoteChange: number | null | undefined,
) {
  return [
    analysis.primary_intent === "earnings"
      ? "Earnings-linked query: weigh guidance, estimate revisions, and the durability of the post-print move."
      : null,
    analysis.primary_intent === "macro"
      ? "Macro-linked query: prioritize rates, inflation, yields, and cross-asset confirmation."
      : null,
    analysis.primary_intent === "geopolitics"
      ? "Geopolitical query: prioritize tariff exposure, supply-chain concentration, and region-specific developments."
      : null,
    analysis.primary_intent === "comparison"
      ? "Comparison query: compare durability, valuation sensitivity, and macro exposure side by side."
      : null,
    quoteChange !== null && quoteChange !== undefined
      ? `Live market anchor: the primary listed entity is moving ${quoteChange >= 0 ? "+" : ""}${quoteChange.toFixed(2)}% today.`
      : null,
  ].filter((item): item is string => Boolean(item));
}

export async function gatherOpenWebContext(query: FinancialQuery): Promise<OpenWebContext> {
  const analysis = await analyzeFinancialQuery(query);
  const ticker = analysis.resolved_symbol ?? query.ticker?.trim().toUpperCase();
  const companyName = analysis.company_name ?? query.company_name?.trim();
  const citations: OpenWebContext["citations"] = [];

  const [company, quote, analyst, earnings, secOverview, secRisks, news, reddit, macro, globalMacro] =
    await Promise.all([
      ticker ? getYahooCompanyProfile(ticker).catch(() => null) : Promise.resolve(null),
      ticker ? getYahooExtendedQuote(ticker).catch(() => null) : Promise.resolve(null),
      ticker ? getYahooAnalystSummary(ticker).catch(() => null) : Promise.resolve(null),
      ticker ? getYahooEarnings(ticker, 4).catch(() => []) : Promise.resolve([]),
      ticker ? getSecCompanyOverview(ticker).catch(() => null) : Promise.resolve(null),
      ticker
        ? getSecRiskSummary(ticker).catch(() => ({ filing: null, extracted_text: null, risk_factors: [] }))
        : Promise.resolve({ filing: null, extracted_text: null, risk_factors: [] }),
      getNewsArticles({
        ticker,
        companyName,
        keywords: analysis.focus_terms,
        limit: 24,
      }).catch(() => []),
      ticker || companyName
        ? getRedditSentiment([ticker, companyName, ...analysis.themes].filter(Boolean).join(" ")).catch(() => null)
        : Promise.resolve(null),
      getMacroOverlay().catch(() => ({ summary: [], series: [] })),
      getGlobalMacroContext(analysis).catch(() => ({ summary: [], theme_impacts: [], market_proxies: [], citations: [] })),
    ]);

  const companyOverview = [
    company
      ? `${company.company_name} (${company.symbol}) operates in ${company.sector ?? "unknown sector"} / ${company.industry ?? "unknown industry"}.`
      : null,
    companyName && !company ? `${companyName} is the primary entity inferred from the user query.` : null,
    company?.description?.slice(0, 400) ?? null,
    secOverview?.sic_description ? `SEC industry classification: ${secOverview.sic_description}.` : null,
    analysis.themes.length > 0 ? `Primary themes detected: ${analysis.themes.join(", ")}.` : null,
  ].filter((item): item is string => Boolean(item));

  const marketData: string[] = [];

  if (quote) {
    const direction = quote.change_percent >= 0 ? "+" : "";
    marketData.push(`Current price: $${quote.current_price.toFixed(2)} (${direction}${quote.change_percent.toFixed(2)}% today)`);

    if (quote.high_price && quote.low_price) {
      marketData.push(`Day range: $${quote.low_price.toFixed(2)} - $${quote.high_price.toFixed(2)}`);
    }

    if (quote.fifty_two_week_low && quote.fifty_two_week_high) {
      const pctFromHigh = ((quote.current_price - quote.fifty_two_week_high) / quote.fifty_two_week_high) * 100;
      marketData.push(
        `52-week range: $${quote.fifty_two_week_low.toFixed(2)} - $${quote.fifty_two_week_high.toFixed(2)} (${pctFromHigh.toFixed(1)}% from 52w high)`,
      );
    }

    const mcap = formatMarketCap(quote.market_cap);
    if (mcap) marketData.push(`Market cap: ${mcap}`);
    if (quote.pe_ratio) marketData.push(`Trailing P/E: ${quote.pe_ratio.toFixed(1)}x`);

    const vol = formatVolume(quote.volume);
    if (vol) marketData.push(`Volume: ${vol}`);

    if (quote.after_hours_price && quote.after_hours_change_percent) {
      const dir = quote.after_hours_change_percent >= 0 ? "+" : "";
      marketData.push(`After-hours: $${quote.after_hours_price.toFixed(2)} (${dir}${quote.after_hours_change_percent.toFixed(2)}%)`);
    }
  }

  const analystData: string[] = [];

  if (analyst) {
    if (analyst.target_price) {
      const upside = quote
        ? (((analyst.target_price - quote.current_price) / quote.current_price) * 100).toFixed(1)
        : null;
      analystData.push(
        `Analyst consensus target: $${analyst.target_price.toFixed(2)}${upside ? ` (${upside}% upside from current)` : ""}. Rating: ${analyst.recommendation ?? "n/a"}.`,
      );
    }

    if (analyst.target_high && analyst.target_low) {
      analystData.push(`Price target range: $${analyst.target_low.toFixed(2)} - $${analyst.target_high.toFixed(2)}.`);
    }

    const growth = formatPct(analyst.revenue_growth);
    const epsGrowth = formatPct(analyst.earnings_growth);
    if (growth) analystData.push(`Revenue growth (YoY): ${growth}.`);
    if (epsGrowth) analystData.push(`Earnings growth (YoY): ${epsGrowth}.`);
    if (analyst.gross_margins) analystData.push(`Gross margins: ${(analyst.gross_margins * 100).toFixed(1)}%.`);
    if (analyst.return_on_equity) analystData.push(`Return on equity: ${(analyst.return_on_equity * 100).toFixed(1)}%.`);
    if (analyst.beta) analystData.push(`Beta: ${analyst.beta.toFixed(2)} (market sensitivity).`);
  }

  const secRiskLines = secRisks.risk_factors;
  if (secRisks.filing) {
    addCitation(
      citations,
      "SEC EDGAR",
      `${ticker ?? secRisks.filing.form} ${secRisks.filing.form} filed ${secRisks.filing.filing_date}`,
      secRisks.filing.filing_url,
    );
  }

  if (ticker && secOverview) {
    secOverview.filings.slice(0, 5).forEach((filing) => {
      addCitation(citations, "SEC EDGAR", `${ticker} ${filing.form} filed ${filing.filing_date}`, filing.filing_url);
    });
  }

  const earningsSummary = earnings.map((item) => {
    const date = item.date ? new Date(item.date).toISOString().slice(0, 10) : "unknown date";
    const eps =
      item.eps_actual !== null && item.eps_actual !== undefined
        ? ` - trailing EPS: $${item.eps_actual.toFixed(2)}`
        : "";
    const estimate =
      item.eps_estimate !== null && item.eps_estimate !== undefined
        ? `, forward EPS estimate: $${item.eps_estimate.toFixed(2)}`
        : "";
    return `Earnings event around ${date}${eps}${estimate}.`;
  });

  const newsSignals = { bullish: 0, bearish: 0, neutral: 0 };
  const newsLines = news.map((item) => {
    newsSignals[item.signal]++;
    addCitation(citations, item.source, item.title, item.url, item.published_at);
    const signalTag = item.signal !== "neutral" ? ` [${item.signal.toUpperCase()}]` : "";
    return `${item.source}${signalTag}: ${item.title}${item.snippet ? ` - ${item.snippet.slice(0, 120)}` : ""}`;
  });

  const redditLines = reddit
    ? [
        reddit.summary,
        ...reddit.top_posts
          .slice(0, 6)
          .map((post) => `r/${post.subreddit} (${post.sentiment}, score ${post.score}): ${post.title}`),
      ]
    : [];

  if (reddit) {
    reddit.top_posts.slice(0, 5).forEach((post) => {
      addCitation(citations, `Reddit r/${post.subreddit}`, post.title, post.url);
    });
  }

  globalMacro.citations.forEach((citation) => {
    addCitation(citations, citation.source, citation.title, citation.url, citation.published_at);
  });

  const macroLines = [...macro.summary, ...globalMacro.summary, ...globalMacro.market_proxies].slice(0, 12);
  const thematicSignals = [
    ...globalMacro.theme_impacts,
    ...analysis.source_plan.map((item) => `Source plan: ${item}`),
  ].slice(0, 8);
  const directAnswerBasis = buildDirectAnswerBasis(analysis, quote?.change_percent ?? null);
  const marketSentiment = [
    `News balance: ${newsSignals.bullish} bullish, ${newsSignals.bearish} bearish, ${newsSignals.neutral} neutral.`,
    ...(reddit ? [reddit.summary] : []),
    ...globalMacro.market_proxies.slice(0, 3),
  ].slice(0, 5);

  return {
    analysis,
    company_overview: companyOverview,
    market_data: marketData,
    analyst_data: analystData,
    sec_risks: secRiskLines,
    earnings_summary: earningsSummary,
    news: newsLines,
    news_signals: newsSignals,
    reddit: redditLines,
    macro: macroLines,
    thematic_signals: thematicSignals,
    direct_answer_basis: directAnswerBasis,
    market_sentiment: marketSentiment,
    citations,
  };
}

export function formatOpenWebContext(context: OpenWebContext) {
  const sectionEntries: Array<[string, string[]]> = [
    ["Query understanding", [
      `Intent: ${context.analysis.primary_intent}; themes: ${context.analysis.themes.join(", ") || "none"}; regions: ${context.analysis.regions.join(", ")}.`,
    ]],
    ["Direct answer basis", context.direct_answer_basis],
    ["Company overview", context.company_overview],
    ["Market data", context.market_data],
    ["Analyst consensus", context.analyst_data],
    ["SEC risk factors", context.sec_risks],
    ["Earnings context", context.earnings_summary],
    ["News aggregation", context.news],
    ["Reddit sentiment", context.reddit],
    ["Macro overlay", context.macro],
    ["Theme signals", context.thematic_signals],
    ["Market sentiment", context.market_sentiment],
  ];

  const sections = sectionEntries
    .filter(([, lines]) => lines.length > 0)
    .map(([title, lines]) => `${title}:\n${lines.map((line) => `- ${line}`).join("\n")}`);

  const newsSignalSummary = `News signals: ${context.news_signals.bullish} bullish, ${context.news_signals.bearish} bearish, ${context.news_signals.neutral} neutral`;
  const routingSummary = `Routing: ${context.analysis.primary_intent} intent | themes ${context.analysis.themes.join(", ") || "none"} | regions ${context.analysis.regions.join(", ")}`;
  const citations =
    context.citations.length > 0
      ? `Sources:\n${context.citations
          .slice(0, 20)
          .map((c) => `- [${c.source}] ${c.title}: ${c.url}`)
          .join("\n")}`
      : null;

  return [...sections, newsSignalSummary, routingSummary, citations].filter(Boolean).join("\n\n");
}
