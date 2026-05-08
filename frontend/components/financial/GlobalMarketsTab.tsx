"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Bitcoin,
  BarChart2,
  ChevronDown,
  ExternalLink,
  Globe,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { NewsCategory } from "@/lib/server/providers/global-news-feed";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GlobalNewsItem {
  id: string;
  source: string;
  title: string;
  url: string;
  published_at: string | null;
  snippet: string | null;
  signal: "bullish" | "bearish" | "neutral";
  category: NewsCategory;
}

interface GlobalNewsFeedResult {
  items: GlobalNewsItem[];
  signals: { bullish: number; bearish: number; neutral: number };
  categories: Partial<Record<NewsCategory, number>>;
  fetched_at: string;
}

interface AssetQuote {
  symbol: string;
  name: string;
  price: number;
  change_percent: number;
  currency?: string;
}

interface GlobalMarketData {
  indices: AssetQuote[];
  commodities: AssetQuote[];
  rates: AssetQuote[];
  crypto: AssetQuote[];
  fetched_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: Array<{ value: NewsCategory | "all"; label: string; icon?: React.ComponentType<{ className?: string }> }> = [
  { value: "all", label: "All News" },
  { value: "macro", label: "Macro" },
  { value: "earnings", label: "Earnings" },
  { value: "rates", label: "Rates" },
  { value: "commodities", label: "Commodities" },
  { value: "tech", label: "AI / Tech" },
  { value: "crypto", label: "Crypto", icon: Bitcoin },
  { value: "geopolitics", label: "Geopolitics" },
  { value: "equities", label: "Equities" },
  { value: "central-banks", label: "Central Banks" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const ms = Date.now() - Date.parse(dateStr);
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  } catch {
    return "";
  }
}

function formatPrice(price: number, currency?: string): string {
  if (!currency || currency.startsWith("USD")) {
    return price >= 1000
      ? `$${price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : `$${price.toFixed(price < 10 ? 4 : 2)}`;
  }
  if (currency === "%") return `${price.toFixed(2)}%`;
  return price.toFixed(4);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SignalDot({ signal }: { signal: "bullish" | "bearish" | "neutral" }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${signal === "bullish" ? "bg-emerald-400" : signal === "bearish" ? "bg-rose-400" : "bg-slate-600"}`}
    />
  );
}

function DeltaBadge({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span className={`text-[10px] font-mono font-semibold tabular-nums ${up ? "text-emerald-400" : "text-rose-400"}`}>
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(2)}%
    </span>
  );
}

function AssetRow({ asset }: { asset: AssetQuote }) {
  const up = asset.change_percent >= 0;
  return (
    <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg hover:bg-slate-800/40 transition">
      <div className="min-w-0">
        <p className="text-xs font-mono font-bold text-white truncate">{asset.name}</p>
        <p className="text-[9px] text-slate-600 font-mono">{asset.symbol}</p>
      </div>
      <div className="text-right flex-shrink-0 ml-2">
        <p className="text-xs font-mono text-slate-200 tabular-nums">{formatPrice(asset.price, asset.currency)}</p>
        <DeltaBadge value={asset.change_percent} />
      </div>
    </div>
  );
}

