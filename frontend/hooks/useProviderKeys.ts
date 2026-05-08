"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { authService, type ProviderKeyRecord } from "@/services/authService";

export function useProviderKeys() {
  const query = useQuery<ProviderKeyRecord[], Error>({
    queryKey: ["provider-keys"],
    queryFn: () => authService.listProviderKeys(),
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
