import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

export function useRequireAuth() {
  const router = useRouter();
  const { token, user } = useAuthStore();

  useEffect(() => {
    if (!token || !user) {
      router.push("/login");
    }
  }, [token, user, router]);

  return { isAuthenticated: !!token && !!user };
}
