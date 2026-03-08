-- ═══════════════════════════════════════════════════════════════
-- DATAVOCAT — Script complet d'initialisation de la base
-- Coller dans : Supabase Dashboard > SQL Editor > New Query
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════
-- 1. CABINETS
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cabinets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cabinets_slug ON cabinets(slug);

-- ═══════════════════════════════════════════
-- 2. PROFILES
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cabinet_id UUID REFERENCES cabinets(id),
  full_name TEXT,
  role TEXT DEFAULT 'avocat' CHECK (role IN ('avocat', 'admin', 'collaborateur')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_cabinet ON profiles(cabinet_id);

-- Trigger : auto-create profile + cabinet on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_cabinet_id UUID;
  cabinet_slug TEXT;
BEGIN
  IF NEW.raw_user_meta_data->>'cabinet_name' IS NOT NULL THEN
    cabinet_slug := lower(regexp_replace(
      NEW.raw_user_meta_data->>'cabinet_name',
      '[^a-zA-Z0-9]+', '-', 'g'
    ));
    IF EXISTS (SELECT 1 FROM cabinets WHERE slug = cabinet_slug) THEN
      cabinet_slug := cabinet_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
    END IF;
    INSERT INTO cabinets (name, slug)
    VALUES (NEW.raw_user_meta_data->>'cabinet_name', cabinet_slug)
    RETURNING id INTO new_cabinet_id;
  END IF;

  INSERT INTO profiles (id, cabinet_id, full_name, role)
  VALUES (
    NEW.id,
    new_cabinet_id,
    NEW.raw_user_meta_data->>'full_name',
    CASE WHEN new_cabinet_id IS NOT NULL THEN 'admin' ELSE 'avocat' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ═══════════════════════════════════════════
-- 3. DECISIONS (39+ colonnes)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'upload',
  source_ref TEXT,
  pdf_path TEXT,
  raw_text TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  cabinet_id UUID REFERENCES cabinets(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'extracting', 'review', 'validated', 'error')),
  extraction_confidence FLOAT,
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  -- Cat 1: Activite juridictionnelle
  juridiction TEXT,
  juridiction_type TEXT,
  juridiction_ville TEXT,
  juridiction_ressort TEXT,
  date_decision DATE,
  numero_rg TEXT,
  delai_statuer_mois INTEGER,
  ref_premiere_instance TEXT,
  ref_appel TEXT,
  appel_sens TEXT,
  pourvoi BOOLEAN,
  cassation_ou_rejet TEXT,
  -- Cat 2: Accords contestes
  secteur_conclusion TEXT,
  objet_accord TEXT,
  bloc_negociation INTEGER CHECK (bloc_negociation IN (1, 2, 3)),
  stipulations_branche TEXT,
  perimetre_conclusion TEXT,
  mode_conclusion TEXT,
  -- Cat 3: Recevabilite
  demandeur_type TEXT,
  demandeur_partie_ou_tiers TEXT,
  forclusion BOOLEAN,
  forclusion_detail TEXT,
  defaut_interet_agir BOOLEAN,
  defaut_interet_agir_detail TEXT,
  defaut_qualite_agir BOOLEAN,
  defaut_qualite_agir_detail TEXT,
  recevable BOOLEAN,
  -- Cat 4: Causes d'invalidite
  champ_demande_nullite TEXT,
  contraire_opa BOOLEAN,
  contraire_opa_detail TEXT,
  contraire_ops BOOLEAN,
  contraire_ops_detail TEXT,
  contraire_opd BOOLEAN,
  contraire_opd_detail TEXT,
  defaut_qualite_signataires BOOLEAN,
  defaut_qualite_signataires_detail TEXT,
  objet_illicite BOOLEAN,
  objet_illicite_detail TEXT,
  contrepartie_illusoire BOOLEAN,
  contrepartie_illusoire_detail TEXT,
  vices_consentement BOOLEAN,
  vices_consentement_detail TEXT,
  autres_demandes TEXT,
  -- Cat 5: Traitement
  resultat TEXT,
  annulation_totale_ou_partielle TEXT,
  annulation_retroactive BOOLEAN,
  arguments_retroactivite TEXT,
  annulation_pour_avenir BOOLEAN,
  arguments_avenir TEXT,
  annulation_date_future BOOLEAN,
  arguments_date_future TEXT,
  dommages_identifies TEXT,
  montant_condamnations DECIMAL,
  debiteur_condamnations TEXT,
  creancier_condamnations TEXT,
  responsabilite_etat BOOLEAN,
  -- Temporel
  post_ordonnance_2017 BOOLEAN,
  -- Chainage
  decision_parent_id UUID REFERENCES decisions(id),
  decision_enfant_ids UUID[]
);

