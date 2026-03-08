-- ═══════════════════════════════════════════
-- SEED : Données de test pour le développement
-- ═══════════════════════════════════════════
-- Ce fichier insère des décisions fictives pour tester les vues et fonctions.
-- À ne PAS exécuter en production.

-- Cabinet de test
INSERT INTO cabinets (id, name, slug, plan) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Cabinet Test Datavocat', 'cabinet-test', 'pro')
ON CONFLICT (id) DO NOTHING;

-- Décisions de test (échantillon représentatif de 20 décisions)
INSERT INTO decisions (
  id, source, cabinet_id, status,
  juridiction, juridiction_type, juridiction_ville, juridiction_ressort,
  date_decision, numero_rg, delai_statuer_mois,
  secteur_conclusion, objet_accord, bloc_negociation, perimetre_conclusion, mode_conclusion,
  demandeur_type, demandeur_partie_ou_tiers, recevable,
  contraire_opa, contraire_ops, contraire_opd,
  defaut_qualite_signataires, objet_illicite, contrepartie_illusoire, vices_consentement,
  resultat, annulation_totale_ou_partielle, montant_condamnations,
  post_ordonnance_2017, extraction_confidence
) VALUES
-- TJ Paris — annulations
('10000000-0000-0000-0000-000000000001', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Tribunal judiciaire de Paris', 'TJ', 'Paris', 'Paris',
 '2023-03-15', '22/01234', 14,
 'Métallurgie', 'Accord de substitution', 1, 'entreprise', 'majoritaire',
 'OS_non_signataire', 'partie', TRUE,
 TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
 'annulation', 'totale', 15000,
 TRUE, 0.92),

('10000000-0000-0000-0000-000000000002', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Tribunal judiciaire de Paris', 'TJ', 'Paris', 'Paris',
 '2023-06-20', '22/05678', 18,
 'Commerce', 'Accord sur le temps de travail', 2, 'établissement', 'référendaire',
 'OS_signataire', 'partie', TRUE,
 FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE,
 'annulation', 'partielle', 8000,
 TRUE, 0.88),

('10000000-0000-0000-0000-000000000003', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Tribunal judiciaire de Paris', 'TJ', 'Paris', 'Paris',
 '2022-11-10', '21/09876', 22,
 'Banque', 'Accord de branche étendu', 1, 'branche', 'majoritaire',
 'employeur', 'partie', TRUE,
 FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE,
 'validation', NULL, NULL,
 TRUE, 0.95),

-- TJ Lyon — mix
('10000000-0000-0000-0000-000000000004', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Tribunal judiciaire de Lyon', 'TJ', 'Lyon', 'Lyon',
 '2023-01-25', '22/02345', 12,
 'Chimie', 'Accord sur les salaires', 1, 'entreprise', 'majoritaire',
 'OS_non_signataire', 'partie', TRUE,
 TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE,
 'annulation', 'totale', 25000,
 TRUE, 0.90),

('10000000-0000-0000-0000-000000000005', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Tribunal judiciaire de Lyon', 'TJ', 'Lyon', 'Lyon',
 '2023-09-12', '23/01111', 8,
 'Transport', 'Accord de performance collective', 2, 'entreprise', 'majoritaire',
 'salarié', 'partie', FALSE,
 FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
 'irrecevabilité', NULL, NULL,
 TRUE, 0.85),

-- TJ Marseille
('10000000-0000-0000-0000-000000000006', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Tribunal judiciaire de Marseille', 'TJ', 'Marseille', 'Aix-en-Provence',
 '2023-04-18', '22/04567', 16,
 'BTP', 'Accord de méthode', 3, 'groupe', 'majoritaire',
 'CSE', 'partie', TRUE,
 FALSE, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE,
 'annulation', 'totale', 12000,
 TRUE, 0.87),

('10000000-0000-0000-0000-000000000007', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Tribunal judiciaire de Marseille', 'TJ', 'Marseille', 'Aix-en-Provence',
 '2022-07-05', '21/07890', 20,
 'Commerce', 'Accord sur l''intéressement', 3, 'entreprise', 'majoritaire',
 'OS_signataire', 'partie', TRUE,
 FALSE, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE,
 'validation', NULL, NULL,
 TRUE, 0.91),

-- CA Paris (appel)
('10000000-0000-0000-0000-000000000008', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Cour d''appel de Paris', 'CA', 'Paris', 'Paris',
 '2023-10-05', '23/02222', 10,
 'Métallurgie', 'Accord de substitution', 1, 'entreprise', 'majoritaire',
 'OS_non_signataire', 'partie', TRUE,
 TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
 'annulation', 'totale', 20000,
 TRUE, 0.93),

('10000000-0000-0000-0000-000000000009', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Cour d''appel de Paris', 'CA', 'Paris', 'Paris',
 '2023-07-15', '23/03333', 12,
 'Commerce', 'Accord sur le temps de travail', 2, 'établissement', 'référendaire',
 'employeur', 'partie', TRUE,
 FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE,
 'validation', NULL, NULL,
 TRUE, 0.89),

('10000000-0000-0000-0000-000000000010', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Cour d''appel de Paris', 'CA', 'Paris', 'Paris',
 '2024-01-20', '23/04444', 8,
 'Banque', 'Accord de branche étendu', 1, 'branche', 'majoritaire',
 'OS_non_signataire', 'partie', TRUE,
 TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE,
 'annulation', 'partielle', 35000,
 TRUE, 0.94),

-- CA Lyon (appel)
('10000000-0000-0000-0000-000000000011', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Cour d''appel de Lyon', 'CA', 'Lyon', 'Lyon',
 '2023-05-30', '23/05555', 15,
 'Chimie', 'Accord sur les salaires', 1, 'entreprise', 'majoritaire',
 'OS_signataire', 'partie', TRUE,
 FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE,
 'validation', NULL, NULL,
 TRUE, 0.86),

