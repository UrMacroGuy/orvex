"use client";

import { StockData } from "@/types/financial";

interface StockHeaderProps {
  data: StockData;
}

export function StockHeader({ data }: StockHeaderProps) {
  const isUp = data.change_percent >= 0;
  const changeColor = isUp ? "text-emerald-400" : "text-rose-400";

  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-lg p-6 mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-3xl font-bold text-white">{data.ticker}</h1>
          <p className="text-slate-400">Stock Information</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-white">${data.price.toFixed(2)}</p>
          <p className={`text-lg font-semibold ${changeColor}`}>
            {isUp ? "+" : ""}{data.change_percent.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div>
          <p className="text-xs text-slate-500 uppercase">Market Cap</p>
          <p className="text-sm font-medium text-white">{data.market_cap || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase">P/E Ratio</p>
          <p className="text-sm font-medium text-white">
            {data.pe_ratio?.toFixed(2) || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase">Dividend Yield</p>
          <p className="text-sm font-medium text-white">
            {data.dividend_yield?.toFixed(2)}% || "—"
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase">52w High</p>
          <p className="text-sm font-medium text-white">
            ${data.fifty_two_week_high?.toFixed(2) || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase">52w Low</p>
          <p className="text-sm font-medium text-white">
            ${data.fifty_two_week_low?.toFixed(2) || "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
