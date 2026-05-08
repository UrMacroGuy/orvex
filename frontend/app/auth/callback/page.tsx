"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { authService } from "@/services/authService";

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setUser, setProfile, setSession } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get("code");

        if (!code) {
          setError("Missing authorization code");
          return;
        }

        const response = await authService.exchangeCodeForSession(code);
        setSession(response.session ?? null);
        setUser(response.user ?? null);
        setProfile(await authService.getProfile());

        router.push(await authService.getPostAuthRedirectPath());
      } catch (err) {
        const message = err instanceof Error ? err.message : "OAuth callback failed";
        setError(message);

        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } finally {
        setIsLoading(false);
      }
    };

    handleCallback();
  }, [router, searchParams, setProfile, setSession, setUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Completing sign in...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center max-w-sm mx-auto px-4">
          <p className="text-red-400 mb-4">{error}</p>
          <p className="text-slate-400">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return null;
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-black">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500" />
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
