/* eslint-disable @typescript-eslint/no-explicit-any */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  oauthProvider: string | null;
  isVerified: boolean;
}

export interface StoredProviderKey {
  id: string;
  provider_id: string;
  label: string;
  masked: string;
  last_validated: string | null;
  created_at: string;
  updated_at: string;
}

export class RouteGuardError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = "internal") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    throw new Error("Unauthorized");
  }

  return {
    id: user.id,
    email: user.email,
    name: (user.user_metadata?.name as string | undefined) ?? null,
    oauthProvider:
      user.app_metadata?.provider && user.app_metadata.provider !== "email"
        ? String(user.app_metadata.provider)
        : null,
    isVerified: Boolean(user.email_confirmed_at),
  };
}

export async function ensureProfile(user: AuthenticatedUser, name?: string | null) {
  const admin = getSupabaseAdmin() as any;
  const { error } = await admin.from("profiles").upsert(
    [
      {
        id: user.id,
        email: user.email,
        name: name ?? user.name ?? null,
        oauth_provider: user.oauthProvider,
        is_verified: user.isVerified,
      },
    ],
    { onConflict: "id" },
  );

  if (error) {
    throw error;
  }
}

export async function listProviderKeys(userId: string): Promise<StoredProviderKey[]> {
  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("provider_keys")
    .select("id, provider_id, label, masked, last_validated, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as StoredProviderKey[];
}

export async function getProviderKeyCount(userId: string): Promise<number> {
  const keys = await listProviderKeys(userId);
  return keys.length;
}

export async function requireProviderAccess(): Promise<AuthenticatedUser> {
  const user = await requireAuthenticatedUser();
  const providerKeyCount = await getProviderKeyCount(user.id);

  if (providerKeyCount === 0) {
    throw new RouteGuardError(
      "Configure provider API keys to start analysis",
      403,
      "provider_keys_required",
    );
  }

  return user;
}

export function getRouteError(error: unknown, fallbackMessage: string) {
  if (error instanceof RouteGuardError) {
    return { status: error.status, message: error.message, code: error.code };
  }

  if (error instanceof Error && error.message === "Unauthorized") {
    return { status: 401, message: error.message, code: "unauthorized" };
  }

  return {
    status: 500,
    message: error instanceof Error ? error.message : fallbackMessage,
    code: "internal",
  };
}
