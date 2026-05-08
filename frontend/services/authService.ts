import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { APP_URL } from "@/lib/env";
import { apiFetch } from "@/lib/api";
import type { AuthProfile } from "@/store/useAuthStore";

export const authService = {
  async register(email: string, password: string, name: string) {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${APP_URL}/auth/callback`,
        data: {
          name,
        },
      },
    });

    if (error) {
      throw error;
    }

    return data;
  },

  async login(email: string, password: string) {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    return data;
  },

  async getSession(): Promise<Session | null> {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return data.session;
  },

  async getProfile(): Promise<AuthProfile | null> {
    const session = await this.getSession();
    const user = session?.user;

    if (!user?.id || !user.email) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: (user.user_metadata?.name as string | undefined) ?? null,
      oauth_provider:
        user.app_metadata?.provider && user.app_metadata.provider !== "email"
          ? String(user.app_metadata.provider)
          : null,
      is_verified: !!user.email_confirmed_at,
      created_at: user.created_at,
      updated_at: user.updated_at ?? null,
    };
  },

  initiateOAuth(provider: "google" | "github"): void {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${APP_URL}/auth/callback`,
      },
    });
  },

  async exchangeCodeForSession(code: string) {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    return data;
  },

  onAuthStateChange(callback: (user: User | null) => Promise<void> | void) {
    const supabase = createSupabaseBrowserClient();
    return supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
      await callback(session?.user ?? null);
    });
  },

  async logout() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  },

  async saveProviderKey(payload: {
    provider_id: string;
    key: string;
    label: string;
  }) {
    return apiFetch<{ ok: true }>("/api/keys", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
