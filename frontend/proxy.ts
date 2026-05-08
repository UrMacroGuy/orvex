import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/onboarding",
    "/settings/api-keys",
    "/research/:path*",
    "/dashboard/:path*",
    "/financial/:path*",
  ],
};
