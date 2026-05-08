"use client";

import { MarketSnapshot } from "@/types/financial";

interface MarketSnapshotViewProps {
  data: MarketSnapshot | null;
}

export function MarketSnapshotView({ data }: MarketSnapshotViewProps) {
  if (!data) {
    return (
      <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-lg p-4 h-48 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading market data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Indices */}
      <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-lg p-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">Indices</h3>
        <div className="space-y-2">
          {data.indices.map((idx) => (
            <div key={idx.symbol} className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-white">{idx.name}</p>
                <p className="text-xs text-slate-500">{idx.symbol}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-white">{idx.price.toFixed(0)}</p>
                <p className={idx.change_percent >= 0 ? "text-xs text-emerald-400" : "text-xs text-rose-400"}>
                  {idx.change_percent >= 0 ? "+" : ""}{idx.change_percent.toFixed(2)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Gainers */}
      <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-lg p-4">
        <h3 className="text-xs font-semibold text-emerald-400 uppercase mb-3">Top Gainers</h3>
        <div className="space-y-2">
          {data.top_gainers.slice(0, 3).map((stock) => (
            <div key={stock.ticker} className="flex justify-between items-center">
              <p className="text-sm font-medium text-white">{stock.ticker}</p>
              <p className="text-sm text-emerald-400">+{stock.change_percent.toFixed(2)}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top Losers */}
      <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-lg p-4">
        <h3 className="text-xs font-semibold text-rose-400 uppercase mb-3">Top Losers</h3>
        <div className="space-y-2">
          {data.top_losers.slice(0, 3).map((stock) => (
            <div key={stock.ticker} className="flex justify-between items-center">
              <p className="text-sm font-medium text-white">{stock.ticker}</p>
              <p className="text-sm text-rose-400">{stock.change_percent.toFixed(2)}%</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
