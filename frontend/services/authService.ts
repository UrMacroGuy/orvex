import api from "@/lib/api";
import type { User } from "@/store/useAuthStore";
import { APP_URL } from "@/lib/env";

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
  };
}

export const authService = {
  async register(email: string, password: string, name: string): Promise<TokenResponse> {
    try {
      const response = await api.post<ApiResponse<TokenResponse>>("/auth/register", {
        email,
        password,
        name,
      });

      if (response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.error?.message || "Registration failed");
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw error;
    }
  },

  async login(email: string, password: string): Promise<TokenResponse> {
    try {
      const response = await api.post<ApiResponse<TokenResponse>>("/auth/login", {
        email,
        password,
      });

      if (response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.error?.message || "Login failed");
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw error;
    }
  },

  async refreshToken(): Promise<TokenResponse> {
    try {
      const response = await api.post<ApiResponse<TokenResponse>>("/auth/refresh");

      if (response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.error?.message || "Token refresh failed");
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw error;
    }
  },

  async getProfile(): Promise<User> {
    try {
      const response = await api.get<ApiResponse<User>>("/auth/me");

      if (response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.error?.message || "Failed to fetch profile");
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw error;
    }
  },

  initiateOAuth(provider: "google" | "github"): void {
    const redirectUri = `${APP_URL}/auth/callback`;
    const backendUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"}/api/v1`;
    window.location.href = `${backendUrl}/auth/oauth/${provider}/authorize`;
  },

  async handleOAuthCallback(
    provider: string,
    code: string,
    state: string
  ): Promise<TokenResponse> {
    try {
      const response = await api.post<ApiResponse<TokenResponse>>(
        `/auth/oauth/${provider}/callback`,
        { code, state }
      );

      if (response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.error?.message || "OAuth callback failed");
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw error;
    }
  },

  logout(): void {
    localStorage.removeItem("auth-store");
  },
};