CREATE INDEX IF NOT EXISTS idx_decisions_juridiction_type ON decisions(juridiction_type);
CREATE INDEX IF NOT EXISTS idx_decisions_juridiction_ville ON decisions(juridiction_ville);
CREATE INDEX IF NOT EXISTS idx_decisions_resultat ON decisions(resultat);
CREATE INDEX IF NOT EXISTS idx_decisions_demandeur_type ON decisions(demandeur_type);
CREATE INDEX IF NOT EXISTS idx_decisions_bloc ON decisions(bloc_negociation);
CREATE INDEX IF NOT EXISTS idx_decisions_perimetre ON decisions(perimetre_conclusion);
CREATE INDEX IF NOT EXISTS idx_decisions_date ON decisions(date_decision);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
CREATE INDEX IF NOT EXISTS idx_decisions_post_2017 ON decisions(post_ordonnance_2017);
CREATE INDEX IF NOT EXISTS idx_decisions_cabinet ON decisions(cabinet_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS decisions_updated_at ON decisions;
CREATE TRIGGER decisions_updated_at
  BEFORE UPDATE ON decisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════
-- 4. STATS CACHE
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS stats_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT now(),
  sample_size INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_stats_cache_key ON stats_cache(cache_key);

-- ═══════════════════════════════════════════
-- 5. VIEWS (stats)
-- ═══════════════════════════════════════════
CREATE OR REPLACE VIEW v_stats_par_juridiction AS
SELECT
  juridiction_type, juridiction_ville,
  COUNT(*) AS total_decisions,
  COUNT(*) FILTER (WHERE resultat = 'annulation') AS nb_annulations,
  COUNT(*) FILTER (WHERE resultat = 'validation') AS nb_validations,
  COUNT(*) FILTER (WHERE resultat = 'irrecevabilité') AS nb_irrecevabilites,
  ROUND(COUNT(*) FILTER (WHERE resultat = 'annulation')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1) AS taux_annulation_pct,
  ROUND(AVG(delai_statuer_mois)::DECIMAL, 1) AS delai_moyen_mois,
  ROUND(AVG(montant_condamnations)::DECIMAL, 0) AS montant_moyen_condamnation
FROM decisions WHERE status = 'validated'
GROUP BY juridiction_type, juridiction_ville;

CREATE OR REPLACE VIEW v_stats_par_motif AS
SELECT 'OPA' AS motif,
  COUNT(*) FILTER (WHERE contraire_opa = TRUE) AS nb_invoque,
  COUNT(*) FILTER (WHERE contraire_opa = TRUE AND resultat = 'annulation') AS nb_succes,
  ROUND(COUNT(*) FILTER (WHERE contraire_opa = TRUE AND resultat = 'annulation')::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE contraire_opa = TRUE), 0) * 100, 1) AS taux_succes_pct
FROM decisions WHERE status = 'validated'
UNION ALL
SELECT 'OPS',
  COUNT(*) FILTER (WHERE contraire_ops = TRUE),
  COUNT(*) FILTER (WHERE contraire_ops = TRUE AND resultat = 'annulation'),
  ROUND(COUNT(*) FILTER (WHERE contraire_ops = TRUE AND resultat = 'annulation')::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE contraire_ops = TRUE), 0) * 100, 1)
FROM decisions WHERE status = 'validated'
UNION ALL
SELECT 'OPD',
  COUNT(*) FILTER (WHERE contraire_opd = TRUE),
  COUNT(*) FILTER (WHERE contraire_opd = TRUE AND resultat = 'annulation'),
  ROUND(COUNT(*) FILTER (WHERE contraire_opd = TRUE AND resultat = 'annulation')::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE contraire_opd = TRUE), 0) * 100, 1)
