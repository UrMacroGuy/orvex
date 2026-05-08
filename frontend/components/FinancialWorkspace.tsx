"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useFinancialStore } from "@/store/useFinancialStore";
import { useTickerData, useMarketSnapshot, useFinancialQuery } from "@/hooks/useFinancial";
import { useProviderKeys } from "@/hooks/useProviderKeys";
import { useAuth } from "@/hooks/useAuth";
import { ConsensusIndicator } from "./financial/ConsensusIndicator";
import { BullishCasePanel, BearishCasePanel } from "./financial/CasePanel";
import { StreamingTextDisplay } from "./financial/StreamingTextDisplay";
import {
  Bell,
  Settings,
  X,
  LogOut,
  ChevronDown,
  AlertTriangle,
  Loader2,
  Search,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { ModelSelection, ResearchType, StockData } from "@/types/financial";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL_OPTIONS: Array<ModelSelection & { label: string; provider: string }> = [
  { provider_id: "orvex",     model_id: "open-web-intelligence", label: "Free Intelligence Mode", provider: "Orvex" },
  { provider_id: "openai",    model_id: "gpt-4o",            label: "GPT-4o",           provider: "OpenAI" },
  { provider_id: "openai",    model_id: "gpt-4o-mini",       label: "GPT-4o Mini",      provider: "OpenAI" },
  { provider_id: "anthropic", model_id: "claude-sonnet-4-5", label: "Sonnet 4.5",       provider: "Anthropic" },
  { provider_id: "anthropic", model_id: "claude-haiku-4-5",  label: "Haiku 4.5",        provider: "Anthropic" },
  { provider_id: "gemini",    model_id: "gemini-2.0-flash",  label: "Gemini 2.0 Flash", provider: "Gemini" },
  { provider_id: "gemini",    model_id: "gemini-2.0-pro",    label: "Gemini 2.0 Pro",   provider: "Gemini" },
];

const DEFAULT_MODELS: ModelSelection[] = [
  { provider_id: "orvex", model_id: "open-web-intelligence" },
];

const RESEARCH_TYPES: Array<{ value: ResearchType; label: string }> = [
  { value: "stock",    label: "Stock" },
  { value: "earnings", label: "Earnings" },
  { value: "macro",    label: "Macro" },
  { value: "sector",   label: "Sector" },
  { value: "company",  label: "Company" },
  { value: "crypto",   label: "Crypto" },
];

const PROVIDER_DOT: Record<string, string> = {
  orvex:      "bg-sky-400",
  openai:     "bg-emerald-400",
  anthropic:  "bg-orange-400",
  gemini:     "bg-blue-400",
  openrouter: "bg-violet-400",
};

function modelKey(m: ModelSelection) {
  return `${m.provider_id}:${m.model_id}`;
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
      {children}
    </p>
  );
}

function DeltaBadge({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const up = value >= 0;
  return (
    <span className={`text-[10px] font-mono font-semibold ${up ? "text-emerald-400" : "text-rose-400"}`}>
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(2)}{suffix}
    </span>
  );
}

