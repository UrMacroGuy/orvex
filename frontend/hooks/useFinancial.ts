"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { financialApi } from "@/lib/financial-api";
import { useFinancialStore } from "@/store/useFinancialStore";
import { FinancialQuery } from "@/types/financial";

export function useTickerData(ticker: string | null) {
  const setStockData = useFinancialStore((s) => s.setStockData);

  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;

    fetch(`/api/financial/ticker/${encodeURIComponent(ticker)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Ticker fetch failed: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled && data.data?.stock_data) {
          setStockData(data.data.stock_data);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [ticker, setStockData]);

  return { isLoading: false, error: null };
}

export function useMarketSnapshot() {
  const setMarketSnapshot = useFinancialStore((s) => s.setMarketSnapshot);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/financial/market")
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (!cancelled && data?.data) setMarketSnapshot(data.data);
      })
      .catch(() => {})
      .finally(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [setMarketSnapshot]);

  return { isLoading: false, error: null };
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
