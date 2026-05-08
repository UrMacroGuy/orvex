"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { authService } from "@/services/authService";
import { useFinancialStore } from "@/store/useFinancialStore";

export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;

    const store = useAuthStore.getState();
    const resetFinancialStore = useFinancialStore.getState().reset;

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

    const { data } = authService.onAuthStateChange(async (event, session, user) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        queryClient.clear();
        resetFinancialStore();
        store.logout();
        router.refresh();
        return;
      }

      store.setSession(session);
      store.setUser(user);
      store.setProfile(user ? await authService.getProfile() : null);
      store.setError(null);
      store.setLoading(false);
      router.refresh();
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient, router]);

  return <>{children}</>;
}
