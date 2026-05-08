"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { motion } from "framer-motion";

export default function HomePage() {
  const router = useRouter();
  const { user, token } = useAuthStore();

  useEffect(() => {
    if (token && user) {
      router.push("/financial");
    } else {
      router.push("/login");
    }
  }, [token, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center"
      >
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto"></div>
      </motion.div>
    </div>
  );
}
