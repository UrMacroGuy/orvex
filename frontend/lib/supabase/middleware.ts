import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const onboardingPath = pathname.startsWith("/onboarding");
  const settingsPath = pathname.startsWith("/settings/api-keys");
  const authenticatedPath =
    pathname.startsWith("/financial") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/research") ||
    onboardingPath ||
    settingsPath;

  const authPath = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const homePath = pathname === "/";

  if (authenticatedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const { count, error } = await supabase
      .from("provider_keys")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    const hasProviderKeys = (count ?? 0) > 0;

    if (authPath || homePath) {
      const url = request.nextUrl.clone();
      url.pathname = hasProviderKeys ? "/financial" : "/onboarding";
      return NextResponse.redirect(url);
    }

    if (
      !hasProviderKeys &&
      (pathname.startsWith("/financial") ||
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/research"))
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    if (hasProviderKeys && onboardingPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/financial";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