FROM decisions WHERE status = 'validated'
UNION ALL
SELECT 'Défaut qualité signataires',
  COUNT(*) FILTER (WHERE defaut_qualite_signataires = TRUE),
  COUNT(*) FILTER (WHERE defaut_qualite_signataires = TRUE AND resultat = 'annulation'),
  ROUND(COUNT(*) FILTER (WHERE defaut_qualite_signataires = TRUE AND resultat = 'annulation')::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE defaut_qualite_signataires = TRUE), 0) * 100, 1)
FROM decisions WHERE status = 'validated'
UNION ALL
SELECT 'Objet illicite',
  COUNT(*) FILTER (WHERE objet_illicite = TRUE),
  COUNT(*) FILTER (WHERE objet_illicite = TRUE AND resultat = 'annulation'),
  ROUND(COUNT(*) FILTER (WHERE objet_illicite = TRUE AND resultat = 'annulation')::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE objet_illicite = TRUE), 0) * 100, 1)
FROM decisions WHERE status = 'validated'
UNION ALL
SELECT 'Contrepartie illusoire',
  COUNT(*) FILTER (WHERE contrepartie_illusoire = TRUE),
  COUNT(*) FILTER (WHERE contrepartie_illusoire = TRUE AND resultat = 'annulation'),
  ROUND(COUNT(*) FILTER (WHERE contrepartie_illusoire = TRUE AND resultat = 'annulation')::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE contrepartie_illusoire = TRUE), 0) * 100, 1)
FROM decisions WHERE status = 'validated'
UNION ALL
SELECT 'Vices du consentement',
  COUNT(*) FILTER (WHERE vices_consentement = TRUE),
  COUNT(*) FILTER (WHERE vices_consentement = TRUE AND resultat = 'annulation'),
  ROUND(COUNT(*) FILTER (WHERE vices_consentement = TRUE AND resultat = 'annulation')::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE vices_consentement = TRUE), 0) * 100, 1)
FROM decisions WHERE status = 'validated';

CREATE OR REPLACE VIEW v_stats_appel AS
SELECT
  juridiction_ville,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE appel_sens = 'confirmatif') AS confirmatifs,
  COUNT(*) FILTER (WHERE appel_sens = 'infirmatif') AS infirmatifs,
  ROUND(COUNT(*) FILTER (WHERE appel_sens = 'confirmatif')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1) AS taux_confirmation_pct
FROM decisions
WHERE status = 'validated' AND juridiction_type = 'CA'
GROUP BY juridiction_ville;

-- ═══════════════════════════════════════════
-- 6. FUNCTIONS (scoring)
-- ═══════════════════════════════════════════
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
    SELECT d.*,
      (
        CASE WHEN d.juridiction_type = p_juridiction_type THEN 25 ELSE 0 END +
        CASE WHEN d.perimetre_conclusion = p_perimetre THEN 20 ELSE 0 END +
        CASE WHEN d.demandeur_type = p_demandeur_type THEN 20 ELSE 0 END +
        CASE WHEN d.bloc_negociation = p_bloc THEN 15 ELSE 0 END +
        CASE WHEN d.contraire_opa = p_motif_opa AND p_motif_opa = TRUE THEN 10 ELSE 0 END +
        CASE WHEN d.contraire_ops = p_motif_ops AND p_motif_ops = TRUE THEN 5 ELSE 0 END +
        CASE WHEN d.post_ordonnance_2017 = p_post_2017 THEN 5 ELSE 0 END
      ) AS similarity_score
    FROM decisions d WHERE d.status = 'validated'
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
      'id', f.id, 'juridiction', f.juridiction, 'date', f.date_decision,
      'resultat', f.resultat, 'numero_rg', f.numero_rg, 'score', f.similarity_score
    ) ORDER BY f.similarity_score DESC)
    FROM (SELECT * FROM filtered ORDER BY similarity_score DESC LIMIT 5) f)
  FROM filtered;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════
