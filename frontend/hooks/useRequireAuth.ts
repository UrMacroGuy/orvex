import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

export function useRequireAuth() {
  const router = useRouter();
  const { session, user, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && (!session || !user)) {
      router.push("/login");
    }
  }, [isLoading, router, session, user]);

  return { isAuthenticated: !!session && !!user };
}