function TickerCard({ data }: { data: StockData }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold font-mono text-white">{data.ticker}</span>
        <DeltaBadge value={data.change_percent} />
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold font-mono text-white">
          ${data.price.toFixed(2)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
        {data.market_cap && (
          <>
            <span className="text-slate-500">Mkt Cap</span>
            <span className="text-slate-300 font-mono text-right">{data.market_cap}</span>
          </>
        )}
        {data.pe_ratio !== undefined && data.pe_ratio !== null && (
          <>
            <span className="text-slate-500">P/E</span>
            <span className="text-slate-300 font-mono text-right">{data.pe_ratio.toFixed(1)}x</span>
          </>
        )}
        {data.avg_volume && (
          <>
            <span className="text-slate-500">Volume</span>
            <span className="text-slate-300 font-mono text-right">{data.avg_volume}</span>
          </>
        )}
        {data.fifty_two_week_high !== undefined && data.fifty_two_week_low !== undefined && (
          <>
            <span className="text-slate-500">52w Range</span>
            <span className="text-slate-300 font-mono text-right">
              {data.fifty_two_week_low?.toFixed(0)}–{data.fifty_two_week_high?.toFixed(0)}
            </span>
          </>
        )}
      </div>

      {/* 52-week position bar */}
      {data.fifty_two_week_high && data.fifty_two_week_low && (
        <div>
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 opacity-80"
              style={{
                width: `${Math.min(100, Math.max(0, ((data.price - data.fifty_two_week_low) / (data.fifty_two_week_high - data.fifty_two_week_low)) * 100))}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
            <span>52w Low</span>
            <span>52w High</span>
          </div>
        </div>
      )}
    </div>
  );
}

function MarketRow({ symbol, name, price, changePct }: { symbol: string; name: string; price: number; changePct: number }) {
  const up = changePct >= 0;
  return (
    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/40 border border-slate-800/50">
      <div>
        <p className="text-xs font-mono font-bold text-white">{symbol}</p>
        <p className="text-[9px] text-slate-600 truncate max-w-[80px]">{name}</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-mono text-slate-300">{price > 0 ? price.toFixed(2) : "—"}</p>
        {price > 0 && (
          <p className={`text-[10px] font-mono font-semibold ${up ? "text-emerald-400" : "text-rose-400"}`}>
            {up ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
          </p>
        )}
      </div>
    </div>
  );
}

function InvestmentScore({ score }: { score: number }) {
  const pct   = Math.min(Math.abs(score) * 100, 100);
  const bull  = score >= 0;
  const color = bull ? "from-emerald-500 to-emerald-400" : "from-rose-500 to-rose-400";
  const label = score > 0.3 ? "Strong Buy" : score > 0 ? "Buy" : score < -0.3 ? "Strong Sell" : score < 0 ? "Sell" : "Neutral";

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>Investment Score</SectionLabel>
        <span className={`text-sm font-bold font-mono ${bull ? "text-emerald-400" : "text-rose-400"}`}>
          {score > 0 ? "+" : ""}{score.toFixed(2)}
        </span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
          style={{ width: `${pct}%`, marginLeft: !bull ? `${100 - pct}%` : undefined }}
        />
      </div>
      <p className={`text-xs font-semibold ${bull ? "text-emerald-400" : "text-rose-400"}`}>{label}</p>
    </div>
  );
}

function CitationsSection({ citations }: { citations: Array<{ id: string; title: string; url: string; snippet?: string; claim_ids: string[] }> }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? citations : citations.slice(0, 6);

  if (citations.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>Sources & Citations ({citations.length})</SectionLabel>
      </div>
      <div className="flex flex-wrap gap-2">
        {visible.map((c) => (
          <a
            key={c.id}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            title={c.title}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700/60 bg-slate-800/40 hover:border-sky-500/40 hover:bg-sky-950/20 text-[10px] text-slate-400 hover:text-sky-300 transition group max-w-[200px]"
          >
            <span className="truncate font-medium">{c.snippet ?? c.title.slice(0, 40)}</span>
            <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-40 group-hover:opacity-80" />
          </a>
        ))}
        {citations.length > 6 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700/40 text-[10px] text-slate-500 hover:text-slate-300 transition"
          >
            {expanded ? "Show less" : `+${citations.length - 6} more`}
          </button>
        )}
      </div>
    </div>
  );
}

function KeyRisksSection({ risks }: { risks: string[] }) {
  if (risks.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-900/30 bg-amber-950/10 p-4">
      <SectionLabel>Key Risks</SectionLabel>
      <div className="space-y-2">
        {risks.slice(0, 4).map((risk, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-[5px]" />
            <p className="text-xs text-slate-400 leading-snug">{risk}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FinancialWorkspace() {
  const router                 = useRouter();
  const { user, logout }       = useAuth();
  const { hasProviderKeys, isLoading: keysLoading } = useProviderKeys();
  const selectedTicker         = useFinancialStore((s) => s.selectedTicker);
  const setSelectedTicker      = useFinancialStore((s) => s.setSelectedTicker);
  const stockData              = useFinancialStore((s) => s.stockData);
  const marketSnapshot         = useFinancialStore((s) => s.marketSnapshot);
  const synthesis              = useFinancialStore((s) => s.synthesis);
  const streamingResponses     = useFinancialStore((s) => s.streamingResponses);
  const isLoading              = useFinancialStore((s) => s.isLoading);
  const storeError             = useFinancialStore((s) => s.error);
  const setError               = useFinancialStore((s) => s.setError);

  useTickerData(selectedTicker || null);
  useMarketSnapshot();

  const [tickerInput,     setTickerInput]     = useState("");
  const [queryText,       setQueryText]       = useState("");
  const [researchType,    setResearchType]    = useState<ResearchType>("stock");
  const [selectedModels,  setSelectedModels]  = useState<ModelSelection[]>(DEFAULT_MODELS);
  const [showUserMenu,    setShowUserMenu]    = useState(false);

  const { mutate, cancel } = useFinancialQuery();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggleModel = useCallback((opt: ModelSelection) => {
    const key = modelKey(opt);
    setSelectedModels((prev) =>
      prev.some((m) => modelKey(m) === key)
        ? prev.filter((m) => modelKey(m) !== key)
        : [...prev, { provider_id: opt.provider_id, model_id: opt.model_id }],
    );
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = queryText.trim();
    if (!trimmed || selectedModels.length === 0 || isLoading) return;
    const ticker = tickerInput.trim().toUpperCase();
    if (ticker) setSelectedTicker(ticker);
    mutate({
      query: trimmed,
      selected_models: selectedModels,
      research_type: researchType,
      ticker: ticker || undefined,
      web_research: true,
    });
    setQueryText("");
  }, [queryText, selectedModels, isLoading, tickerInput, researchType, mutate, setSelectedTicker]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit();
  };

  const responseEntries = Object.entries(streamingResponses);
  const hasResults      = synthesis !== null || responseEntries.length > 0;
  const showFreeModeBanner = !keysLoading && !hasProviderKeys;

  const marketIndices = marketSnapshot?.indices ?? [];

  return (
    <div className="flex h-screen overflow-hidden bg-[#080c14] text-slate-200">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-[17rem] flex-shrink-0 border-r border-slate-800/60 bg-slate-950/70 backdrop-blur-xl flex flex-col overflow-y-auto">
        <div className="p-5 space-y-6 flex-1">

          {/* Logo */}
          <div className="pt-1 select-none">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-sky-500 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-base font-extrabold tracking-tight text-white">ORVEX</span>
            </div>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest mt-1 ml-8">
              Financial Intelligence
            </p>
          </div>

          {/* Research Form */}
          <div className="space-y-3">
            <SectionLabel>Research Query</SectionLabel>

            {/* Ticker + type row */}
            <div className="flex gap-2">
              <div className="relative w-24 flex-shrink-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600 pointer-events-none" />
                <input
                  type="text"
                  placeholder="AAPL"
                  value={tickerInput}
                  onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="w-full pl-7 pr-2 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/60 uppercase font-mono tracking-wider transition"
                />
              </div>
              <select
                value={researchType}
                onChange={(e) => setResearchType(e.target.value as ResearchType)}
                className="flex-1 px-2 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-sky-500/60 transition"
              >
                {RESEARCH_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <textarea
              placeholder="What do you want to research? (Ctrl+Enter to run)"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={5}
              className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/60 resize-none transition leading-relaxed"
            />

            {isLoading ? (
              <button
                onClick={cancel}
                className="w-full px-3 py-2 bg-rose-900/50 hover:bg-rose-800/60 border border-rose-800/50 rounded-lg text-xs font-semibold text-rose-300 flex items-center justify-center gap-2 transition"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!queryText.trim() || selectedModels.length === 0}
                className="w-full px-3 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-xs font-bold text-white disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Analyze
              </button>
            )}
          </div>

          {/* Model Selection */}
          <div>
            <SectionLabel>Models ({selectedModels.length} selected)</SectionLabel>
            <div className="space-y-1">
              {MODEL_OPTIONS.map((opt) => {
                const key     = modelKey(opt);
                const checked = selectedModels.some((m) => modelKey(m) === key);
                return (
                  <label
                    key={key}
                    onClick={() => toggleModel(opt)}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition ${
                      checked ? "bg-slate-800/60" : "hover:bg-slate-900/40"
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded flex-shrink-0 border transition ${
                      checked ? "bg-sky-500 border-sky-500" : "bg-transparent border-slate-700"
                    }`}>
                      {checked && (
                        <svg viewBox="0 0 10 10" className="w-full h-full text-white p-[1.5px]">
                          <polyline
                            points="1.5,5 4,7.5 8.5,2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PROVIDER_DOT[opt.provider_id] ?? "bg-slate-500"}`} />
                    <span className="text-xs text-slate-300 leading-none">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Live Market Snapshot */}
          <div>
            <SectionLabel>Market</SectionLabel>
            <div className="space-y-1.5">
              {marketIndices.length > 0
                ? marketIndices.map((idx) => (
                    <MarketRow
                      key={idx.symbol}
                      symbol={idx.symbol}
                      name={idx.name}
                      price={idx.price}
                      changePct={idx.change_percent}
                    />
                  ))
                : [
                    { t: "SPY", n: "S&P 500" },
                    { t: "QQQ", n: "NASDAQ 100" },
                    { t: "DIA", n: "Dow Jones" },
                    { t: "IWM", n: "Russell 2000" },
                  ].map((row) => (
                    <div
                      key={row.t}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/40 border border-slate-800/50 animate-pulse"
                    >
                      <div>
                        <p className="text-xs font-mono font-bold text-slate-400">{row.t}</p>
                        <p className="text-[9px] text-slate-600">{row.n}</p>
                      </div>
                      <div className="h-6 w-14 bg-slate-800 rounded" />
                    </div>
                  ))}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="h-12 flex-shrink-0 border-b border-slate-800/60 bg-slate-950/50 backdrop-blur-xl flex items-center px-6 justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {selectedTicker && (
              <>
                <span className="text-sm font-bold font-mono text-white">{selectedTicker}</span>
                {stockData && (
                  <span className={`text-xs font-mono font-semibold ${stockData.change_percent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    ${stockData.price.toFixed(2)} {stockData.change_percent >= 0 ? "▲" : "▼"} {Math.abs(stockData.change_percent).toFixed(2)}%
                  </span>
                )}
                <span className="h-3.5 w-px bg-slate-700" />
              </>
            )}
            <span className="text-xs text-slate-500 uppercase tracking-wide">
              {RESEARCH_TYPES.find((t) => t.value === researchType)?.label ?? ""} Analysis
            </span>
            {isLoading && (
              <div className="flex items-center gap-1.5 text-sky-400 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" />
                Running…
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button className="p-1.5 hover:bg-slate-800/60 rounded-lg transition text-slate-500 hover:text-slate-300">
              <Bell className="w-4 h-4" />
            </button>

            {/* Settings / User menu */}
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  showUserMenu ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Settings</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showUserMenu ? "rotate-180" : ""}`} />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-800">
                    <p className="text-xs font-semibold text-slate-200 truncate">{user?.name ?? "Account"}</p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <button
                      disabled
                      className="w-full text-left px-4 py-2 text-xs text-slate-500 flex items-center gap-2.5 cursor-not-allowed"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Preferences
                      <span className="ml-auto text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-600">Soon</span>
                    </button>
                    <button
                      onClick={() => { logout(); setShowUserMenu(false); }}
                      className="w-full text-left px-4 py-2.5 text-xs text-rose-400 hover:bg-rose-950/30 flex items-center gap-2.5 transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {showFreeModeBanner && (
          <div className="flex-shrink-0 border-b border-sky-900/40 bg-sky-950/30 px-6 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">
                  Free Intelligence Mode
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Open-web intelligence is active — SEC, Yahoo Finance, news, Reddit &amp; macro data aggregated in real time.
                </p>
              </div>
              <button
                onClick={() => router.push("/settings/api-keys")}
                className="inline-flex items-center justify-center rounded-xl border border-sky-700/60 px-4 py-2 text-sm font-semibold text-sky-200 transition hover:border-sky-500 hover:text-white whitespace-nowrap"
              >
                Connect Premium AI Providers
              </button>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {storeError && (
          <div className="flex-shrink-0 flex items-start gap-3 px-6 py-3 bg-rose-950/30 border-b border-rose-900/40">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rose-300 flex-1">{storeError}</p>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-300 transition">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-950 to-[#080c14]">
          {!hasResults && !isLoading ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-2">
                <TrendingUp className="w-6 h-6 text-sky-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Financial Intelligence</h2>
              <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
                Enter a ticker and research question. Free Intelligence Mode aggregates SEC filings, live prices, news, Reddit, and macro data — no API key required.
              </p>
              <div className="flex gap-3 mt-2 flex-wrap justify-center">
                {["NVDA earnings outlook", "AAPL valuation thesis", "BTC macro risks"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setQueryText(s)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:border-sky-500/40 hover:text-sky-400 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">

              {/* Ticker market card */}
              {stockData && selectedTicker && (
                <TickerCard data={stockData} />
              )}

              {/* Row 1: Consensus + Bull/Bear */}
              {(synthesis || isLoading) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Consensus */}
                  <div>
                    {synthesis ? (
                      <ConsensusIndicator
                        bullishConfidence={synthesis.confidence_score.bullish_confidence}
                        bearishConfidence={synthesis.confidence_score.bearish_confidence}
                        consensusAgreement={synthesis.confidence_score.consensus_agreement}
                      />
                    ) : (
                      <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-5 h-full animate-pulse space-y-3">
                        <div className="h-3 bg-slate-800 rounded w-1/2" />
                        <div className="h-2 bg-slate-800 rounded w-full" />
                        <div className="h-2 bg-slate-800 rounded w-5/6" />
                      </div>
                    )}
                  </div>

                  {/* Bull case */}
                  <div>
                    {synthesis ? (
                      <BullishCasePanel
                        points={synthesis.bullish_theses.length > 0
                          ? synthesis.bullish_theses[0].supporting_points.length > 0
                            ? synthesis.bullish_theses[0].supporting_points
                            : synthesis.bullish_theses.slice(0, 4).map((t) => t.title)
                          : synthesis.unique_insights.slice(0, 4).map((i) => i.insight)
                        }
                      />
                    ) : (
                      <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/10 p-5 h-full animate-pulse space-y-2">
                        <div className="h-3 bg-emerald-950/60 rounded w-1/3 mb-3" />
                        {[1, 2, 3].map((i) => <div key={i} className="h-2.5 bg-emerald-950/40 rounded w-full" />)}
                      </div>
                    )}
                  </div>

                  {/* Bear case */}
                  <div>
                    {synthesis ? (
                      <BearishCasePanel
                        points={synthesis.bearish_theses.length > 0
                          ? synthesis.bearish_theses[0].supporting_points.length > 0
                            ? synthesis.bearish_theses[0].supporting_points
                            : synthesis.bearish_theses.slice(0, 4).map((t) => t.title)
                          : synthesis.disagreements.slice(0, 3).map((d) => d.topic)
                        }
                      />
                    ) : (
                      <div className="rounded-xl border border-rose-900/30 bg-rose-950/10 p-5 h-full animate-pulse space-y-2">
                        <div className="h-3 bg-rose-950/60 rounded w-1/3 mb-3" />
                        {[1, 2, 3].map((i) => <div key={i} className="h-2.5 bg-rose-950/40 rounded w-full" />)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Row 2: Score + Summary */}
              {synthesis && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {synthesis.investment_score !== 0 && (
                    <InvestmentScore score={synthesis.investment_score} />
                  )}

                  {synthesis.summary && (
                    <div className={`rounded-xl border border-slate-800/60 bg-slate-900/40 p-5 ${
                      synthesis.investment_score !== 0 ? "lg:col-span-2" : "lg:col-span-3"
                    }`}>
                      <SectionLabel>Synthesis Summary</SectionLabel>
                      <p className="text-sm text-slate-300 leading-relaxed">{synthesis.summary}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Row 3: Key risks */}
              {synthesis?.key_risks && synthesis.key_risks.length > 0 && (
                <KeyRisksSection risks={synthesis.key_risks} />
              )}

              {/* Row 4: Model Responses */}
              {(responseEntries.length > 0 || isLoading) && (
                <div>
                  <SectionLabel>
                    Model Responses ({responseEntries.length} / {selectedModels.length})
                  </SectionLabel>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {responseEntries.map(([key, response]) => (
                      <StreamingTextDisplay
                        key={key}
                        text={response.text}
                        isStreaming={response.is_streaming}
                        providerName={response.provider_id}
                        modelId={response.model_id}
                        latencyMs={response.latency_ms}
                        error={response.error}
                      />
                    ))}

                    {/* Skeleton cards for models not yet responded */}
                    {isLoading &&
                      selectedModels
                        .filter((m) => !responseEntries.some(([k]) => k === modelKey(m)))
                        .map((m) => (
                          <StreamingTextDisplay
                            key={modelKey(m)}
                            text=""
                            isStreaming={true}
                            providerName={m.provider_id}
                            modelId={m.model_id}
                          />
                        ))}
                  </div>
                </div>
              )}

              {/* Row 5: Citations */}
              {synthesis?.citations && synthesis.citations.length > 0 && (
                <CitationsSection citations={synthesis.citations} />
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
