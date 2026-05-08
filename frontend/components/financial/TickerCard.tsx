"use client";

interface TickerCardProps {
  ticker: string;
  price: number;
  change: number;
  onClick?: () => void;
}

export function TickerCard({ ticker, price, change, onClick }: TickerCardProps) {
  const isUp = change >= 0;
  const changeColor = isUp ? "text-emerald-400" : "text-rose-400";

  return (
    <div
      onClick={onClick}
      className="p-4 rounded-lg bg-slate-900/50 backdrop-blur border border-slate-800 hover:border-slate-700 transition cursor-pointer"
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-white">{ticker}</h3>
          <p className="text-sm text-slate-400">{price.toFixed(2)}</p>
        </div>
        <div className={`text-sm font-medium ${changeColor}`}>
          {isUp ? "+" : ""}{change.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}
