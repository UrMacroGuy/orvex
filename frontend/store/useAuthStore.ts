import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";

export interface AuthProfile {
  id: string;
  email: string;
  name: string | null;
  oauth_provider: string | null;
  is_verified: boolean;
  created_at?: string;
  updated_at?: string | null;
}

export interface AuthState {
  user: User | null;
  profile: AuthProfile | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;

  setUser: (user: User | null) => void;
  setProfile: (profile: AuthProfile | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  session: null,
  isLoading: true,
  error: null,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  logout: () =>
    set({
      user: null,
      profile: null,
      session: null,
      error: null,
      isLoading: false,
    }),
}));
