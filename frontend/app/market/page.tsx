import { Card } from "@/components/ui/card";

export default function MarketTerminal() {
  const categories = [
    "Global Markets",
    "AI & Technology",
    "Banking & Finance",
    "Commodities",
    "Energy",
    "Earnings",
    "India Markets",
    "US Markets",
    "Europe",
    "China",
    "Crypto",
    "Central Banks",
    "Rates & Inflation",
    "Geopolitics",
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-2xl font-light text-white">Global Market Intelligence</h2>
        <div className="flex gap-2">
            {/* Categories would be swipable/sticky here */}
            {categories.slice(0, 5).map(cat => (
                <button key={cat} className="px-3 py-1 rounded-full border border-slate-800 text-[10px] uppercase tracking-widest text-slate-500 hover:text-white hover:border-slate-600 transition">
                    {cat}
                </button>
            ))}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Market feed cards */}
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Card key={i} className="p-5 bg-slate-900/30 border-slate-800 hover:border-slate-700 transition">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-bold text-sky-500 uppercase">Reuters</span>
              <span className="text-[10px] text-slate-600">10 mins ago</span>
            </div>
            <h4 className="text-sm font-medium text-slate-200 mb-2">Central Banks Signal Continued Rate Pressure Amid Inflation</h4>
            <p className="text-xs text-slate-500 line-clamp-3">
              The latest policy meetings indicate a hawkish stance for upcoming quarters as global commodity prices remain volatile and supply chains tighten...
            </p>
            <div className="mt-4 flex gap-2">
                <span className="px-2 py-0.5 rounded text-[9px] bg-slate-800 text-slate-400">#CentralBanks</span>
                <span className="px-2 py-0.5 rounded text-[9px] bg-slate-800 text-slate-400">#Macro</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
