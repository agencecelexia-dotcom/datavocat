-- ═══════════════════════════════════════════
-- FONCTION : Rafraîchir le cache des stats
-- ═══════════════════════════════════════════

CREATE OR REPLACE FUNCTION refresh_stats_cache()
RETURNS void AS $$
DECLARE
  total_count INTEGER;
BEGIN
  -- Compter les décisions validées
  SELECT COUNT(*) INTO total_count FROM decisions WHERE status = 'validated';

  -- Stats globales
  INSERT INTO stats_cache (cache_key, data, sample_size)
  SELECT
    'global',
    jsonb_build_object(
      'total_decisions', COUNT(*),
      'taux_annulation', ROUND(COUNT(*) FILTER (WHERE resultat = 'annulation')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1),
      'delai_moyen_mois', ROUND(AVG(delai_statuer_mois)::DECIMAL, 1),
      'montant_moyen', ROUND(AVG(montant_condamnations)::DECIMAL, 0)
    ),
    COUNT(*)::INTEGER
  FROM decisions WHERE status = 'validated'
  ON CONFLICT (cache_key)
  DO UPDATE SET
    data = EXCLUDED.data,
    computed_at = now(),
    sample_size = EXCLUDED.sample_size;

  -- Stats par juridiction
  INSERT INTO stats_cache (cache_key, data, sample_size)
  SELECT
    'juridiction',
    COALESCE(jsonb_agg(row_to_json(v)::jsonb), '[]'::jsonb),
    total_count
  FROM v_stats_par_juridiction v
  ON CONFLICT (cache_key)
  DO UPDATE SET
    data = EXCLUDED.data,
    computed_at = now(),
    sample_size = EXCLUDED.sample_size;

  -- Stats par motif
  INSERT INTO stats_cache (cache_key, data, sample_size)
  SELECT
    'motif',
    COALESCE(jsonb_agg(row_to_json(v)::jsonb), '[]'::jsonb),
    total_count
  FROM v_stats_par_motif v
  ON CONFLICT (cache_key)
  DO UPDATE SET
    data = EXCLUDED.data,
    computed_at = now(),
    sample_size = EXCLUDED.sample_size;

  -- Stats appel
  INSERT INTO stats_cache (cache_key, data, sample_size)
  SELECT
    'appel',
    COALESCE(jsonb_agg(row_to_json(v)::jsonb), '[]'::jsonb),
    total_count
  FROM v_stats_appel v
  ON CONFLICT (cache_key)
  DO UPDATE SET
    data = EXCLUDED.data,
    computed_at = now(),
    sample_size = EXCLUDED.sample_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════
-- TRIGGER : Rafraîchir le cache après validation
-- ═══════════════════════════════════════════

CREATE OR REPLACE FUNCTION on_decision_validated()
RETURNS TRIGGER AS $$
BEGIN
  -- Rafraîchir le cache quand une décision passe en statut 'validated'
  IF NEW.status = 'validated' AND (OLD.status IS NULL OR OLD.status != 'validated') THEN
    PERFORM refresh_stats_cache();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_refresh_stats_on_validate
  AFTER UPDATE ON decisions
  FOR EACH ROW EXECUTE FUNCTION on_decision_validated();
