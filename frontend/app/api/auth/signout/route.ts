import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function clearSupabaseCookies(response: NextResponse, request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieNames = cookieHeader
    .split(";")
    .map((entry) => entry.trim().split("=")[0]?.trim())
    .filter((name): name is string => Boolean(name) && name.startsWith("sb-"));

  cookieNames.forEach((name) => {
    response.cookies.set(name, "", {
      expires: new Date(0),
      maxAge: 0,
      path: "/",
    });
  });
}

export async function POST(request: Request) {
  const response = NextResponse.json({ data: { ok: true } });
  const supabase = await createSupabaseServerClient();

  await supabase.auth.signOut();
  clearSupabaseCookies(response, request);

  return response;
}
