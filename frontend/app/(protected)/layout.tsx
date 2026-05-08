"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session, user, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && (!session || !user)) {
      router.push("/login");
    }
  }, [isLoading, router, session, user]);

  if (isLoading || !session || !user) {
    return null;
  }

  return <>{children}</>;
}
