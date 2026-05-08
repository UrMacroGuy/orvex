export interface ProviderCatalogEntry {
  id: string;
  name: string;
  description: string;
  recommended: boolean;
  docsUrl: string;
}

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Gemini Flash is the recommended low-cost default for open financial intelligence.",
    recommended: true,
    docsUrl: "https://makersuite.google.com/app/apikey",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access multiple models from one API key.",
    recommended: false,
    docsUrl: "https://openrouter.ai/keys",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT family models for synthesis and reasoning",
    recommended: false,
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models for advanced reasoning",
    recommended: false,
    docsUrl: "https://console.anthropic.com/account/keys",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    description: "Web-connected AI for real-time research",
    recommended: false,
    docsUrl: "https://www.perplexity.ai/settings/api",
  },
  {
    id: "groq",
    name: "Groq",
    description: "Lightning-fast inference engine",
    recommended: false,
    docsUrl: "https://console.groq.com/keys",
  },
  {
    id: "together",
    name: "Together AI",
    description: "Open-source models on demand",
    recommended: false,
    docsUrl: "https://www.together.ai/",
  },
  {
    id: "mistral",
    name: "Mistral",
    description: "Efficient European AI models",
    recommended: false,
    docsUrl: "https://console.mistral.ai/api-keys/",
  },
];
