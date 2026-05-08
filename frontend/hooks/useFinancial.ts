"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { financialApi } from "@/lib/financial-api";
import { useFinancialStore } from "@/store/useFinancialStore";
import { FinancialQuery } from "@/types/financial";

// Market/ticker hooks can be upgraded to query-backed fetches without changing callers.
export function useTickerData(ticker: string | null) {
  void ticker;
  return { data: null, isLoading: false, error: null };
}

export function useMarketSnapshot() {
  return { data: null, isLoading: false, error: null };
}

export function useFinancialQuery() {
  const setLoading = useFinancialStore((s) => s.setLoading);
  const setError = useFinancialStore((s) => s.setError);
  const addStreamEvent = useFinancialStore((s) => s.addStreamEvent);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const mutation = useMutation({
    mutationFn: (q: FinancialQuery) => financialApi.createResearch(q),

    onMutate: () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setLoading(true);
      setError(null);
    },

    onSuccess: (data: { id: string }) => {
      financialApi.subscribeToStream(
        data.id,
        (event) => {
          addStreamEvent(event);
          if (event.type === "done" || event.type === "error") {
            setLoading(false);
          }
        },
        abortRef.current!.signal,
      );
    },

    onError: (err: Error) => {
      setError(err.message || "Failed to create research query");
      setLoading(false);
    },
  });

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, [setLoading]);

  return { ...mutation, cancel };
}

export function useStreamingResponse() {
  return useFinancialStore((s) => s.streamingResponses);
}
