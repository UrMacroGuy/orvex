import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import api from "@/lib/api";
import { ExternalLink, Key, CheckCircle2 } from "lucide-react";

interface ProviderConfig {
  id: string;
  name: string;
  keyUrl: string;
  description: string;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  openrouter: { id: 'openrouter', name: 'OpenRouter', keyUrl: 'https://openrouter.ai/keys', description: 'Recommended: Fastest setup. Access multiple models with one key.' },
  openai: { id: 'openai', name: 'OpenAI', keyUrl: 'https://platform.openai.com/api-keys', description: 'Access GPT-4o and other OpenAI frontier models.' },
  anthropic: { id: 'anthropic', name: 'Anthropic', keyUrl: 'https://console.anthropic.com/settings/keys', description: 'Access Claude 3.5 Sonnet and Opus models.' },
  gemini: { id: 'gemini', name: 'Gemini', keyUrl: 'https://aistudio.google.com/app/apikey', description: 'Access Gemini 1.5 Pro and Flash models.' },
  groq: { id: 'groq', name: 'Groq', keyUrl: 'https://console.groq.com/keys', description: 'Fast inference for Llama 3 and Mixtral models.' },
  deepseek: { id: 'deepseek', name: 'DeepSeek', keyUrl: 'https://platform.deepseek.com/api-keys', description: 'Access DeepSeek-V3 and R1 models.' },
  together: { id: 'together', name: 'Together AI', keyUrl: 'https://api.together.ai/settings/api-keys', description: 'Access a wide array of open-source models.' },
  cohere: { id: 'cohere', name: 'Cohere', keyUrl: 'https://dashboard.cohere.com/api-keys', description: 'Command R+ and embedding models.' },
  mistral: { id: 'mistral', name: 'Mistral', keyUrl: 'https://console.mistral.ai/api-keys', description: 'Access Mistral and Mixtral models.' },
  fireworks: { id: 'fireworks', name: 'Fireworks AI', keyUrl: 'https://fireworks.ai/account/api-keys', description: 'High performance model serving.' },
  perplexity: { id: 'perplexity', name: 'Perplexity', keyUrl: 'https://www.perplexity.ai/settings/api', description: 'Access Perplexity AI models.' },
};

export const ProviderConnectionModal = ({ providerId, isOpen, onClose }: { providerId: string; isOpen: boolean; onClose: () => void }) => {
  const [key, setKey] = useState("");
  const setConnected = useAppStore((state) => state.setProviderConnected);
  const provider = PROVIDERS[providerId];

  const handleConnect = async () => {
    try {
      await api.post('/keys', { provider_id: providerId, key, label: `${provider.name} Key` });
      setConnected(providerId, true);
      onClose();
    } catch (e) {
      console.error("Failed to connect provider", e);
    }
  };

  if (!provider) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-slate-950 border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-100">Connect {provider.name}</DialogTitle>
          <DialogDescription className="text-slate-400">{provider.description}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <Button variant="outline" className="w-full flex justify-between group" onClick={() => window.open(provider.keyUrl, '_blank')}>
            Get your {provider.name} API Key
            <ExternalLink className="w-4 h-4 ml-2 group-hover:text-sky-400" />
          </Button>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 uppercase">API Key</label>
            <div className="relative">
              <Key className="absolute left-3 top-3 w-4 h-4 text-slate-600" />
              <Input 
                className="pl-9 bg-slate-900 border-slate-800 text-slate-200"
                placeholder="sk-..." 
                value={key} 
                onChange={(e) => setKey(e.target.value)} 
              />
            </div>
          </div>
          
          <Button onClick={handleConnect} className="w-full bg-slate-100 text-black hover:bg-white font-semibold">
            Connect Provider
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
