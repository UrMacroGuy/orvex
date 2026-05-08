"use client";

interface ConsensusIndicatorProps {
  bullishConfidence: number;
  bearishConfidence: number;
  consensusAgreement: number;
}

export function ConsensusIndicator({
  bullishConfidence,
  bearishConfidence,
  consensusAgreement,
}: ConsensusIndicatorProps) {
  const bullishPct = (bullishConfidence * 100).toFixed(0);
  const bearishPct = (bearishConfidence * 100).toFixed(0);
  const agreementPct = (consensusAgreement * 100).toFixed(0);

  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-lg p-6">
      <h3 className="text-sm font-semibold text-slate-300 uppercase mb-4">
        AI Consensus
      </h3>

      <div className="space-y-4">
        {/* Bullish vs Bearish Gauge */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-emerald-400">Bullish</span>
            <span className="text-xs font-medium text-rose-400">Bearish</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${bullishPct}%` }}
            />
            <div
              className="bg-rose-500 transition-all"
              style={{ width: `${bearishPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>{bullishPct}%</span>
            <span>{bearishPct}%</span>
          </div>
        </div>

        {/* Agreement Metric */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-slate-400">Model Agreement</span>
            <span className="text-sm font-bold text-sky-400">{agreementPct}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="bg-sky-500 transition-all"
              style={{ width: `${agreementPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
