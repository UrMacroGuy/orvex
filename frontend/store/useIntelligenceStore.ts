"use client";

import { create } from "zustand";
import { IntelligenceSignal } from "@/types/signals";

interface IntelligenceStore {
  signals: IntelligenceSignal[];
  activeSignalId: string | null;
  isLoading: boolean;
  error: string | null;

  setSignals: (signals: IntelligenceSignal[]) => void;
  addSignal: (signal: IntelligenceSignal) => void;
  setActiveSignal: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  signals: [],
  activeSignalId: null,
  isLoading: false,
  error: null,
};

export const useIntelligenceStore = create<IntelligenceStore>((set) => ({
  ...initialState,

  setSignals: (signals) => set({ signals }),
  addSignal: (signal) =>
    set((state) => ({ signals: [signal, ...state.signals] })),
  setActiveSignal: (id) => set({ activeSignalId: id }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