-- 7. RLS POLICIES
-- ═══════════════════════════════════════════
ALTER TABLE cabinets ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stats_cache ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (idempotent)
DO $$ BEGIN
  -- Cabinets
  DROP POLICY IF EXISTS "Cabinets lisibles par leurs membres" ON cabinets;
  -- Profiles
  DROP POLICY IF EXISTS "Profil lisible par l'utilisateur lui-même" ON profiles;
  DROP POLICY IF EXISTS "Profil modifiable par l'utilisateur lui-même" ON profiles;
  DROP POLICY IF EXISTS "Profiles insertable by trigger" ON profiles;
  -- Decisions
  DROP POLICY IF EXISTS "Decisions validées lisibles par tous" ON decisions;
  DROP POLICY IF EXISTS "Decisions en cours lisibles par le cabinet" ON decisions;
  DROP POLICY IF EXISTS "Insertion par utilisateur authentifié" ON decisions;
  DROP POLICY IF EXISTS "Modification par cabinet" ON decisions;
  DROP POLICY IF EXISTS "Suppression par cabinet" ON decisions;
  DROP POLICY IF EXISTS "Service role full access decisions" ON decisions;
  -- Stats
  DROP POLICY IF EXISTS "Stats cache lisible par tous les authentifiés" ON stats_cache;
  DROP POLICY IF EXISTS "Service role full access stats" ON stats_cache;
END $$;

CREATE POLICY "Cabinets lisibles par leurs membres" ON cabinets
  FOR SELECT USING (
    id IN (SELECT cabinet_id FROM profiles WHERE profiles.id = auth.uid())
  );

CREATE POLICY "Profil lisible par l'utilisateur lui-même" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Profil modifiable par l'utilisateur lui-même" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- The trigger runs as SECURITY DEFINER so it bypasses RLS,
-- but we still need an INSERT policy for the profiles table
CREATE POLICY "Profiles insertable by trigger" ON profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Decisions validées lisibles par tous" ON decisions
  FOR SELECT USING (
    status = 'validated' AND auth.role() = 'authenticated'
  );

CREATE POLICY "Decisions en cours lisibles par le cabinet" ON decisions
  FOR SELECT USING (
    status != 'validated' AND
    cabinet_id IN (SELECT cabinet_id FROM profiles WHERE profiles.id = auth.uid())
  );

CREATE POLICY "Insertion par utilisateur authentifié" ON decisions
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    uploaded_by = auth.uid() AND
    cabinet_id IN (SELECT cabinet_id FROM profiles WHERE profiles.id = auth.uid())
  );

CREATE POLICY "Modification par cabinet" ON decisions
  FOR UPDATE USING (
    cabinet_id IN (SELECT cabinet_id FROM profiles WHERE profiles.id = auth.uid())
  );

CREATE POLICY "Suppression par cabinet" ON decisions
  FOR DELETE USING (
    cabinet_id IN (SELECT cabinet_id FROM profiles WHERE profiles.id = auth.uid())
  );

-- Service role needs full access for API routes using adminClient
CREATE POLICY "Service role full access decisions" ON decisions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Stats cache lisible par tous les authentifiés" ON stats_cache
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Service role full access stats" ON stats_cache
  FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════
