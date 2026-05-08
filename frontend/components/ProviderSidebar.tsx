"use client";

import { useAppStore } from "@/store/useAppStore";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Zap,
  BrainCircuit,
  Bot,
  Database,
  Cpu,
  Sparkles,
  Binary,
  Gauge,
  MessageSquareText,
} from "lucide-react";
import { ProviderConnectionModal } from "./ProviderConnectionModal";
import { Card } from "./ui/card";

const PROVIDER_ICONS: Record<string, LucideIcon> = {
  openrouter: Zap,
  openai: BrainCircuit,
  anthropic: Bot,
  gemini: Database,
  groq: Cpu,
  deepseek: Sparkles,
  together: Binary,
  cohere: BrainCircuit,
  mistral: Gauge,
  fireworks: Sparkles,
  perplexity: MessageSquareText,
};

export const ProviderSidebar = () => {
  const providers = useAppStore((state) => state.providers);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);

  const sortedProviders = Object.values(providers).sort((a, b) => {
    if (a.id === "openrouter") return -1;
    if (b.id === "openrouter") return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="w-80 border-r border-slate-800/50 bg-slate-950/80 backdrop-blur-3xl flex flex-col h-full shadow-2xl">
      <div className="p-6">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-6 px-2">
          Intelligence Orchestration
        </h3>

        <div className="space-y-2">
          {sortedProviders.map((provider) => {
            const Icon = PROVIDER_ICONS[provider.id] || Bot;
            const isFeatured = provider.id === "openrouter";

            return (
              <Card
                key={provider.id}
                onClick={() => !provider.connected && setActiveProvider(provider.id)}
                className={`group relative overflow-hidden p-4 cursor-pointer transition-all duration-300 bg-slate-900/40 hover:bg-slate-900 border ${
                  provider.connected ? "border-emerald-500/20" : "border-slate-800"
                } ${
                  isFeatured
                    ? "ring-1 ring-sky-500/20 hover:ring-sky-500/40"
                    : "hover:border-slate-700"
                }`}
              >
                {isFeatured && (
                  <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 ${
                        provider.connected
                          ? "text-emerald-400"
                          : isFeatured
                            ? "text-sky-400"
                            : "text-slate-500"
                      } group-hover:text-slate-300 transition-colors`}
                    />
                    <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                      {provider.name}
                    </span>
                  </div>
                  {provider.connected && (
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-8">
          <div className="group p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border border-slate-800 transition-all hover:border-sky-500/30">
            <h4 className="text-sm font-semibold text-slate-200 mb-1">Fastest Onboarding</h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Connect <span className="text-sky-400">OpenRouter</span> to instantly access every
              frontier model with a single API key.
            </p>
            <button className="text-[10px] font-bold uppercase tracking-widest text-sky-400 hover:text-sky-300 transition-colors">
              Get Started -&gt;
            </button>
          </div>
        </div>
      </div>

      <ProviderConnectionModal
        providerId={activeProvider || ""}
        isOpen={!!activeProvider}
        onClose={() => setActiveProvider(null)}
      />
    </div>
  );
};
