export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          oauth_provider: string | null;
          is_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          oauth_provider?: string | null;
          is_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      provider_keys: {
        Row: {
          id: string;
          user_id: string;
          provider_id: string;
          label: string;
          masked: string;
          ciphertext: string;
          iv: string;
          auth_tag: string;
          last_validated: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider_id: string;
          label: string;
          masked: string;
          ciphertext: string;
          iv: string;
          auth_tag: string;
          last_validated?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["provider_keys"]["Insert"]>;
        Relationships: [];
      };
      research_queries: {
        Row: {
          id: string;
          user_id: string;
          prompt: string;
          selected_models: Json;
          options: Json;
          status: string;
          error: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          prompt: string;
          selected_models: Json;
          options: Json;
          status?: string;
          error?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["research_queries"]["Insert"]>;
        Relationships: [];
      };
      model_responses: {
        Row: {
          id: string;
          query_id: string;
          provider_id: string;
          model_id: string;
          status: string;
          text: string | null;
          latency_ms: number;
          input_tokens: number;
          output_tokens: number;
          error: string | null;
          error_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          query_id: string;
          provider_id: string;
          model_id: string;
          status: string;
          text?: string | null;
          latency_ms?: number;
          input_tokens?: number;
          output_tokens?: number;
          error?: string | null;
          error_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["model_responses"]["Insert"]>;
        Relationships: [];
      };
      syntheses: {
        Row: {
          id: string;
          query_id: string;
          summary: string;
          consensus: Json;
          disagreements: Json;
          unique_insights: Json;
          citations: Json;
          financial_synthesis: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          query_id: string;
          summary?: string;
          consensus?: Json;
          disagreements?: Json;
          unique_insights?: Json;
          citations?: Json;
          financial_synthesis?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["syntheses"]["Insert"]>;
        Relationships: [];
      };
    };
  };
}
