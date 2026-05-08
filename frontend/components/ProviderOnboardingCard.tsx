"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ProviderCardProps {
  provider: {
    id: string;
    name: string;
    description: string;
    recommended?: boolean;
    docsUrl: string;
  };
  isSelected: boolean;
  onToggle: () => void;
}

export function ProviderOnboardingCard({
  provider,
  isSelected,
  onToggle,
}: ProviderCardProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onToggle}
      className="text-left"
    >
      <Card
        className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
          isSelected
            ? "border-sky-500 bg-sky-500/10"
            : "border-slate-700 bg-slate-900/50 hover:border-slate-600"
        }`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-white">{provider.name}</h3>
              {provider.recommended && (
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">
                  Recommended
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400">{provider.description}</p>
          </div>

          <motion.div
            animate={isSelected ? { scale: 1 } : { scale: 0.8 }}
            className={`ml-4 flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center ${
              isSelected
                ? "border-sky-500 bg-sky-500"
                : "border-slate-600 bg-transparent"
            }`}
          >
            {isSelected && <Check className="w-4 h-4 text-white" />}
          </motion.div>
        </div>

        <a
          href={provider.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-sky-400 hover:text-sky-300"
        >
          Get API key →
        </a>
      </Card>
    </motion.button>
  );
}
