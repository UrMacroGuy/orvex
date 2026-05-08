"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, Zap } from "lucide-react";

interface StreamingTextDisplayProps {
  text: string;
  isStreaming: boolean;
  providerName: string;
  modelId?: string;
  latencyMs?: number;
  error?: string;
}

const PROVIDER_STYLES: Record<
  string,
  { label: string; dot: string; badge: string }
> = {
  openai: {
    label: "OpenAI",
    dot: "bg-emerald-400",
    badge: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  },
  anthropic: {
    label: "Anthropic",
    dot: "bg-orange-400",
    badge: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  },
  gemini: {
    label: "Gemini",
    dot: "bg-blue-400",
    badge: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  },
  openrouter: {
    label: "OpenRouter",
    dot: "bg-violet-400",
    badge: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  },
};

function getProviderStyle(providerId: string) {
  return (
    PROVIDER_STYLES[providerId.toLowerCase()] ?? {
      label: providerId,
      dot: "bg-slate-400",
      badge: "text-slate-400 bg-slate-400/10 border-slate-400/20",
    }
  );
}

function shortModelId(modelId?: string) {
  if (!modelId) return "";
  // e.g. "claude-sonnet-4-5" → "Sonnet 4.5", "gpt-4o" → "GPT-4o"
  return modelId
    .replace(/^gpt-/i, "GPT-")
    .replace(/^claude-/i, "")
    .replace(/-(\d)/g, " $1")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function StreamingTextDisplay({
  text,
  isStreaming,
  providerName,
  modelId,
  latencyMs,
  error,
}: StreamingTextDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const style = getProviderStyle(providerName);

  useEffect(() => {
    if (containerRef.current && isStreaming) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text, isStreaming]);

  return (
    <div
      className={`
        rounded-xl border backdrop-blur-sm flex flex-col
        transition-all duration-200
        ${
          error
            ? "border-rose-800/50 bg-rose-950/10"
            : "border-slate-800/60 bg-slate-900/40 hover:border-slate-700/60"
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/50">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              error
                ? "bg-rose-500"
                : isStreaming
                ? `${style.dot} animate-pulse`
                : style.dot
            }`}
          />
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${style.badge}`}
          >
            {style.label}
          </span>
          {modelId && (
            <span className="text-xs text-slate-500 font-mono">
              {shortModelId(modelId)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isStreaming && (
            <span className="text-xs text-sky-400 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Live
            </span>
          )}
          {latencyMs != null && latencyMs > 0 && (
            <span className="text-xs text-slate-500 font-mono">
              {latencyMs >= 1000
                ? `${(latencyMs / 1000).toFixed(1)}s`
                : `${latencyMs}ms`}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div
        ref={containerRef}
        className="flex-1 px-4 py-3 text-sm leading-relaxed overflow-y-auto max-h-64 min-h-[80px]"
      >
        {error ? (
          <div className="flex items-start gap-2 text-rose-400">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="text-xs">{error}</span>
          </div>
        ) : text ? (
          <p className="text-slate-300 whitespace-pre-wrap">{text}</p>
        ) : isStreaming ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-slate-800 rounded-full w-full" />
            <div className="h-3 bg-slate-800 rounded-full w-5/6" />
            <div className="h-3 bg-slate-800 rounded-full w-4/6" />
          </div>
        ) : (
          <p className="text-slate-600 italic text-xs">Waiting…</p>
        )}
      </div>
    </div>
  );
}
