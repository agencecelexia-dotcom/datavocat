-- Cache des statistiques pré-calculées
CREATE TABLE stats_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT now(),
  sample_size INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_stats_cache_key ON stats_cache(cache_key);
