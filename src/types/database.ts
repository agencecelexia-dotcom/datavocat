// Type definitions for Supabase database
// These will be replaced with auto-generated types once Supabase project is connected
// Run: npx supabase gen types typescript --project-id=<id> > src/types/database.ts

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
      decisions: {
        Row: Decision;
        Insert: Partial<Decision> & { source: string };
        Update: Partial<Decision>;
        Relationships: [];
      };
      analyses: {
        Row: {
          id: string;
          query: string;
          response: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          query: string;
          response?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          query?: string;
          response?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      stats_cache: {
        Row: {
          id: string;
          cache_key: string;
          data: Json;
          computed_at: string;
          sample_size: number;
        };
        Insert: {
          id?: string;
          cache_key: string;
          data: Json;
          computed_at?: string;
          sample_size: number;
        };
        Update: {
          id?: string;
          cache_key?: string;
          data?: Json;
          computed_at?: string;
          sample_size?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      v_stats_par_juridiction: {
        Row: {
          juridiction_type: string | null;
          juridiction_ville: string | null;
          total_decisions: number;
          nb_annulations: number;
          nb_validations: number;
          nb_irrecevabilites: number;
          taux_annulation_pct: number | null;
          delai_moyen_mois: number | null;
          montant_moyen_condamnation: number | null;
        };
        Relationships: [];
      };
      v_stats_par_motif: {
        Row: {
          motif: string;
          nb_invoque: number;
          nb_succes: number;
          taux_succes_pct: number | null;
        };
        Relationships: [];
      };
      v_stats_appel: {
        Row: {
          juridiction_ville: string | null;
          total: number;
          confirmatifs: number;
          infirmatifs: number;
          taux_confirmation_pct: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      refresh_stats_cache: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      score_affaire_similaire: {
        Args: {
          p_juridiction_type: string;
          p_perimetre: string;
          p_demandeur_type: string;
          p_bloc: number;
          p_motif_opa: boolean;
          p_motif_ops: boolean;
          p_post_2017: boolean;
        };
        Returns: {
          total_similaires: number;
          taux_annulation: number;
          taux_recevabilite: number;
          delai_moyen: number;
          montant_moyen: number;
          decisions_proches: Json;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
};

export type Decision = {
  id: string;
  created_at: string;
  updated_at: string;
  // Métadonnées
  source: string;
  source_ref: string | null;
  pdf_path: string | null;
  raw_text: string | null;
  uploaded_by: string | null;
  cabinet_id: string | null;
  status: "pending" | "extracting" | "review" | "validated" | "error";
  extraction_confidence: number | null;
  validated_by: string | null;
  validated_at: string | null;
  // Cat 1 — Activité juridictionnelle
  juridiction: string | null;
  juridiction_type: string | null;
  juridiction_ville: string | null;
  juridiction_ressort: string | null;
  date_decision: string | null;
  numero_rg: string | null;
  delai_statuer_mois: number | null;
  ref_premiere_instance: string | null;
  ref_appel: string | null;
  appel_sens: string | null;
  pourvoi: boolean | null;
  cassation_ou_rejet: string | null;
  // Cat 2 — Accords contestés
  secteur_conclusion: string | null;
  objet_accord: string | null;
  bloc_negociation: number | null;
  stipulations_branche: string | null;
  perimetre_conclusion: string | null;
  mode_conclusion: string | null;
  // Cat 3 — Recevabilité
  demandeur_type: string | null;
  demandeur_partie_ou_tiers: string | null;
  forclusion: boolean | null;
  forclusion_detail: string | null;
  defaut_interet_agir: boolean | null;
  defaut_interet_agir_detail: string | null;
  defaut_qualite_agir: boolean | null;
  defaut_qualite_agir_detail: string | null;
  recevable: boolean | null;
  // Cat 4 — Causes d'invalidité
  champ_demande_nullite: string | null;
  contraire_opa: boolean | null;
  contraire_opa_detail: string | null;
  contraire_ops: boolean | null;
  contraire_ops_detail: string | null;
  contraire_opd: boolean | null;
  contraire_opd_detail: string | null;
  defaut_qualite_signataires: boolean | null;
  defaut_qualite_signataires_detail: string | null;
  objet_illicite: boolean | null;
  objet_illicite_detail: string | null;
  contrepartie_illusoire: boolean | null;
  contrepartie_illusoire_detail: string | null;
  vices_consentement: boolean | null;
  vices_consentement_detail: string | null;
  autres_demandes: string | null;
  // Cat 5 — Traitement de l'invalidité
  resultat: string | null;
  annulation_totale_ou_partielle: string | null;
  annulation_retroactive: boolean | null;
  arguments_retroactivite: string | null;
  annulation_pour_avenir: boolean | null;
  arguments_avenir: string | null;
  annulation_date_future: boolean | null;
  arguments_date_future: string | null;
  dommages_identifies: string | null;
  montant_condamnations: number | null;
  debiteur_condamnations: string | null;
  creancier_condamnations: string | null;
  responsabilite_etat: boolean | null;
  // Temporel
  post_ordonnance_2017: boolean | null;
  // Chaînage
  decision_parent_id: string | null;
  decision_enfant_ids: string[] | null;
};
