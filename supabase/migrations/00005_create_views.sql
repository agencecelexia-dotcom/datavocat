-- Vue : taux de succès par juridiction
CREATE VIEW v_stats_par_juridiction AS
SELECT
  juridiction_type,
  juridiction_ville,
  COUNT(*) AS total_decisions,
  COUNT(*) FILTER (WHERE resultat = 'annulation') AS nb_annulations,
  COUNT(*) FILTER (WHERE resultat = 'validation') AS nb_validations,
  COUNT(*) FILTER (WHERE resultat = 'irrecevabilité') AS nb_irrecevabilites,
  ROUND(
    COUNT(*) FILTER (WHERE resultat = 'annulation')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1
  ) AS taux_annulation_pct,
  ROUND(AVG(delai_statuer_mois)::DECIMAL, 1) AS delai_moyen_mois,
  ROUND(AVG(montant_condamnations)::DECIMAL, 0) AS montant_moyen_condamnation
FROM decisions
WHERE status = 'validated'
GROUP BY juridiction_type, juridiction_ville;

-- Vue : taux de succès par motif invoqué
CREATE VIEW v_stats_par_motif AS
SELECT
  'OPA' AS motif,
  COUNT(*) FILTER (WHERE contraire_opa = TRUE) AS nb_invoque,
  COUNT(*) FILTER (WHERE contraire_opa = TRUE AND resultat = 'annulation') AS nb_succes,
  ROUND(
    COUNT(*) FILTER (WHERE contraire_opa = TRUE AND resultat = 'annulation')::DECIMAL /
    NULLIF(COUNT(*) FILTER (WHERE contraire_opa = TRUE), 0) * 100, 1
  ) AS taux_succes_pct
FROM decisions WHERE status = 'validated'
UNION ALL
SELECT 'OPS',
  COUNT(*) FILTER (WHERE contraire_ops = TRUE),
  COUNT(*) FILTER (WHERE contraire_ops = TRUE AND resultat = 'annulation'),
  ROUND(COUNT(*) FILTER (WHERE contraire_ops = TRUE AND resultat = 'annulation')::DECIMAL /
    NULLIF(COUNT(*) FILTER (WHERE contraire_ops = TRUE), 0) * 100, 1)
FROM decisions WHERE status = 'validated'
UNION ALL
SELECT 'OPD',
  COUNT(*) FILTER (WHERE contraire_opd = TRUE),
  COUNT(*) FILTER (WHERE contraire_opd = TRUE AND resultat = 'annulation'),
  ROUND(COUNT(*) FILTER (WHERE contraire_opd = TRUE AND resultat = 'annulation')::DECIMAL /
    NULLIF(COUNT(*) FILTER (WHERE contraire_opd = TRUE), 0) * 100, 1)
FROM decisions WHERE status = 'validated'
UNION ALL
SELECT 'Défaut qualité signataires',
  COUNT(*) FILTER (WHERE defaut_qualite_signataires = TRUE),
  COUNT(*) FILTER (WHERE defaut_qualite_signataires = TRUE AND resultat = 'annulation'),
  ROUND(COUNT(*) FILTER (WHERE defaut_qualite_signataires = TRUE AND resultat = 'annulation')::DECIMAL /
    NULLIF(COUNT(*) FILTER (WHERE defaut_qualite_signataires = TRUE), 0) * 100, 1)
FROM decisions WHERE status = 'validated'
UNION ALL
SELECT 'Objet illicite',
  COUNT(*) FILTER (WHERE objet_illicite = TRUE),
  COUNT(*) FILTER (WHERE objet_illicite = TRUE AND resultat = 'annulation'),
  ROUND(COUNT(*) FILTER (WHERE objet_illicite = TRUE AND resultat = 'annulation')::DECIMAL /
    NULLIF(COUNT(*) FILTER (WHERE objet_illicite = TRUE), 0) * 100, 1)
FROM decisions WHERE status = 'validated'
UNION ALL
SELECT 'Contrepartie illusoire',
  COUNT(*) FILTER (WHERE contrepartie_illusoire = TRUE),
  COUNT(*) FILTER (WHERE contrepartie_illusoire = TRUE AND resultat = 'annulation'),
  ROUND(COUNT(*) FILTER (WHERE contrepartie_illusoire = TRUE AND resultat = 'annulation')::DECIMAL /
    NULLIF(COUNT(*) FILTER (WHERE contrepartie_illusoire = TRUE), 0) * 100, 1)
FROM decisions WHERE status = 'validated'
UNION ALL
SELECT 'Vices du consentement',
  COUNT(*) FILTER (WHERE vices_consentement = TRUE),
  COUNT(*) FILTER (WHERE vices_consentement = TRUE AND resultat = 'annulation'),
  ROUND(COUNT(*) FILTER (WHERE vices_consentement = TRUE AND resultat = 'annulation')::DECIMAL /
    NULLIF(COUNT(*) FILTER (WHERE vices_consentement = TRUE), 0) * 100, 1)
FROM decisions WHERE status = 'validated';

-- Vue : taux de confirmation/infirmation en appel
CREATE VIEW v_stats_appel AS
SELECT
  juridiction_ville,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE appel_sens = 'confirmatif') AS confirmatifs,
  COUNT(*) FILTER (WHERE appel_sens = 'infirmatif') AS infirmatifs,
  ROUND(
    COUNT(*) FILTER (WHERE appel_sens = 'confirmatif')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1
  ) AS taux_confirmation_pct
FROM decisions
WHERE status = 'validated' AND juridiction_type = 'CA'
GROUP BY juridiction_ville;
