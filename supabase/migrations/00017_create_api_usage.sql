-- Table de tracking des coûts API Claude (Anthropic).
-- Alimenté par chaque route qui appelle le modèle (analyze, clarify, chat, rapport).
-- Le coût est stocké en USD (devise native Anthropic) ; l'affichage EUR est
-- calculé côté app via un taux de conversion configurable.

CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Qui
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,             -- snapshot pour survivre à la suppression du user

  -- Quoi
  provider TEXT NOT NULL DEFAULT 'anthropic',
  model TEXT NOT NULL,         -- 'claude-sonnet-4-20250514'
  operation TEXT NOT NULL,     -- 'analyze' | 'clarify' | 'chat' | 'rapport'

  -- Volume
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cache_read_tokens INT NOT NULL DEFAULT 0,
  cache_write_tokens INT NOT NULL DEFAULT 0,

  -- Coût (USD)
  cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,

  -- Contexte
  analysis_id UUID,            -- si applicable, référence analyses.id (pas de FK stricte)
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_operation ON api_usage(operation, created_at DESC);

ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Seul le service role lit/écrit. Les admins accèdent via les routes /api/admin/*
-- qui utilisent le service role. Aucun accès direct depuis le client auth user.
CREATE POLICY "Service role full access api_usage" ON api_usage
  FOR ALL USING (true) WITH CHECK (true);
