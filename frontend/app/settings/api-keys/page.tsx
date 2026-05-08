"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authService } from "@/services/authService";
import { useProviderKeys } from "@/hooks/useProviderKeys";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { PROVIDER_CATALOG } from "@/lib/provider-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ApiKeysSettingsPage() {
  useRequireAuth();
  const router = useRouter();
  const { keys, hasProviderKeys, isLoading, error, refresh } = useProviderKeys();
  const [draftKeys, setDraftKeys] = useState<Record<string, string>>({});
  const [savingProviderId, setSavingProviderId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const keysByProvider = useMemo(
    () => new Map(keys.map((key) => [key.provider_id, key])),
    [keys],
  );

  const handleSave = async (providerId: string, providerName: string) => {
    const key = draftKeys[providerId]?.trim();
    if (!key) {
      return;
    }

    setSavingProviderId(providerId);
    setSaveError(null);

    try {
      await authService.saveProviderKey({
        provider_id: providerId,
        key,
        label: `${providerName} Key`,
      });
      setDraftKeys((current) => ({ ...current, [providerId]: "" }));
      await refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save API key");
    } finally {
      setSavingProviderId(null);
    }
  };

  return (
    <div className="min-h-screen bg-black px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-950/80 p-8 backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-400">
                API Settings
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Provider API Keys</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Free Intelligence Mode works without any provider key. Add premium provider keys here only if you want upgraded AI synthesis.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" asChild className="border-slate-700 text-slate-300">
                <Link href="/onboarding">Open Onboarding</Link>
              </Button>
              <Button
                onClick={() => router.push("/financial")}
                className="bg-sky-600 text-white hover:bg-sky-500"
              >
                Open Financial Dashboard
              </Button>
            </div>
          </div>

          {!hasProviderKeys && !isLoading ? (
            <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-100">
              Free Intelligence Mode is active. Connect premium AI providers here whenever you want deeper model orchestration.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          {saveError ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              {saveError}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4">
          {PROVIDER_CATALOG.map((provider) => {
            const savedKey = keysByProvider.get(provider.id);
            const isSaving = savingProviderId === provider.id;

            return (
              <div
                key={provider.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-medium text-white">{provider.name}</h2>
                      {savedKey ? (
                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
                          Connected
                        </span>
                      ) : null}
                    </div>
                    <p className="max-w-2xl text-sm text-slate-400">{provider.description}</p>
                    {savedKey ? (
                      <p className="text-xs text-slate-500">
                        Stored key: {savedKey.masked}
                      </p>
                    ) : null}
                  </div>

                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-sky-400 hover:text-sky-300"
                  >
                    Get key
                  </a>
                </div>

                <div className="mt-5 flex flex-col gap-3 md:flex-row">
                  <Input
                    type="password"
                    value={draftKeys[provider.id] ?? ""}
                    onChange={(event) =>
                      setDraftKeys((current) => ({
                        ...current,
                        [provider.id]: event.target.value,
                      }))
                    }
                    placeholder={`Paste ${provider.name} API key`}
                    className="flex-1"
                    disabled={isSaving}
                  />
                  <Button
                    onClick={() => handleSave(provider.id, provider.name)}
                    disabled={isSaving || !(draftKeys[provider.id] ?? "").trim()}
                    className="bg-sky-600 text-white hover:bg-sky-500"
                  >
                    {isSaving ? "Saving..." : savedKey ? "Update Key" : "Save Key"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
