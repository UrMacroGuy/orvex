"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ProviderOnboardingCard } from "@/components/ProviderOnboardingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PROVIDERS = [
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

type Step = "welcome" | "providers" | "keys" | "complete";

export default function OnboardingPage() {
  useRequireAuth();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [step, setStep] = useState<Step>("welcome");
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(
    new Set(["openrouter"])
  );
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProviderToggle = (providerId: string) => {
    const updated = new Set(selectedProviders);
    if (updated.has(providerId)) {
      updated.delete(providerId);
    } else {
      updated.add(providerId);
    }
    setSelectedProviders(updated);
  };

  const handleKeyChange = (providerId: string, key: string) => {
    setApiKeys((prev) => ({ ...prev, [providerId]: key }));
  };

  const handleSubmitKeys = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const api = (await import("@/lib/api")).default;

      const entries = Array.from(selectedProviders)
        .filter((providerId) => apiKeys[providerId])
        .map((providerId) => ({
          provider_id: providerId,
          key: apiKeys[providerId],
          label: `${providerId}-key`,
        }));

      for (const entry of entries) {
        await api.post("/keys", entry);
      }

      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save API keys");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-black py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <h1 className="text-4xl font-light mb-4 text-white">
                Welcome to Orvex, {user?.name}!
              </h1>
              <p className="text-xl text-slate-400 mb-12">
                Let's set up your AI providers to orchestrate intelligence
              </p>

              <div className="space-y-4 mb-8">
                <p className="text-slate-300">
                  You'll need API keys from at least one provider. We recommend starting with
                  OpenRouter for the fastest setup.
                </p>
              </div>

              <Button
                onClick={() => setStep("providers")}
                className="bg-sky-600 hover:bg-sky-700 text-white px-8 py-6 text-lg"
              >
                Continue Setup
              </Button>

              <Button
                onClick={() => setStep("complete")}
                variant="outline"
                className="ml-4 border-slate-700 text-slate-300"
              >
                Skip for Now
              </Button>
            </motion.div>
          )}

          {step === "providers" && (
            <motion.div
              key="providers"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <h2 className="text-2xl font-light mb-8 text-white">Select Providers</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {PROVIDERS.map((provider) => (
                  <ProviderOnboardingCard
                    key={provider.id}
                    provider={provider}
                    isSelected={selectedProviders.has(provider.id)}
                    onToggle={() => handleProviderToggle(provider.id)}
                  />
                ))}
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={() => setStep("welcome")}
                  variant="outline"
                  className="border-slate-700 text-slate-300"
                >
                  Back
                </Button>
                <Button
                  onClick={() => setStep("keys")}
                  disabled={selectedProviders.size === 0}
                  className="bg-sky-600 hover:bg-sky-700 text-white flex-1"
                >
                  Continue with {selectedProviders.size} provider{selectedProviders.size !== 1 ? "s" : ""}
                </Button>
              </div>
            </motion.div>
          )}

          {step === "keys" && (
            <motion.div
              key="keys"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <h2 className="text-2xl font-light mb-8 text-white">Add API Keys</h2>

              {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400">
                  {error}
                </div>
              )}

              <div className="space-y-6 mb-8">
                {Array.from(selectedProviders).map((providerId) => {
                  const provider = PROVIDERS.find((p) => p.id === providerId);
                  if (!provider) return null;

                  return (
                    <div key={providerId} className="border border-slate-700 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-medium text-white">{provider.name}</h3>
                          <p className="text-sm text-slate-400">{provider.description}</p>
                        </div>
                        <a
                          href={provider.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-400 hover:text-sky-300 text-sm"
                        >
                          Get key →
                        </a>
                      </div>

                      <Input
                        type="password"
                        placeholder="Paste your API key here"
                        value={apiKeys[providerId] || ""}
                        onChange={(e) => handleKeyChange(providerId, e.target.value)}
                        disabled={isSubmitting}
                        className="w-full"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={() => setStep("providers")}
                  variant="outline"
                  className="border-slate-700 text-slate-300"
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmitKeys}
                  disabled={
                    isSubmitting ||
                    !Array.from(selectedProviders).some((p) => apiKeys[p])
                  }
                  className="bg-sky-600 hover:bg-sky-700 text-white flex-1"
                >
                  {isSubmitting ? "Saving..." : "Save API Keys"}
                </Button>
              </div>
            </motion.div>
          )}

          {step === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-8"
              >
                <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto">
                  <svg
                    className="w-8 h-8 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </motion.div>

              <h2 className="text-3xl font-light mb-4 text-white">You're all set!</h2>
              <p className="text-lg text-slate-400 mb-12">
                Your account is ready to orchestrate AI intelligence across{" "}
                {selectedProviders.size > 0
                  ? `${selectedProviders.size} provider${selectedProviders.size !== 1 ? "s" : ""}`
                  : "multiple providers"}
              </p>

              <Button
                onClick={handleComplete}
                className="bg-sky-600 hover:bg-sky-700 text-white px-8 py-6 text-lg"
              >
                Go to Dashboard
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