('10000000-0000-0000-0000-000000000012', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Cour d''appel de Lyon', 'CA', 'Lyon', 'Lyon',
 '2023-12-10', '23/06666', 11,
 'Transport', 'Accord de performance collective', 2, 'UES', 'majoritaire',
 'OS_non_signataire', 'partie', TRUE,
 TRUE, FALSE, FALSE, FALSE, FALSE, TRUE, FALSE,
 'annulation', 'totale', 18000,
 TRUE, 0.91),

-- CA Versailles
('10000000-0000-0000-0000-000000000013', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Cour d''appel de Versailles', 'CA', 'Versailles', 'Versailles',
 '2023-02-28', '22/07777', 19,
 'BTP', 'Accord de méthode', 3, 'groupe', 'majoritaire',
 'CSE', 'tiers', FALSE,
 FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
 'irrecevabilité', NULL, NULL,
 TRUE, 0.82),

-- Pré-ordonnances 2017
('10000000-0000-0000-0000-000000000014', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Tribunal judiciaire de Paris', 'TJ', 'Paris', 'Paris',
 '2016-06-15', '15/08888', 24,
 'Métallurgie', 'Accord d''entreprise', 1, 'entreprise', 'majoritaire',
 'OS_non_signataire', 'partie', TRUE,
 TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
 'annulation', 'totale', 30000,
 FALSE, 0.88),

('10000000-0000-0000-0000-000000000015', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Tribunal judiciaire de Lyon', 'TJ', 'Lyon', 'Lyon',
 '2017-03-10', '16/09999', 20,
 'Commerce', 'Accord collectif', 2, 'entreprise', 'majoritaire',
 'employeur', 'partie', TRUE,
 FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE,
 'validation', NULL, NULL,
 FALSE, 0.90),

-- Cassation
('10000000-0000-0000-0000-000000000016', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Cour de cassation', 'CASS', 'Paris', 'National',
 '2024-02-14', '23/10000', 6,
 'Métallurgie', 'Accord de substitution', 1, 'branche', 'majoritaire',
 'OS_non_signataire', 'partie', TRUE,
 TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE,
 'annulation', 'totale', 50000,
 TRUE, 0.96),

('10000000-0000-0000-0000-000000000017', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Cour de cassation', 'CASS', 'Paris', 'National',
 '2023-11-22', '23/11111', 8,
 'Banque', 'Accord de branche', 1, 'branche', 'majoritaire',
 'OS_signataire', 'partie', TRUE,
 FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE,
 'validation', NULL, NULL,
 TRUE, 0.93),

-- Vices du consentement
('10000000-0000-0000-0000-000000000018', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Tribunal judiciaire de Nanterre', 'TJ', 'Nanterre', 'Versailles',
 '2023-08-20', '23/12222', 13,
 'Assurance', 'Accord sur la participation', 3, 'entreprise', 'majoritaire',
 'OS_non_signataire', 'partie', TRUE,
 FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE,
 'annulation', 'totale', 10000,
 TRUE, 0.84),

-- Contrepartie illusoire
('10000000-0000-0000-0000-000000000019', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Tribunal judiciaire de Bordeaux', 'TJ', 'Bordeaux', 'Bordeaux',
 '2023-04-05', '22/13333', 17,
 'Agroalimentaire', 'Accord de performance collective', 2, 'entreprise', 'majoritaire',
 'salarié', 'partie', TRUE,
 FALSE, FALSE, FALSE, FALSE, FALSE, TRUE, FALSE,
 'annulation', 'partielle', 5000,
 TRUE, 0.87),

-- Appel confirmatif/infirmatif pour stats
('10000000-0000-0000-0000-000000000020', 'seed', '00000000-0000-0000-0000-000000000001', 'validated',
 'Cour d''appel de Versailles', 'CA', 'Versailles', 'Versailles',
 '2024-03-01', '23/14444', 9,
 'Chimie', 'Accord sur les salaires', 1, 'entreprise', 'majoritaire',
 'OS_non_signataire', 'partie', TRUE,
 TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
 'annulation', 'totale', 22000,
 TRUE, 0.90)
ON CONFLICT (id) DO NOTHING;

-- Mettre à jour les sens d'appel pour les CA
UPDATE decisions SET appel_sens = 'confirmatif'
WHERE id IN (
  '10000000-0000-0000-0000-000000000008',
  '10000000-0000-0000-0000-000000000009',
  '10000000-0000-0000-0000-000000000011'
);

UPDATE decisions SET appel_sens = 'infirmatif'
WHERE id IN (
  '10000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000012',
  '10000000-0000-0000-0000-000000000020'
);

UPDATE decisions SET appel_sens = 'confirmatif'
WHERE id = '10000000-0000-0000-0000-000000000013';

-- Chaînage contentieux : lier une décision TJ à son appel
UPDATE decisions SET ref_appel = '23/02222'
WHERE id = '10000000-0000-0000-0000-000000000001';

UPDATE decisions SET ref_premiere_instance = '22/01234',
  decision_parent_id = '10000000-0000-0000-0000-000000000001'
WHERE id = '10000000-0000-0000-0000-000000000008';

-- Pourvoi en cassation
UPDATE decisions SET pourvoi = TRUE, cassation_ou_rejet = 'cassation'
WHERE id = '10000000-0000-0000-0000-000000000016';

UPDATE decisions SET pourvoi = TRUE, cassation_ou_rejet = 'rejet'
WHERE id = '10000000-0000-0000-0000-000000000017';

-- Rafraîchir le cache après le seed
SELECT refresh_stats_cache();
