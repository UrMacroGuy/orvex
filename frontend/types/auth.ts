export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  oauth_provider: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export type OAuthProvider = "google" | "github";
