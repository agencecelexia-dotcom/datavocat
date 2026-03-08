export interface StatsParJuridiction {
  juridiction_type: string | null;
  juridiction_ville: string | null;
  total_decisions: number;
  nb_annulations: number;
  nb_validations: number;
  nb_irrecevabilites: number;
  taux_annulation_pct: number | null;
  delai_moyen_mois: number | null;
  montant_moyen_condamnation: number | null;
}

export interface StatsParMotif {
  motif: string;
  nb_invoque: number;
  nb_succes: number;
  taux_succes_pct: number | null;
}

export interface StatsAppel {
  juridiction_ville: string | null;
  total: number;
  confirmatifs: number;
  infirmatifs: number;
  taux_confirmation_pct: number | null;
}

export interface StatsGlobales {
  total_decisions: number;
  taux_annulation: number | null;
  delai_moyen_mois: number | null;
  montant_moyen: number | null;
}

export interface ScoreAffaireSimilaire {
  total_similaires: number;
  taux_annulation: number;
  taux_recevabilite: number;
  delai_moyen: number;
  montant_moyen: number;
  decisions_proches: {
    id: string;
    juridiction: string;
    date: string;
    resultat: string;
    numero_rg: string;
    score: number;
  }[];
}
