"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, user } = useAuthStore();

  useEffect(() => {
    if (!token || !user) {
      router.push("/login");
    }
  }, [token, user, router]);

  if (!token || !user) {
    return null;
  }

  return <>{children}</>;
}