function AssetGrid({ title, assets, icon: Icon }: { title: string; assets: AssetQuote[]; icon: React.ComponentType<{ className?: string }> }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? assets : assets.slice(0, 5);

  if (assets.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-3.5 w-3.5 text-sky-400" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</p>
        </div>
        <div className="space-y-1 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="h-8 rounded-lg bg-slate-800/60" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-sky-400" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</p>
        </div>
        {assets.length > 5 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-0.5 text-[10px] text-slate-500 hover:text-slate-300 transition"
          >
            {expanded ? "Less" : `+${assets.length - 5}`}
            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
      <div className="space-y-0.5">
        {visible.map((asset) => <AssetRow key={asset.symbol} asset={asset} />)}
      </div>
    </div>
  );
}

function NewsCard({ item }: { item: GlobalNewsItem }) {
  const relTime = formatRelative(item.published_at);
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-1.5 rounded-xl border border-slate-800/50 bg-slate-900/40 p-3.5 transition hover:border-sky-500/30 hover:bg-sky-950/10"
    >
      <div className="flex items-center gap-2">
        <SignalDot signal={item.signal} />
        <span className="text-[9px] font-bold uppercase tracking-wide text-slate-600">{item.source}</span>
        {relTime && <span className="ml-auto text-[9px] text-slate-700">{relTime}</span>}
      </div>
      <p className="text-xs font-medium leading-snug text-slate-200 group-hover:text-white transition line-clamp-3">
        {item.title}
      </p>
      {item.snippet && (
        <p className="text-[10px] leading-relaxed text-slate-500 line-clamp-2">{item.snippet}</p>
      )}
      <div className="flex items-center gap-1 mt-0.5">
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${item.signal === "bullish" ? "bg-emerald-950/60 text-emerald-400" : item.signal === "bearish" ? "bg-rose-950/60 text-rose-400" : "bg-slate-800 text-slate-500"}`}>
          {item.signal}
        </span>
        <span className="rounded bg-slate-800/60 px-1.5 py-0.5 text-[9px] text-slate-500 capitalize">{item.category.replace("-", " ")}</span>
        <ExternalLink className="ml-auto h-2.5 w-2.5 text-slate-700 group-hover:text-sky-400 transition flex-shrink-0" />
      </div>
    </a>
  );
}

function SentimentBar({ signals }: { signals: { bullish: number; bearish: number; neutral: number } }) {
  const total = signals.bullish + signals.bearish + signals.neutral || 1;
  const bullPct = (signals.bullish / total) * 100;
  const bearPct = (signals.bearish / total) * 100;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 overflow-hidden rounded-full h-1.5 bg-slate-800 flex">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${bullPct}%` }} />
        <div className="h-full bg-rose-500 transition-all" style={{ width: `${bearPct}%` }} />
        <div className="h-full bg-slate-700 flex-1" />
      </div>
      <div className="flex gap-3 flex-shrink-0 text-[9px] font-mono">
        <span className="text-emerald-400">{signals.bullish}↑</span>
        <span className="text-rose-400">{signals.bearish}↓</span>
        <span className="text-slate-600">{signals.neutral}—</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function GlobalMarketsTab() {
  const [activeCategory, setActiveCategory] = useState<NewsCategory | "all">("all");
  const [newsData, setNewsData] = useState<GlobalNewsFeedResult | null>(null);
  const [marketData, setMarketData] = useState<GlobalMarketData | null>(null);
  const [loadingNews, setLoadingNews] = useState(true);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const [newsError, setNewsError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchNews = useCallback(async (category: NewsCategory | "all") => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoadingNews(true);
    setNewsError(null);
    try {
      const res = await fetch(`/api/financial/news-feed?category=${category}&limit=60`, {
        signal: ctrl.signal,
      });
      const json = await res.json();
      if (json?.data) setNewsData(json.data);
      else setNewsError(json?.error?.message ?? "Failed to load news");
    } catch (err) {
      if ((err as Error).name !== "AbortError") setNewsError("Failed to load news feed");
    } finally {
      setLoadingNews(false);
    }
  }, []);

  const fetchMarket = useCallback(async () => {
    setLoadingMarket(true);
    try {
      const res = await fetch("/api/financial/global-market");
      const json = await res.json();
      if (json?.data) setMarketData(json.data);
    } catch {
      // silently fail for market data
    } finally {
      setLoadingMarket(false);
    }
  }, []);

  useEffect(() => {
    void fetchNews(activeCategory);
  }, [activeCategory, fetchNews]);

  useEffect(() => {
    void fetchMarket();
    const interval = setInterval(fetchMarket, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchMarket]);

  const handleRefresh = () => {
    void fetchNews(activeCategory);
    void fetchMarket();
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-sky-400" />
          <h2 className="text-sm font-bold text-white">Global Markets</h2>
          {newsData && (
            <span className="text-[10px] text-slate-600 ml-1">
              {newsData.items.length} sources · {formatRelative(newsData.fetched_at)}
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 border border-slate-800/60 transition hover:border-sky-500/30 hover:text-sky-400"
        >
          <RefreshCw className={`h-3 w-3 ${loadingNews ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Sentiment Overview */}
      {newsData && (
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-3.5 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">News Sentiment</p>
            <Activity className="h-3.5 w-3.5 text-sky-400" />
          </div>
          <SentimentBar signals={newsData.signals} />
        </div>
      )}

      {/* Two-column layout on wider screens */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Left: News Feed */}
        <div className="flex min-w-0 flex-col gap-3">
          {/* Category filters */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 flex-shrink-0 no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value as NewsCategory)}
                className={`flex-shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition whitespace-nowrap ${activeCategory === cat.value ? "bg-sky-600 text-white" : "border border-slate-800 text-slate-400 hover:border-sky-500/30 hover:text-sky-300"}`}
              >
                {cat.label}
                {newsData?.categories[cat.value as NewsCategory] ? (
                  <span className="ml-1 opacity-60">{newsData.categories[cat.value as NewsCategory]}</span>
                ) : null}
              </button>
            ))}
          </div>

          {/* News items */}
          {newsError ? (
            <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-4 text-xs text-rose-300">{newsError}</div>
          ) : loadingNews ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl border border-slate-800/50 bg-slate-900/40" />
              ))}
            </div>
          ) : newsData?.items.length === 0 ? (
            <div className="rounded-xl border border-slate-800/50 bg-slate-900/30 p-8 text-center text-xs text-slate-500">
              No news found for this category right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(newsData?.items ?? []).map((item) => (
                <NewsCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Right: Market Dashboards */}
        <div className="flex flex-col gap-3 flex-shrink-0">
          <AssetGrid
            title="Global Indices"
            assets={loadingMarket ? [] : (marketData?.indices ?? [])}
            icon={TrendingUp}
          />
          <AssetGrid
            title="Commodities"
            assets={loadingMarket ? [] : (marketData?.commodities ?? [])}
            icon={BarChart2}
          />
          <AssetGrid
            title="Rates & FX"
            assets={loadingMarket ? [] : (marketData?.rates ?? [])}
            icon={Activity}
          />
          <AssetGrid
            title="Crypto"
            assets={loadingMarket ? [] : (marketData?.crypto ?? [])}
            icon={Zap}
          />

          {/* Market signal summary */}
          {marketData && (
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-3.5 w-3.5 text-slate-500" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Market Tone</p>
              </div>
              {(() => {
                const allAssets = [
                  ...(marketData.indices ?? []),
                  ...(marketData.commodities ?? []),
                  ...(marketData.crypto ?? []),
                ];
                const up = allAssets.filter((a) => a.change_percent >= 0).length;
                const down = allAssets.filter((a) => a.change_percent < 0).length;
                const tone = up > down ? "Risk-On" : up < down ? "Risk-Off" : "Neutral";
                const color = up > down ? "text-emerald-400" : up < down ? "text-rose-400" : "text-slate-400";
                return (
                  <div>
                    <p className={`text-sm font-bold ${color}`}>{tone}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{up} assets up · {down} down</p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
