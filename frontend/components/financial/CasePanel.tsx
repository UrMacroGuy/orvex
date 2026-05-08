"use client";

interface CasePanelProps {
  title: string;
  points: string[];
  color: "emerald" | "rose";
  icon?: string;
}

const COLORS = {
  emerald: {
    wrapper: "border-emerald-900/40 bg-emerald-950/10",
    title: "text-emerald-400",
    titleBg: "bg-emerald-400/8",
    dot: "bg-emerald-500",
    empty: "text-emerald-800",
  },
  rose: {
    wrapper: "border-rose-900/40 bg-rose-950/10",
    title: "text-rose-400",
    titleBg: "bg-rose-400/8",
    dot: "bg-rose-500",
    empty: "text-rose-800",
  },
};

export function CasePanel({ title, points, color, icon }: CasePanelProps) {
  const c = COLORS[color];

  return (
    <div className={`${c.wrapper} border rounded-xl overflow-hidden`}>
      {/* Header */}
      <div
        className={`${c.titleBg} px-4 py-2.5 flex items-center justify-between border-b ${color === "emerald" ? "border-emerald-900/30" : "border-rose-900/30"}`}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-sm">{icon}</span>}
          <h3 className={`text-xs font-bold ${c.title} uppercase tracking-widest`}>
            {title}
          </h3>
        </div>
        <span
          className={`text-xs font-mono ${c.title} opacity-60`}
        >
          {points.length}
        </span>
      </div>

      {/* Points */}
      <div className="px-4 py-3 space-y-2.5">
        {points.length > 0 ? (
          points.map((point, i) => (
            <div key={i} className="flex gap-2.5 items-start">
              <span
                className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-[5px] ${c.dot}`}
              />
              <p className="text-sm text-slate-300 leading-snug">{point}</p>
            </div>
          ))
        ) : (
          <p className={`text-xs ${c.empty} italic`}>
            No {title.toLowerCase()} points yet
          </p>
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
