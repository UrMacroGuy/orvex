"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  ExternalLink,
  Loader2,
  LogOut,
  Search,
  Settings,
  TrendingUp,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFinancialQuery, useMarketSnapshot, useTickerData } from "@/hooks/useFinancial";
import { useProviderKeys } from "@/hooks/useProviderKeys";
import { useFinancialStore } from "@/store/useFinancialStore";
import { ModelSelection, ResearchType, StockData } from "@/types/financial";
import { BearishCasePanel, BullishCasePanel } from "./financial/CasePanel";
import { ConsensusIndicator } from "./financial/ConsensusIndicator";
import { StreamingTextDisplay } from "./financial/StreamingTextDisplay";

const MODEL_OPTIONS: Array<ModelSelection & { label: string; provider: string }> = [
  { provider_id: "orvex", model_id: "open-web-intelligence", label: "Free Intelligence Mode", provider: "Orvex" },
  { provider_id: "openai", model_id: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  { provider_id: "openai", model_id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  { provider_id: "anthropic", model_id: "claude-sonnet-4-5", label: "Sonnet 4.5", provider: "Anthropic" },
  { provider_id: "anthropic", model_id: "claude-haiku-4-5", label: "Haiku 4.5", provider: "Anthropic" },
  { provider_id: "gemini", model_id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "Gemini" },
  { provider_id: "gemini", model_id: "gemini-2.0-pro", label: "Gemini 2.0 Pro", provider: "Gemini" },
];

const DEFAULT_MODELS: ModelSelection[] = [
  { provider_id: "orvex", model_id: "open-web-intelligence" },
];

const RESEARCH_TYPES: Array<{ value: ResearchType; label: string }> = [
  { value: "stock", label: "Stock" },
  { value: "earnings", label: "Earnings" },
  { value: "macro", label: "Macro" },
  { value: "sector", label: "Sector" },
  { value: "thematic", label: "Thematic" },
  { value: "market", label: "Market" },
  { value: "company", label: "Company" },
  { value: "crypto", label: "Crypto" },
];

const PROVIDER_DOT: Record<string, string> = {
  orvex: "bg-sky-400",
  openai: "bg-emerald-400",
  anthropic: "bg-orange-400",
  gemini: "bg-blue-400",
  openrouter: "bg-violet-400",
};

function modelKey(model: ModelSelection) {
  return `${model.provider_id}:${model.model_id}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">{children}</p>;
}

function DeltaBadge({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const up = value >= 0;
  return (
    <span className={`text-[10px] font-mono font-semibold ${up ? "text-emerald-400" : "text-rose-400"}`}>
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(2)}
      {suffix}
    </span>
  );
}

function TickerCard({ data }: { data: StockData }) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold font-mono text-white">{data.ticker}</span>
        <DeltaBadge value={data.change_percent} />
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold font-mono text-white">${data.price.toFixed(2)}</span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
        {data.market_cap && (
          <>
            <span className="text-slate-500">Mkt Cap</span>
            <span className="text-right font-mono text-slate-300">{data.market_cap}</span>
          </>
        )}
        {data.pe_ratio !== undefined && data.pe_ratio !== null && (
          <>
            <span className="text-slate-500">P/E</span>
            <span className="text-right font-mono text-slate-300">{data.pe_ratio.toFixed(1)}x</span>
          </>
        )}
        {data.avg_volume && (
          <>
            <span className="text-slate-500">Volume</span>
            <span className="text-right font-mono text-slate-300">{data.avg_volume}</span>
          </>
        )}
        {data.fifty_two_week_high !== undefined && data.fifty_two_week_low !== undefined && (
          <>
            <span className="text-slate-500">52w Range</span>
            <span className="text-right font-mono text-slate-300">
              {data.fifty_two_week_low?.toFixed(0)}-{data.fifty_two_week_high?.toFixed(0)}
            </span>
          </>
        )}
      </div>

      {data.fifty_two_week_high && data.fifty_two_week_low && (
        <div>
          <div className="h-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 opacity-80"
              style={{
                width: `${Math.min(100, Math.max(0, ((data.price - data.fifty_two_week_low) / (data.fifty_two_week_high - data.fifty_two_week_low)) * 100))}%`,
              }}
            />
          </div>
          <div className="mt-0.5 flex justify-between text-[9px] text-slate-600">
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
    <div className="flex items-center justify-between rounded-lg border border-slate-800/50 bg-slate-900/40 px-2.5 py-1.5">
      <div>
        <p className="text-xs font-mono font-bold text-white">{symbol}</p>
        <p className="max-w-[80px] truncate text-[9px] text-slate-600">{name}</p>
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
  const pct = Math.min(Math.abs(score) * 100, 100);
  const bull = score >= 0;
  const color = bull ? "from-emerald-500 to-emerald-400" : "from-rose-500 to-rose-400";
  const label =
    score > 0.3 ? "Strong Buy" : score > 0 ? "Buy" : score < -0.3 ? "Strong Sell" : score < 0 ? "Sell" : "Neutral";

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel>Investment Score</SectionLabel>
        <span className={`text-sm font-bold font-mono ${bull ? "text-emerald-400" : "text-rose-400"}`}>
          {score > 0 ? "+" : ""}
          {score.toFixed(2)}
        </span>
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
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
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel>Sources & Citations ({citations.length})</SectionLabel>
      </div>
      <div className="flex flex-wrap gap-2">
        {visible.map((citation) => (
          <a
            key={citation.id}
            href={citation.url}
            target="_blank"
            rel="noopener noreferrer"
            title={citation.title}
            className="group inline-flex max-w-[200px] items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/40 px-2.5 py-1 text-[10px] text-slate-400 transition hover:border-sky-500/40 hover:bg-sky-950/20 hover:text-sky-300"
          >
            <span className="truncate font-medium">{citation.snippet ?? citation.title.slice(0, 40)}</span>
            <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 opacity-40 group-hover:opacity-80" />
          </a>
        ))}
        {citations.length > 6 && (
          <button
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700/40 px-2.5 py-1 text-[10px] text-slate-500 transition hover:text-slate-300"
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
        {risks.slice(0, 4).map((risk, index) => (
          <div key={`${risk}-${index}`} className="flex items-start gap-2">
            <span className="mt-[5px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
            <p className="text-xs leading-snug text-slate-400">{risk}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightListCard({
  title,
  items,
  tone = "slate",
}: {
  title: string;
  items: string[];
  tone?: "slate" | "sky";
}) {
  if (items.length === 0) return null;

  const classes = tone === "sky" ? "border-sky-900/30 bg-sky-950/10" : "border-slate-800/60 bg-slate-900/40";

  return (
    <div className={`rounded-xl border p-4 ${classes}`}>
      <SectionLabel>{title}</SectionLabel>
      <div className="space-y-2">
        {items.slice(0, 5).map((item, index) => (
          <div key={`${title}-${index}`} className="flex items-start gap-2">
            <span className="mt-[5px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-400" />
            <p className="text-xs leading-snug text-slate-300">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FinancialWorkspace() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { hasProviderKeys, isLoading: keysLoading } = useProviderKeys();
  const selectedTicker = useFinancialStore((state) => state.selectedTicker);
  const setSelectedTicker = useFinancialStore((state) => state.setSelectedTicker);
  const stockData = useFinancialStore((state) => state.stockData);
  const marketSnapshot = useFinancialStore((state) => state.marketSnapshot);
  const synthesis = useFinancialStore((state) => state.synthesis);
  const streamingResponses = useFinancialStore((state) => state.streamingResponses);
  const isLoading = useFinancialStore((state) => state.isLoading);
  const storeError = useFinancialStore((state) => state.error);
  const setError = useFinancialStore((state) => state.setError);

  useTickerData(selectedTicker || null);
  useMarketSnapshot();

  const [tickerInput, setTickerInput] = useState("");
  const [queryText, setQueryText] = useState("");
  const [researchType, setResearchType] = useState<ResearchType>("stock");
  const [selectedModels, setSelectedModels] = useState<ModelSelection[]>(DEFAULT_MODELS);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const { mutate, cancel } = useFinancialQuery();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggleModel = useCallback((option: ModelSelection) => {
    const key = modelKey(option);
    setSelectedModels((previous) =>
      previous.some((model) => modelKey(model) === key)
        ? previous.filter((model) => modelKey(model) !== key)
        : [...previous, { provider_id: option.provider_id, model_id: option.model_id }],
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
  }, [isLoading, mutate, queryText, researchType, selectedModels, setSelectedTicker, tickerInput]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) handleSubmit();
  };

  const responseEntries = Object.entries(streamingResponses);
  const hasResults = synthesis !== null || responseEntries.length > 0;
  const showFreeModeBanner = !keysLoading && !hasProviderKeys;
  const marketIndices = marketSnapshot?.indices ?? [];

  return (
    <div className="flex h-screen overflow-hidden bg-[#080c14] text-slate-200">
      <aside className="flex w-[17rem] flex-shrink-0 flex-col overflow-y-auto border-r border-slate-800/60 bg-slate-950/70 backdrop-blur-xl">
        <div className="flex-1 space-y-6 p-5">
          <div className="select-none pt-1">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500">
                <TrendingUp className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-base font-extrabold tracking-tight text-white">ORVEX</span>
            </div>
            <p className="ml-8 mt-1 text-[10px] uppercase tracking-widest text-slate-600">Financial Intelligence</p>
          </div>

          <div className="space-y-3">
            <SectionLabel>Research Query</SectionLabel>
            <div className="flex gap-2">
              <div className="relative w-24 flex-shrink-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-600" />
                <input
                  type="text"
                  placeholder="AAPL"
                  value={tickerInput}
                  onChange={(event) => setTickerInput(event.target.value.toUpperCase())}
                  maxLength={10}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/60 py-2 pl-7 pr-2 text-xs uppercase tracking-wider text-white transition placeholder-slate-600 focus:border-sky-500/60 focus:outline-none font-mono"
                />
              </div>
              <select
                value={researchType}
                onChange={(event) => setResearchType(event.target.value as ResearchType)}
                className="flex-1 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-2 text-xs text-slate-300 transition focus:border-sky-500/60 focus:outline-none"
              >
                {RESEARCH_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              placeholder="What do you want to research? (Ctrl+Enter to run)"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={5}
              className="w-full resize-none rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-xs leading-relaxed text-white transition placeholder-slate-600 focus:border-sky-500/60 focus:outline-none"
            />

            {isLoading ? (
              <button
                onClick={cancel}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-800/50 bg-rose-900/50 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-800/60"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!queryText.trim() || selectedModels.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Analyze
              </button>
            )}
          </div>

          <div>
            <SectionLabel>Models ({selectedModels.length} selected)</SectionLabel>
            <div className="space-y-1">
              {MODEL_OPTIONS.map((option) => {
                const key = modelKey(option);
                const checked = selectedModels.some((model) => modelKey(model) === key);
                return (
                  <label
                    key={key}
                    onClick={() => toggleModel(option)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition ${checked ? "bg-slate-800/60" : "hover:bg-slate-900/40"}`}
                  >
                    <div className={`h-3.5 w-3.5 flex-shrink-0 rounded border transition ${checked ? "border-sky-500 bg-sky-500" : "border-slate-700 bg-transparent"}`}>
                      {checked && (
                        <svg viewBox="0 0 10 10" className="h-full w-full p-[1.5px] text-white">
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
                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${PROVIDER_DOT[option.provider_id] ?? "bg-slate-500"}`} />
                    <span className="text-xs leading-none text-slate-300">{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <SectionLabel>Market</SectionLabel>
            <div className="space-y-1.5">
              {marketIndices.length > 0
                ? marketIndices.map((index) => (
                    <MarketRow
                      key={index.symbol}
                      symbol={index.symbol}
                      name={index.name}
                      price={index.price}
                      changePct={index.change_percent}
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
                      className="flex items-center justify-between rounded-lg border border-slate-800/50 bg-slate-900/40 px-2.5 py-1.5 animate-pulse"
                    >
                      <div>
                        <p className="text-xs font-mono font-bold text-slate-400">{row.t}</p>
                        <p className="text-[9px] text-slate-600">{row.n}</p>
                      </div>
                      <div className="h-6 w-14 rounded bg-slate-800" />
                    </div>
                  ))}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 flex-shrink-0 items-center justify-between gap-4 border-b border-slate-800/60 bg-slate-950/50 px-6 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
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
            <span className="text-xs uppercase tracking-wide text-slate-500">
              {RESEARCH_TYPES.find((type) => type.value === researchType)?.label ?? ""} Analysis
            </span>
            {isLoading && (
              <div className="flex items-center gap-1.5 text-xs text-sky-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Running…
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800/60 hover:text-slate-300">
              <Bell className="h-4 w-4" />
            </button>
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setShowUserMenu((value) => !value)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${showUserMenu ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-white"}`}
              >
                <Settings className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Settings</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${showUserMenu ? "rotate-180" : ""}`} />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/50">
                  <div className="border-b border-slate-800 px-4 py-3">
                    <p className="truncate text-xs font-semibold text-slate-200">{user?.name ?? "Account"}</p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <button
                      disabled
                      className="flex w-full cursor-not-allowed items-center gap-2.5 px-4 py-2 text-left text-xs text-slate-500"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Preferences
                      <span className="ml-auto rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-600">Soon</span>
                    </button>
                    <button
                      onClick={() => {
                        logout();
                        setShowUserMenu(false);
                      }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs text-rose-400 transition hover:bg-rose-950/30"
                    >
                      <LogOut className="h-3.5 w-3.5" />
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
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">Free Intelligence Mode</p>
                <p className="mt-1 text-sm text-slate-300">
                  Open-web intelligence is active — global market, macro, filings, sentiment, and thematic routing aggregated in real time.
                </p>
              </div>
              <button
                onClick={() => router.push("/settings/api-keys")}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-xl border border-sky-700/60 px-4 py-2 text-sm font-semibold text-sky-200 transition hover:border-sky-500 hover:text-white"
              >
                Connect Premium AI Providers
              </button>
            </div>
          </div>
        )}

        {storeError && (
          <div className="flex flex-shrink-0 items-start gap-3 border-b border-rose-900/40 bg-rose-950/30 px-6 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-400" />
            <p className="flex-1 text-xs text-rose-300">{storeError}</p>
            <button onClick={() => setError(null)} className="text-rose-500 transition hover:text-rose-300">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-950 to-[#080c14]">
          {!hasResults && !isLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10">
                <TrendingUp className="h-6 w-6 text-sky-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Financial Intelligence</h2>
              <p className="max-w-sm text-sm leading-relaxed text-slate-500">
                Ask a company, market, macro, or thematic question. Free Intelligence Mode routes across global market data, filings, news, sentiment, and macro context — no API key required.
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                {[
                  "Should I buy Nvidia after earnings?",
                  "How will oil prices affect airline stocks?",
                  "Compare Reliance vs Adani long term",
                ].map((sample) => (
                  <button
                    key={sample}
                    onClick={() => setQueryText(sample)}
                    className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-400 transition hover:border-sky-500/40 hover:text-sky-400"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 p-6">
              {stockData && selectedTicker && <TickerCard data={stockData} />}

              {(synthesis || isLoading) && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div>
                    {synthesis ? (
                      <ConsensusIndicator
                        bullishConfidence={synthesis.confidence_score.bullish_confidence}
                        bearishConfidence={synthesis.confidence_score.bearish_confidence}
                        consensusAgreement={synthesis.confidence_score.consensus_agreement}
                      />
                    ) : (
                      <div className="h-full space-y-3 rounded-xl border border-slate-800/60 bg-slate-900/40 p-5 animate-pulse">
                        <div className="h-3 w-1/2 rounded bg-slate-800" />
                        <div className="h-2 w-full rounded bg-slate-800" />
                        <div className="h-2 w-5/6 rounded bg-slate-800" />
                      </div>
                    )}
                  </div>

                  <div>
                    {synthesis ? (
                      <BullishCasePanel
                        points={synthesis.bullish_theses.length > 0
                          ? synthesis.bullish_theses[0].supporting_points.length > 0
                            ? synthesis.bullish_theses[0].supporting_points
                            : synthesis.bullish_theses.slice(0, 4).map((thesis) => thesis.title)
                          : synthesis.unique_insights.slice(0, 4).map((insight) => insight.insight)}
                      />
                    ) : (
                      <div className="h-full space-y-2 rounded-xl border border-emerald-900/30 bg-emerald-950/10 p-5 animate-pulse">
                        <div className="mb-3 h-3 w-1/3 rounded bg-emerald-950/60" />
                        {[1, 2, 3].map((item) => <div key={item} className="h-2.5 w-full rounded bg-emerald-950/40" />)}
                      </div>
                    )}
                  </div>

                  <div>
                    {synthesis ? (
                      <BearishCasePanel
                        points={synthesis.bearish_theses.length > 0
                          ? synthesis.bearish_theses[0].supporting_points.length > 0
                            ? synthesis.bearish_theses[0].supporting_points
                            : synthesis.bearish_theses.slice(0, 4).map((thesis) => thesis.title)
                          : synthesis.disagreements.slice(0, 3).map((disagreement) => disagreement.topic)}
                      />
                    ) : (
                      <div className="h-full space-y-2 rounded-xl border border-rose-900/30 bg-rose-950/10 p-5 animate-pulse">
                        <div className="mb-3 h-3 w-1/3 rounded bg-rose-950/60" />
                        {[1, 2, 3].map((item) => <div key={item} className="h-2.5 w-full rounded bg-rose-950/40" />)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {synthesis && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {synthesis.investment_score !== 0 && <InvestmentScore score={synthesis.investment_score} />}
                  {(synthesis.direct_answer || synthesis.summary) && (
                    <div className={`rounded-xl border border-slate-800/60 bg-slate-900/40 p-5 ${synthesis.investment_score !== 0 ? "lg:col-span-2" : "lg:col-span-3"}`}>
                      <SectionLabel>Direct Answer</SectionLabel>
                      {synthesis.direct_answer && <p className="mb-3 text-sm leading-relaxed text-white">{synthesis.direct_answer}</p>}
                      <SectionLabel>Synthesis Summary</SectionLabel>
                      <p className="text-sm leading-relaxed text-slate-300">{synthesis.summary}</p>
                      {synthesis.ai_consensus && (
                        <div className="mt-4 rounded-lg border border-sky-900/30 bg-sky-950/10 px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">AI Consensus</p>
                          <p className="mt-1 text-xs leading-snug text-slate-300">{synthesis.ai_consensus}</p>
                        </div>
                      )}
                      {synthesis.confidence_detail && (
                        <p className="mt-3 text-xs text-slate-500">{synthesis.confidence_detail.explanation}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {synthesis && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <InsightListCard title="Context" items={synthesis.company_or_theme_context} />
                  <InsightListCard title="Catalysts" items={synthesis.key_catalysts} tone="sky" />
                  <InsightListCard title="Market Sentiment" items={synthesis.market_sentiment} />
                </div>
              )}

              {synthesis && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <InsightListCard title="Macro Impact" items={synthesis.macro_impact} />
                  </div>
                  {synthesis.key_risks.length > 0 ? <KeyRisksSection risks={synthesis.key_risks} /> : null}
                </div>
              )}

              {(responseEntries.length > 0 || isLoading) && (
                <div>
                  <SectionLabel>Model Responses ({responseEntries.length} / {selectedModels.length})</SectionLabel>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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

                    {isLoading &&
                      selectedModels
                        .filter((model) => !responseEntries.some(([key]) => key === modelKey(model)))
                        .map((model) => (
                          <StreamingTextDisplay
                            key={modelKey(model)}
                            text=""
                            isStreaming={true}
                            providerName={model.provider_id}
                            modelId={model.model_id}
                          />
                        ))}
                  </div>
                </div>
              )}

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
