import { create } from 'zustand';

interface Provider {
  id: string;
  name: string;
  connected: boolean;
}

interface AppStore {
  activeModel: string;
  setActiveModel: (model: string) => void;
  providers: Record<string, Provider>;
  toggleProvider: (id: string) => void;
  setProviderConnected: (id: string, connected: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  activeModel: 'GPT-4o',
  setActiveModel: (model) => set({ activeModel: model }),
  providers: {
    openai: { id: 'openai', name: 'OpenAI', connected: false },
    anthropic: { id: 'anthropic', name: 'Anthropic', connected: false },
    gemini: { id: 'gemini', name: 'Gemini', connected: false },
    openrouter: { id: 'openrouter', name: 'OpenRouter', connected: false },
    groq: { id: 'groq', name: 'Groq', connected: false },
    deepseek: { id: 'deepseek', name: 'DeepSeek', connected: false },
    together: { id: 'together', name: 'Together AI', connected: false },
    cohere: { id: 'cohere', name: 'Cohere', connected: false },
    mistral: { id: 'mistral', name: 'Mistral', connected: false },
    fireworks: { id: 'fireworks', name: 'Fireworks AI', connected: false },
    perplexity: { id: 'perplexity', name: 'Perplexity', connected: false },
  },
  toggleProvider: (id) => set((state) => ({
    providers: { ...state.providers, [id]: { ...state.providers[id], connected: !state.providers[id].connected } }
  })),
  setProviderConnected: (id, connected) => set((state) => ({
    providers: { ...state.providers, [id]: { ...state.providers[id], connected } }
  })),
}));
