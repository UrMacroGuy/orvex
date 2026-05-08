import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { authService } from "@/services/authService";

export interface UseAuthReturn {
  user: ReturnType<typeof useAuthStore.getState>["profile"];
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const {
    user,
    profile,
    session,
    isLoading,
    error,
    setUser,
    setProfile,
    setSession,
    setLoading,
    setError,
    logout,
  } = useAuthStore();

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await authService.login(email, password);
        setSession(response.session ?? null);
        setUser(response.user ?? null);
        setProfile(await authService.getProfile());
        router.push(await authService.getPostAuthRedirectPath());
      } catch (err) {
        const message = err instanceof Error ? err.message : "Login failed";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [router, setError, setLoading, setProfile, setSession, setUser],
  );

  const signup = useCallback(
    async (email: string, password: string, name: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await authService.register(email, password, name);
        setSession(response.session ?? null);
        setUser(response.user ?? null);
        setProfile(await authService.getProfile());
        router.push(response.session ? "/onboarding" : "/login");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Signup failed";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [router, setError, setLoading, setProfile, setSession, setUser],
  );

  const handleLogout = useCallback(async () => {
    await authService.logout();
    logout();
    router.push("/login");
  }, [logout, router]);

  return {
    user: profile,
    isLoading,
    error,
    login,
    signup,
    logout: handleLogout,
    isAuthenticated: !!session && !!user,
  };
}
