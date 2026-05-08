import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, type User } from "@/store/useAuthStore";
import { authService } from "@/services/authService";

export interface UseAuthReturn {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const { user, token, isLoading, error, setUser, setToken, setLoading, setError, logout } =
    useAuthStore();

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await authService.login(email, password);
        setUser(response.user);
        setToken(response.access_token);
        router.push("/onboarding");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Login failed";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setUser, setToken, setLoading, setError, router]
  );

  const signup = useCallback(
    async (email: string, password: string, name: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await authService.register(email, password, name);
        setUser(response.user);
        setToken(response.access_token);
        router.push("/onboarding");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Signup failed";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setUser, setToken, setLoading, setError, router]
  );

  const handleLogout = useCallback(() => {
    logout();
    router.push("/login");
  }, [logout, router]);

  return {
    user,
    token,
    isLoading,
    error,
    login,
    signup,
    logout: handleLogout,
    isAuthenticated: !!token && !!user,
  };
}
