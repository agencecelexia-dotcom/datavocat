import { z } from "zod";

// Enums pour les champs structurés
export const juridictionTypeEnum = z.enum(["TJ", "CA", "CASS"]);
export const appelSensEnum = z.enum(["confirmatif", "infirmatif", "partiellement_infirmatif"]);
export const cassationRejetEnum = z.enum(["cassation", "rejet", "cassation_partielle"]);
export const perimetreEnum = z.enum(["établissement", "entreprise", "groupe", "UES", "branche"]);
export const demandeurTypeEnum = z.enum(["employeur", "OS_signataire", "OS_non_signataire", "salarié", "CSE", "tiers"]);
export const partieTiersEnum = z.enum(["partie", "tiers"]);
export const resultatEnum = z.enum(["annulation", "validation", "irrecevabilité"]);
export const annulationTypeEnum = z.enum(["totale", "partielle"]);
export const statusEnum = z.enum(["pending", "extracting", "review", "validated", "error"]);

// Schéma d'extraction IA — les 39 champs retournés par Claude
export const extractionSchema = z.object({
  // Cat 1 — Activité juridictionnelle
  juridiction: z.string().nullable(),
  juridiction_type: juridictionTypeEnum.nullable(),
  juridiction_ville: z.string().nullable(),
  juridiction_ressort: z.string().nullable(),
  date_decision: z.string().nullable(), // YYYY-MM-DD
  numero_rg: z.string().nullable(),
  delai_statuer_mois: z.number().int().nullable(),
  ref_premiere_instance: z.string().nullable(),
  ref_appel: z.string().nullable(),
  appel_sens: appelSensEnum.nullable(),
  pourvoi: z.boolean().nullable(),
  cassation_ou_rejet: cassationRejetEnum.nullable(),

  // Cat 2 — Accords contestés
  secteur_conclusion: z.string().nullable(),
  objet_accord: z.string().nullable(),
  bloc_negociation: z.number().int().min(1).max(3).nullable(),
  stipulations_branche: z.string().nullable(),
  perimetre_conclusion: perimetreEnum.nullable(),
  mode_conclusion: z.string().nullable(),

  // Cat 3 — Recevabilité
  demandeur_type: demandeurTypeEnum.nullable(),
  demandeur_partie_ou_tiers: partieTiersEnum.nullable(),
  forclusion: z.boolean().nullable(),
  forclusion_detail: z.string().nullable(),
  defaut_interet_agir: z.boolean().nullable(),
  defaut_interet_agir_detail: z.string().nullable(),
  defaut_qualite_agir: z.boolean().nullable(),
  defaut_qualite_agir_detail: z.string().nullable(),

  // Cat 4 — Causes d'invalidité
  champ_demande_nullite: z.string().nullable(),
  contraire_opa: z.boolean().nullable(),
  contraire_opa_detail: z.string().nullable(),
  contraire_ops: z.boolean().nullable(),
  contraire_ops_detail: z.string().nullable(),
  contraire_opd: z.boolean().nullable(),
  contraire_opd_detail: z.string().nullable(),
  defaut_qualite_signataires: z.boolean().nullable(),
  defaut_qualite_signataires_detail: z.string().nullable(),
  objet_illicite: z.boolean().nullable(),
  objet_illicite_detail: z.string().nullable(),
  contrepartie_illusoire: z.boolean().nullable(),
  contrepartie_illusoire_detail: z.string().nullable(),
  vices_consentement: z.boolean().nullable(),
  vices_consentement_detail: z.string().nullable(),
  autres_demandes: z.string().nullable(),

  // Cat 5 — Traitement de l'invalidité
  resultat: resultatEnum.nullable(),
  annulation_totale_ou_partielle: annulationTypeEnum.nullable(),
  annulation_retroactive: z.boolean().nullable(),
  arguments_retroactivite: z.string().nullable(),
  annulation_pour_avenir: z.boolean().nullable(),
  arguments_avenir: z.string().nullable(),
  annulation_date_future: z.boolean().nullable(),
  arguments_date_future: z.string().nullable(),
  dommages_identifies: z.string().nullable(),
  montant_condamnations: z.number().nullable(),
  debiteur_condamnations: z.string().nullable(),
  creancier_condamnations: z.string().nullable(),
  responsabilite_etat: z.boolean().nullable(),

  // Temporel
  post_ordonnance_2017: z.boolean().nullable(),

  // Métadonnées extraction
  confidence_globale: z.number().min(0).max(1),
  alertes: z.array(z.string()).optional(),
});

export type ExtractionResult = z.infer<typeof extractionSchema>;

// Schéma pour le formulaire "Mon Affaire"
export const monAffaireSchema = z.object({
  juridiction_type: juridictionTypeEnum,
  juridiction_ville: z.string().optional(),
  perimetre_conclusion: perimetreEnum,
  demandeur_type: demandeurTypeEnum,
  bloc_negociation: z.number().int().min(1).max(3),
  motif_opa: z.boolean().default(false),
  motif_ops: z.boolean().default(false),
  motif_opd: z.boolean().default(false),
  motif_defaut_qualite_signataires: z.boolean().default(false),
  motif_vices_consentement: z.boolean().default(false),
  motif_objet_illicite: z.boolean().default(false),
  motif_contrepartie_illusoire: z.boolean().default(false),
  post_ordonnance_2017: z.boolean(),
  mode_conclusion: z.string().optional(),
  secteur_conclusion: z.string().optional(),
});

export type MonAffaireInput = z.infer<typeof monAffaireSchema>;