-- 8. STORAGE (PDF bucket)
-- ═══════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('decisions-pdfs', 'decisions-pdfs', FALSE, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Upload PDF par membre du cabinet" ON storage.objects;
  DROP POLICY IF EXISTS "Download PDF par membre du cabinet" ON storage.objects;
  DROP POLICY IF EXISTS "Delete PDF par membre du cabinet" ON storage.objects;
END $$;

CREATE POLICY "Upload PDF par membre du cabinet"
ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'decisions-pdfs' AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT cabinet_id::text FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Download PDF par membre du cabinet"
ON storage.objects FOR SELECT USING (
  bucket_id = 'decisions-pdfs' AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT cabinet_id::text FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Delete PDF par membre du cabinet"
ON storage.objects FOR DELETE USING (
  bucket_id = 'decisions-pdfs' AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT cabinet_id::text FROM profiles WHERE id = auth.uid()
  )
);

-- ═══════════════════════════════════════════
-- 9. STATS FUNCTIONS + TRIGGER
-- ═══════════════════════════════════════════
CREATE OR REPLACE FUNCTION refresh_stats_cache()
RETURNS void AS $$
DECLARE
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM decisions WHERE status = 'validated';

  INSERT INTO stats_cache (cache_key, data, sample_size)
  SELECT 'global',
    jsonb_build_object(
      'total_decisions', COUNT(*),
      'taux_annulation', ROUND(COUNT(*) FILTER (WHERE resultat = 'annulation')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1),
      'delai_moyen_mois', ROUND(AVG(delai_statuer_mois)::DECIMAL, 1),
      'montant_moyen', ROUND(AVG(montant_condamnations)::DECIMAL, 0)
    ),
    COUNT(*)::INTEGER
  FROM decisions WHERE status = 'validated'
  ON CONFLICT (cache_key) DO UPDATE SET data = EXCLUDED.data, computed_at = now(), sample_size = EXCLUDED.sample_size;

  INSERT INTO stats_cache (cache_key, data, sample_size)
  SELECT 'juridiction', COALESCE(jsonb_agg(row_to_json(v)::jsonb), '[]'::jsonb), total_count
  FROM v_stats_par_juridiction v
  ON CONFLICT (cache_key) DO UPDATE SET data = EXCLUDED.data, computed_at = now(), sample_size = EXCLUDED.sample_size;

  INSERT INTO stats_cache (cache_key, data, sample_size)
  SELECT 'motif', COALESCE(jsonb_agg(row_to_json(v)::jsonb), '[]'::jsonb), total_count
  FROM v_stats_par_motif v
  ON CONFLICT (cache_key) DO UPDATE SET data = EXCLUDED.data, computed_at = now(), sample_size = EXCLUDED.sample_size;

  INSERT INTO stats_cache (cache_key, data, sample_size)
  SELECT 'appel', COALESCE(jsonb_agg(row_to_json(v)::jsonb), '[]'::jsonb), total_count
  FROM v_stats_appel v
  ON CONFLICT (cache_key) DO UPDATE SET data = EXCLUDED.data, computed_at = now(), sample_size = EXCLUDED.sample_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION on_decision_validated()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'validated' AND (OLD.status IS NULL OR OLD.status != 'validated') THEN
    PERFORM refresh_stats_cache();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_refresh_stats_on_validate ON decisions;
CREATE TRIGGER trigger_refresh_stats_on_validate
  AFTER UPDATE ON decisions
  FOR EACH ROW EXECUTE FUNCTION on_decision_validated();

-- ═══════════════════════════════════════════
-- 10. FULL-TEXT SEARCH + COMPOSITE INDEXES
-- ═══════════════════════════════════════════
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_decisions_search ON decisions USING GIN(search_vector);

CREATE OR REPLACE FUNCTION update_decision_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('french',
    COALESCE(NEW.juridiction, '') || ' ' ||
    COALESCE(NEW.juridiction_ville, '') || ' ' ||
    COALESCE(NEW.numero_rg, '') || ' ' ||
    COALESCE(NEW.secteur_conclusion, '') || ' ' ||
    COALESCE(NEW.objet_accord, '') || ' ' ||
    COALESCE(NEW.champ_demande_nullite, '') || ' ' ||
    COALESCE(NEW.dommages_identifies, '') || ' ' ||
    COALESCE(NEW.autres_demandes, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS decisions_search_vector_update ON decisions;
CREATE TRIGGER decisions_search_vector_update
  BEFORE INSERT OR UPDATE ON decisions
  FOR EACH ROW EXECUTE FUNCTION update_decision_search_vector();

CREATE INDEX IF NOT EXISTS idx_decisions_cabinet_status ON decisions(cabinet_id, status);
CREATE INDEX IF NOT EXISTS idx_decisions_validated_juridiction ON decisions(juridiction_type) WHERE status = 'validated';
CREATE INDEX IF NOT EXISTS idx_decisions_validated_resultat ON decisions(resultat) WHERE status = 'validated';
CREATE INDEX IF NOT EXISTS idx_decisions_validated_post2017 ON decisions(post_ordonnance_2017) WHERE status = 'validated';

-- ═══════════════════════════════════════════
-- 11. ANALYSES TABLE
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  response TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'streaming', 'done', 'error')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at DESC);

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own analyses" ON analyses;
  DROP POLICY IF EXISTS "Users can insert own analyses" ON analyses;
  DROP POLICY IF EXISTS "Users can update own analyses" ON analyses;
  DROP POLICY IF EXISTS "Users can delete own analyses" ON analyses;
  DROP POLICY IF EXISTS "Service role full access" ON analyses;
END $$;

CREATE POLICY "Users can view own analyses" ON analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own analyses" ON analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own analyses" ON analyses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own analyses" ON analyses FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access" ON analyses FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════
-- 12. SEED DATA (20 test decisions)
-- ═══════════════════════════════════════════
INSERT INTO cabinets (id, name, slug, plan) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Cabinet Test Datavocat', 'cabinet-test', 'pro')
ON CONFLICT (id) DO NOTHING;

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
('10000000-0000-0000-0000-000000000001', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Tribunal judiciaire de Paris', 'TJ', 'Paris', 'Paris', '2023-03-15', '22/01234', 14, 'Métallurgie', 'Accord de substitution', 1, 'entreprise', 'majoritaire', 'OS_non_signataire', 'partie', TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'annulation', 'totale', 15000, TRUE, 0.92),
('10000000-0000-0000-0000-000000000002', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Tribunal judiciaire de Paris', 'TJ', 'Paris', 'Paris', '2023-06-20', '22/05678', 18, 'Commerce', 'Accord sur le temps de travail', 2, 'établissement', 'référendaire', 'OS_signataire', 'partie', TRUE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, 'annulation', 'partielle', 8000, TRUE, 0.88),
('10000000-0000-0000-0000-000000000003', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Tribunal judiciaire de Paris', 'TJ', 'Paris', 'Paris', '2022-11-10', '21/09876', 22, 'Banque', 'Accord de branche étendu', 1, 'branche', 'majoritaire', 'employeur', 'partie', TRUE, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, 'validation', NULL, NULL, TRUE, 0.95),
('10000000-0000-0000-0000-000000000004', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Tribunal judiciaire de Lyon', 'TJ', 'Lyon', 'Lyon', '2023-01-25', '22/02345', 12, 'Chimie', 'Accord sur les salaires', 1, 'entreprise', 'majoritaire', 'OS_non_signataire', 'partie', TRUE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, 'annulation', 'totale', 25000, TRUE, 0.90),
('10000000-0000-0000-0000-000000000005', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Tribunal judiciaire de Lyon', 'TJ', 'Lyon', 'Lyon', '2023-09-12', '23/01111', 8, 'Transport', 'Accord de performance collective', 2, 'entreprise', 'majoritaire', 'salarié', 'partie', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'irrecevabilité', NULL, NULL, TRUE, 0.85),
('10000000-0000-0000-0000-000000000006', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Tribunal judiciaire de Marseille', 'TJ', 'Marseille', 'Aix-en-Provence', '2023-04-18', '22/04567', 16, 'BTP', 'Accord de méthode', 3, 'groupe', 'majoritaire', 'CSE', 'partie', TRUE, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, 'annulation', 'totale', 12000, TRUE, 0.87),
('10000000-0000-0000-0000-000000000007', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Tribunal judiciaire de Marseille', 'TJ', 'Marseille', 'Aix-en-Provence', '2022-07-05', '21/07890', 20, 'Commerce', 'Accord sur l''intéressement', 3, 'entreprise', 'majoritaire', 'OS_signataire', 'partie', TRUE, FALSE, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE, 'validation', NULL, NULL, TRUE, 0.91),
('10000000-0000-0000-0000-000000000008', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Cour d''appel de Paris', 'CA', 'Paris', 'Paris', '2023-10-05', '23/02222', 10, 'Métallurgie', 'Accord de substitution', 1, 'entreprise', 'majoritaire', 'OS_non_signataire', 'partie', TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'annulation', 'totale', 20000, TRUE, 0.93),
('10000000-0000-0000-0000-000000000009', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Cour d''appel de Paris', 'CA', 'Paris', 'Paris', '2023-07-15', '23/03333', 12, 'Commerce', 'Accord sur le temps de travail', 2, 'établissement', 'référendaire', 'employeur', 'partie', TRUE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, 'validation', NULL, NULL, TRUE, 0.89),
('10000000-0000-0000-0000-000000000010', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Cour d''appel de Paris', 'CA', 'Paris', 'Paris', '2024-01-20', '23/04444', 8, 'Banque', 'Accord de branche étendu', 1, 'branche', 'majoritaire', 'OS_non_signataire', 'partie', TRUE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, 'annulation', 'partielle', 35000, TRUE, 0.94),
('10000000-0000-0000-0000-000000000011', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Cour d''appel de Lyon', 'CA', 'Lyon', 'Lyon', '2023-05-30', '23/05555', 15, 'Chimie', 'Accord sur les salaires', 1, 'entreprise', 'majoritaire', 'OS_signataire', 'partie', TRUE, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, 'validation', NULL, NULL, TRUE, 0.86),
('10000000-0000-0000-0000-000000000012', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Cour d''appel de Lyon', 'CA', 'Lyon', 'Lyon', '2023-12-10', '23/06666', 11, 'Transport', 'Accord de performance collective', 2, 'UES', 'majoritaire', 'OS_non_signataire', 'partie', TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, TRUE, FALSE, 'annulation', 'totale', 18000, TRUE, 0.91),
('10000000-0000-0000-0000-000000000013', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Cour d''appel de Versailles', 'CA', 'Versailles', 'Versailles', '2023-02-28', '22/07777', 19, 'BTP', 'Accord de méthode', 3, 'groupe', 'majoritaire', 'CSE', 'tiers', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'irrecevabilité', NULL, NULL, TRUE, 0.82),
('10000000-0000-0000-0000-000000000014', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Tribunal judiciaire de Paris', 'TJ', 'Paris', 'Paris', '2016-06-15', '15/08888', 24, 'Métallurgie', 'Accord d''entreprise', 1, 'entreprise', 'majoritaire', 'OS_non_signataire', 'partie', TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'annulation', 'totale', 30000, FALSE, 0.88),
('10000000-0000-0000-0000-000000000015', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Tribunal judiciaire de Lyon', 'TJ', 'Lyon', 'Lyon', '2017-03-10', '16/09999', 20, 'Commerce', 'Accord collectif', 2, 'entreprise', 'majoritaire', 'employeur', 'partie', TRUE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, 'validation', NULL, NULL, FALSE, 0.90),
('10000000-0000-0000-0000-000000000016', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Cour de cassation', 'CASS', 'Paris', 'National', '2024-02-14', '23/10000', 6, 'Métallurgie', 'Accord de substitution', 1, 'branche', 'majoritaire', 'OS_non_signataire', 'partie', TRUE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, 'annulation', 'totale', 50000, TRUE, 0.96),
('10000000-0000-0000-0000-000000000017', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Cour de cassation', 'CASS', 'Paris', 'National', '2023-11-22', '23/11111', 8, 'Banque', 'Accord de branche', 1, 'branche', 'majoritaire', 'OS_signataire', 'partie', TRUE, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, 'validation', NULL, NULL, TRUE, 0.93),
('10000000-0000-0000-0000-000000000018', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Tribunal judiciaire de Nanterre', 'TJ', 'Nanterre', 'Versailles', '2023-08-20', '23/12222', 13, 'Assurance', 'Accord sur la participation', 3, 'entreprise', 'majoritaire', 'OS_non_signataire', 'partie', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE, 'annulation', 'totale', 10000, TRUE, 0.84),
('10000000-0000-0000-0000-000000000019', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Tribunal judiciaire de Bordeaux', 'TJ', 'Bordeaux', 'Bordeaux', '2023-04-05', '22/13333', 17, 'Agroalimentaire', 'Accord de performance collective', 2, 'entreprise', 'majoritaire', 'salarié', 'partie', TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE, FALSE, 'annulation', 'partielle', 5000, TRUE, 0.87),
('10000000-0000-0000-0000-000000000020', 'seed', '00000000-0000-0000-0000-000000000001', 'validated', 'Cour d''appel de Versailles', 'CA', 'Versailles', 'Versailles', '2024-03-01', '23/14444', 9, 'Chimie', 'Accord sur les salaires', 1, 'entreprise', 'majoritaire', 'OS_non_signataire', 'partie', TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'annulation', 'totale', 22000, TRUE, 0.90)
ON CONFLICT (id) DO NOTHING;

-- Appel sens
UPDATE decisions SET appel_sens = 'confirmatif' WHERE id IN ('10000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000013');
UPDATE decisions SET appel_sens = 'infirmatif' WHERE id IN ('10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000020');

-- Chainage
UPDATE decisions SET ref_appel = '23/02222' WHERE id = '10000000-0000-0000-0000-000000000001';
UPDATE decisions SET ref_premiere_instance = '22/01234', decision_parent_id = '10000000-0000-0000-0000-000000000001' WHERE id = '10000000-0000-0000-0000-000000000008';
UPDATE decisions SET pourvoi = TRUE, cassation_ou_rejet = 'cassation' WHERE id = '10000000-0000-0000-0000-000000000016';
UPDATE decisions SET pourvoi = TRUE, cassation_ou_rejet = 'rejet' WHERE id = '10000000-0000-0000-0000-000000000017';

-- Refresh stats cache
SELECT refresh_stats_cache();
