export interface ProviderCatalogEntry {
  id: string;
  name: string;
  description: string;
  recommended: boolean;
  docsUrl: string;
}

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access 100+ models via single API. Recommended for fastest setup.",
    recommended: true,
    docsUrl: "https://openrouter.ai/keys",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4, GPT-3.5, and other OpenAI models",
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
    id: "gemini",
    name: "Google Gemini",
    description: "Google's multimodal AI models",
    recommended: false,
    docsUrl: "https://makersuite.google.com/app/apikey",
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
