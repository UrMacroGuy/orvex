"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface CasePanelProps {
  title: string;
  points: string[];
  color: "emerald" | "rose";
  icon?: string;
  maxVisible?: number;
}

const COLORS = {
  emerald: {
    wrapper: "border-emerald-900/40 bg-emerald-950/10",
    title: "text-emerald-400",
    titleBg: "bg-emerald-400/8",
    borderBottom: "border-emerald-900/30",
    dot: "bg-emerald-500",
    empty: "text-emerald-800",
    expandBtn: "text-emerald-700 hover:text-emerald-500",
    badge: "bg-emerald-900/40 text-emerald-500",
  },
  rose: {
    wrapper: "border-rose-900/40 bg-rose-950/10",
    title: "text-rose-400",
    titleBg: "bg-rose-400/8",
    borderBottom: "border-rose-900/30",
    dot: "bg-rose-500",
    empty: "text-rose-800",
    expandBtn: "text-rose-700 hover:text-rose-500",
    badge: "bg-rose-900/40 text-rose-500",
  },
};

export function CasePanel({ title, points, color, icon, maxVisible = 4 }: CasePanelProps) {
  const c = COLORS[color];
  const [expanded, setExpanded] = useState(false);
  const showExpand = points.length > maxVisible;
  const visible = expanded ? points : points.slice(0, maxVisible);

  return (
    <div className={`${c.wrapper} border rounded-xl overflow-hidden`}>
      {/* Header */}
      <div className={`${c.titleBg} px-4 py-2.5 flex items-center justify-between border-b ${c.borderBottom}`}>
        <div className="flex items-center gap-2">
          {icon && <span className="text-sm">{icon}</span>}
          <h3 className={`text-xs font-bold ${c.title} uppercase tracking-widest`}>{title}</h3>
        </div>
        <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${c.badge}`}>
          {points.length}
        </span>
      </div>

      {/* Points */}
      <div className="px-4 py-3 space-y-2.5">
        {points.length > 0 ? (
          <>
            {visible.map((point, i) => (
              <div key={i} className="flex gap-2.5 items-start">
                <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-[5px] ${c.dot}`} />
                <p className="text-sm text-slate-300 leading-snug">{point}</p>
              </div>
            ))}
            {showExpand && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className={`flex items-center gap-1 text-[11px] font-medium mt-1 transition ${c.expandBtn}`}
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                {expanded ? "Show less" : `${points.length - maxVisible} more`}
              </button>
            )}
          </>
        ) : (
          <p className={`text-xs ${c.empty} italic`}>No {title.toLowerCase()} points yet</p>
        )}
      </div>
    </div>
  );
}

export function BullishCasePanel({ points }: { points: string[] }) {
  return <CasePanel title="Bull Case" points={points} color="emerald" icon="▲" />;
}

export function BearishCasePanel({ points }: { points: string[] }) {
  return <CasePanel title="Bear Case" points={points} color="rose" icon="▼" />;
}
