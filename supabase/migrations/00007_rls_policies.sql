-- ═══════════════════════════════════════════
-- RLS : CABINETS
-- ═══════════════════════════════════════════
ALTER TABLE cabinets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cabinets lisibles par leurs membres" ON cabinets
  FOR SELECT USING (
    id IN (SELECT cabinet_id FROM profiles WHERE profiles.id = auth.uid())
  );

-- ═══════════════════════════════════════════
-- RLS : PROFILES
-- ═══════════════════════════════════════════
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profil lisible par l'utilisateur lui-même" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Profil modifiable par l'utilisateur lui-même" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ═══════════════════════════════════════════
-- RLS : DECISIONS
-- ═══════════════════════════════════════════
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

-- Les décisions validées sont lisibles par tous les utilisateurs authentifiés
CREATE POLICY "Decisions validées lisibles par tous" ON decisions
  FOR SELECT USING (
    status = 'validated' AND auth.role() = 'authenticated'
  );

-- Les décisions non validées sont lisibles par leur cabinet
CREATE POLICY "Decisions en cours lisibles par le cabinet" ON decisions
  FOR SELECT USING (
    status != 'validated' AND
    cabinet_id IN (SELECT cabinet_id FROM profiles WHERE profiles.id = auth.uid())
  );

-- Insertion par les utilisateurs authentifiés (avec leur cabinet_id)
CREATE POLICY "Insertion par utilisateur authentifié" ON decisions
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    uploaded_by = auth.uid() AND
    cabinet_id IN (SELECT cabinet_id FROM profiles WHERE profiles.id = auth.uid())
  );

-- Modification uniquement par le cabinet propriétaire
CREATE POLICY "Modification par cabinet" ON decisions
  FOR UPDATE USING (
    cabinet_id IN (SELECT cabinet_id FROM profiles WHERE profiles.id = auth.uid())
  );

-- Suppression uniquement par le cabinet propriétaire
CREATE POLICY "Suppression par cabinet" ON decisions
  FOR DELETE USING (
    cabinet_id IN (SELECT cabinet_id FROM profiles WHERE profiles.id = auth.uid())
  );

-- ═══════════════════════════════════════════
-- RLS : STATS_CACHE
-- ═══════════════════════════════════════════
ALTER TABLE stats_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stats cache lisible par tous les authentifiés" ON stats_cache
  FOR SELECT USING (auth.role() = 'authenticated');
