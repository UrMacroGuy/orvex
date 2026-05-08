import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Dashboard() {
  const history = [
    { id: 1, title: "Quantum computing market analysis", date: "2 hours ago" },
    { id: 2, title: "LLM reasoning benchmarks", date: "1 day ago" },
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      <h2 className="text-2xl font-light mb-8">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Recent Research</h3>
          {history.map((item) => (
            <Card key={item.id} className="p-4 bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors">
              <div className="font-medium">{item.title}</div>
              <div className="text-xs text-slate-500 mt-2">{item.date}</div>
            </Card>
          ))}
        </div>
        <Card className="p-6 bg-slate-900/30 border-slate-800">
          <h3 className="font-medium mb-4">Quick Stats</h3>
          <Separator className="my-4 bg-slate-800" />
          <div className="text-slate-400">Total Queries: 42</div>
        </Card>
      </div>
    </div>
  );
}
