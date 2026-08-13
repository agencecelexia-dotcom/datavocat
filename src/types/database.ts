// Type definitions for Supabase database

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      cabinets: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          plan?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          plan?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          cabinet_id: string | null;
          full_name: string | null;
          role: string;
          created_at: string;
        };
        Insert: {
          id: string;
          cabinet_id?: string | null;
          full_name?: string | null;
          role?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          cabinet_id?: string | null;
          full_name?: string | null;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      analyses: {
        Row: {
          id: string;
          user_id: string;
          query: string;
          response: string | null;
          status: string;
          jugement_final: string | null;
          jugement_date: string | null;
          jugement_resultat: "favorable" | "partiellement_favorable" | "defavorable" | null;
          /** Snapshot du corpus transmis au modèle (migration 00018). */
          judilibre_corpus: Json | null;
          /** Métriques du contrôle anti-hallucination (migration 00018). */
          verification: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          query: string;
          response?: string | null;
          status?: string;
          jugement_final?: string | null;
          jugement_date?: string | null;
          jugement_resultat?: "favorable" | "partiellement_favorable" | "defavorable" | null;
          judilibre_corpus?: Json | null;
          verification?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          query?: string;
          response?: string | null;
          status?: string;
          jugement_final?: string | null;
          jugement_date?: string | null;
          jugement_resultat?: "favorable" | "partiellement_favorable" | "defavorable" | null;
          judilibre_corpus?: Json | null;
          verification?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      api_usage: {
        Row: {
          id: string;
          user_id: string | null;
          user_email: string | null;
          provider: string;
          model: string;
          operation: string;
          input_tokens: number;
          output_tokens: number;
          cache_write_tokens: number;
          cache_read_tokens: number;
          cost_usd: number;
          analysis_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          user_email?: string | null;
          provider?: string;
          model: string;
          operation: string;
          input_tokens?: number;
          output_tokens?: number;
          cache_write_tokens?: number;
          cache_read_tokens?: number;
          cost_usd?: number;
          analysis_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          user_email?: string | null;
          provider?: string;
          model?: string;
          operation?: string;
          input_tokens?: number;
          output_tokens?: number;
          cache_write_tokens?: number;
          cache_read_tokens?: number;
          cost_usd?: number;
          analysis_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
