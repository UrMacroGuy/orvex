/* eslint-disable @typescript-eslint/no-explicit-any */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    throw new Error("Unauthorized");
  }

  return { id: user.id, email: user.email };
}

export async function ensureProfile(user: AuthenticatedUser, name?: string | null) {
  const admin = getSupabaseAdmin() as any;
  await admin.from("profiles").upsert([
    {
      id: user.id,
      email: user.email,
      name: name ?? null,
      is_verified: true,
    },
  ]);
}
