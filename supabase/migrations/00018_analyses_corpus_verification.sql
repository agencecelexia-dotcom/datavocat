-- Migration 00018 : ajout des colonnes pour traçabilité du sourcing.
--
-- Contexte : éradication des hallucinations.
-- 1) judilibre_corpus : on stocke les décisions Judilibre effectivement
--    transmises au modèle, pour pouvoir auditer a posteriori et faire la
--    vérification post-génération.
-- 2) verification : compteurs de qualité de l'analyse (refs citées vs
--    vérifiées, phrases et lignes supprimées pour cause d'invention).

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS judilibre_corpus JSONB,
  ADD COLUMN IF NOT EXISTS verification JSONB;

COMMENT ON COLUMN public.analyses.judilibre_corpus IS
  'Décisions Judilibre transmises au modèle (snapshot pour audit). Tableau JSON de JudilibreDecision.';
COMMENT ON COLUMN public.analyses.verification IS
  'Résultat du contrôle anti-hallucination : { citedRefs, verifiedRefs, unverifiedRefs, removedSentences, removedRows }.';
