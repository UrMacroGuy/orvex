"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useProviderKeys } from "@/hooks/useProviderKeys";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { ProviderOnboardingCard } from "@/components/ProviderOnboardingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROVIDER_CATALOG } from "@/lib/provider-catalog";
import { authService } from "@/services/authService";

type Step = "welcome" | "providers" | "keys" | "complete";

export default function OnboardingPage() {
  useRequireAuth();
  const router = useRouter();
  const { user } = useAuth();
  const { hasProviderKeys, refresh } = useProviderKeys();
  const [step, setStep] = useState<Step>("welcome");
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(new Set(["gemini"]));
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
      const entries = Array.from(selectedProviders)
        .filter((providerId) => apiKeys[providerId])
        .map((providerId) => ({
          provider_id: providerId,
          key: apiKeys[providerId],
          label: `${providerId}-key`,
        }));

      for (const entry of entries) {
        await authService.saveProviderKey(entry);
      }

      await refresh();
      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save API keys");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = () => {
    router.push("/financial");
  };

  const handleSkipToFreeMode = () => {
    router.push("/financial");
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
                Start with free open-web intelligence now, then connect premium AI only if you want it.
              </p>

              <div className="space-y-4 mb-8">
                <p className="text-slate-300">
                  Orvex already gives you SEC analysis, Yahoo Finance data, macro overlays, and news plus Reddit sentiment without any API key.
                </p>
              </div>

              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Button
                  onClick={handleSkipToFreeMode}
                  className="bg-sky-600 hover:bg-sky-700 text-white px-8 py-6 text-lg"
                >
                  Use Free Intelligence Mode
                </Button>

                <Button
                  onClick={() => setStep("providers")}
                  variant="outline"
                  className="border-slate-700 text-slate-300 px-8 py-6 text-lg"
                >
                  Connect Premium AI Providers
                </Button>
              </div>
            </motion.div>
          )}

          {step === "providers" && (
            <motion.div
              key="providers"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <h2 className="text-2xl font-light mb-3 text-white">Connect Premium AI Providers</h2>
              <p className="mb-8 text-sm text-slate-400">
                Free Intelligence Mode is already available. Add keys here only for premium synthesis and model orchestration.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {PROVIDER_CATALOG.map((provider) => (
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
                  onClick={handleSkipToFreeMode}
                  variant="outline"
                  className="border-slate-700 text-slate-300"
                >
                  Skip for now
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
              <h2 className="text-2xl font-light mb-3 text-white">Add API Keys</h2>
              <p className="mb-8 text-sm text-slate-400">
                These keys are optional upgrades. Free Intelligence Mode will keep working without them.
              </p>

              {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400">
                  {error}
                </div>
              )}

              <div className="space-y-6 mb-8">
                {Array.from(selectedProviders).map((providerId) => {
                  const provider = PROVIDER_CATALOG.find((p) => p.id === providerId);
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
                          Get key {"->"}
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
                  onClick={handleSkipToFreeMode}
                  variant="outline"
                  className="border-slate-700 text-slate-300"
                  disabled={isSubmitting}
                >
                  Skip for now
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

              <h2 className="text-3xl font-light mb-4 text-white">You&apos;re all set!</h2>
              <p className="text-lg text-slate-400 mb-12">
                Your account is ready for open financial intelligence
                {hasProviderKeys
                  ? ` with ${selectedProviders.size} premium provider${selectedProviders.size !== 1 ? "s" : ""} connected.`
                  : "."}
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
