-- Fonction : scoring de similarité pour "Mon Affaire"
CREATE OR REPLACE FUNCTION score_affaire_similaire(
  p_juridiction_type TEXT,
  p_perimetre TEXT,
  p_demandeur_type TEXT,
  p_bloc INTEGER,
  p_motif_opa BOOLEAN,
  p_motif_ops BOOLEAN,
  p_post_2017 BOOLEAN
) RETURNS TABLE (
  total_similaires INTEGER,
  taux_annulation DECIMAL,
  taux_recevabilite DECIMAL,
  delai_moyen DECIMAL,
  montant_moyen DECIMAL,
  decisions_proches JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH scored AS (
    SELECT
      d.*,
      (
        CASE WHEN d.juridiction_type = p_juridiction_type THEN 25 ELSE 0 END +
        CASE WHEN d.perimetre_conclusion = p_perimetre THEN 20 ELSE 0 END +
        CASE WHEN d.demandeur_type = p_demandeur_type THEN 20 ELSE 0 END +
        CASE WHEN d.bloc_negociation = p_bloc THEN 15 ELSE 0 END +
        CASE WHEN d.contraire_opa = p_motif_opa AND p_motif_opa = TRUE THEN 10 ELSE 0 END +
        CASE WHEN d.contraire_ops = p_motif_ops AND p_motif_ops = TRUE THEN 5 ELSE 0 END +
        CASE WHEN d.post_ordonnance_2017 = p_post_2017 THEN 5 ELSE 0 END
      ) AS similarity_score
    FROM decisions d
    WHERE d.status = 'validated'
  ),
  filtered AS (
    SELECT * FROM scored WHERE similarity_score >= 40
  )
  SELECT
    COUNT(*)::INTEGER,
    ROUND(COUNT(*) FILTER (WHERE filtered.resultat = 'annulation')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1),
    ROUND(COUNT(*) FILTER (WHERE filtered.recevable = TRUE)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1),
    ROUND(AVG(filtered.delai_statuer_mois)::DECIMAL, 1),
    ROUND(AVG(filtered.montant_condamnations)::DECIMAL, 0),
    (SELECT jsonb_agg(jsonb_build_object(
      'id', f.id,
      'juridiction', f.juridiction,
      'date', f.date_decision,
      'resultat', f.resultat,
      'numero_rg', f.numero_rg,
      'score', f.similarity_score
    ) ORDER BY f.similarity_score DESC)
    FROM (SELECT * FROM filtered ORDER BY similarity_score DESC LIMIT 5) f)
  FROM filtered;
END;
$$ LANGUAGE plpgsql;
