"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";

export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useAuthStore.persist?.rehydrate();
  }, []);

  return <>{children}</>;
}
