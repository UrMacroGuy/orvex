"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { authService } from "@/services/authService";

export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let mounted = true;

    const store = useAuthStore.getState();

    const initialize = async () => {
      store.setLoading(true);
      try {
        const session = await authService.getSession();
        const profile = await authService.getProfile();
        if (!mounted) return;
        store.setSession(session);
        store.setUser(session?.user ?? null);
        store.setProfile(profile);
      } catch (error) {
        if (!mounted) return;
        store.setError(error instanceof Error ? error.message : "Failed to initialize auth");
      } finally {
        if (mounted) {
          store.setLoading(false);
        }
      }
    };

    void initialize();

    const { data } = authService.onAuthStateChange(async (user) => {
      if (!mounted) return;
      const session = await authService.getSession();
      const profile = await authService.getProfile();
      store.setSession(session);
      store.setUser(user);
      store.setProfile(profile);
      store.setLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return <>{children}</>;
}
