import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const ModelSelector = () => {
  const models = ["GPT-4o", "Claude 3.5 Sonnet", "Gemini 1.5 Pro"];

  return (
    <div className="flex gap-3 mb-8 justify-center">
      {models.map((model) => (
        <Badge 
          key={model} 
          variant="secondary"
          className="px-4 py-1.5 cursor-pointer hover:bg-slate-800 transition-colors border-slate-700"
        >
          {model}
        </Badge>
      ))}
    </div>
  );
};
