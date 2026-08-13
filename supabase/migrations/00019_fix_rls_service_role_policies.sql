-- Migration 00019 : correction des policies RLS ouvertes à PUBLIC.
--
-- PROBLÈME (Critique)
-- Les policies « Service role full access » ont été créées sans clause `TO`.
-- En PostgreSQL, une policy sans `TO` s'applique à PUBLIC — donc aux rôles
-- `anon` et `authenticated`. Or les policies permissives se combinent en OU
-- logique : une seule policy `USING (true)` rend décoratives toutes les
-- policies d'isolation déclarées à côté.
--
-- Conséquence : avec la seule clé NEXT_PUBLIC_SUPABASE_ANON_KEY (publique par
-- construction), n'importe quel visiteur pouvait lire, modifier ou supprimer
-- les analyses de tous les utilisateurs — soit des descriptions d'affaires
-- couvertes par le secret professionnel — ainsi que la table api_usage
-- (emails clients + coûts).
--
-- CORRECTION
-- On supprime purement ces policies. Le rôle `service_role` bypasse RLS
-- nativement (BYPASSRLS) : il n'a jamais eu besoin d'une policy. Les policies
-- d'isolation par `auth.uid()` déjà présentes redeviennent donc effectives.
--
-- Pour api_usage : aucune policy pour les utilisateurs finaux. RLS reste
-- activé et, sans policy permissive, l'accès direct via anon/authenticated est
-- refusé par défaut. Seul le service_role (routes serveur) y accède.
--
-- VÉRIFICATION après application :
--   select tablename, policyname, roles, cmd, qual
--   from pg_policies where schemaname = 'public' order by tablename;
-- Aucune ligne ne doit afficher roles = {public} avec qual = true.

-- ── analyses ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role full access" ON public.analyses;

-- ── api_usage ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role full access api_usage" ON public.api_usage;

-- ── clients (table supprimée en 00016 — DROP défensif au cas où une base
--    aurait été montée depuis scripts/setup-database.sql) ────────────────
DROP POLICY IF EXISTS "Service role full access on clients" ON public.clients;

-- ── Filet de sécurité : RLS explicitement activé sur les tables vivantes.
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.api_usage IS
  'Tracking des coûts API. RLS activé SANS policy permissive : seul le '
  'service_role (qui bypasse RLS) y accède, depuis les routes serveur. '
  'Ne jamais ajouter de policy USING (true) sans clause TO.';
