"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { authService, type ProviderKeyRecord } from "@/services/authService";
import { useAuthStore } from "@/store/useAuthStore";

export function useProviderKeys() {
  const session = useAuthStore((state) => state.session);
  const userId = useAuthStore((state) => state.user?.id ?? null);

  const query = useQuery<ProviderKeyRecord[], Error>({
    queryKey: ["provider-keys", userId],
    queryFn: () => authService.listProviderKeys(),
    enabled: Boolean(session && userId),
    staleTime: 30_000,
  });

  const refresh = useCallback(async () => {
    const result = await query.refetch();
    if (result.error) {
      throw result.error;
    }
    return result.data ?? [];
  }, [query]);

  return {
    keys: query.data ?? [],
    hasProviderKeys: (query.data ?? []).length > 0,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refresh,
  };
}
