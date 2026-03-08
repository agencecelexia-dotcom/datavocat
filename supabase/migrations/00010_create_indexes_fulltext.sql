-- ═══════════════════════════════════════════
-- RECHERCHE FULL-TEXT sur les décisions
-- ═══════════════════════════════════════════

-- Colonne tsvector pour la recherche full-text
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Index GIN pour la recherche
CREATE INDEX IF NOT EXISTS idx_decisions_search ON decisions USING GIN(search_vector);

-- Fonction de mise à jour du vecteur de recherche
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

CREATE TRIGGER decisions_search_vector_update
  BEFORE INSERT OR UPDATE ON decisions
  FOR EACH ROW EXECUTE FUNCTION update_decision_search_vector();

-- ═══════════════════════════════════════════
-- INDEX COMPOSITES pour les filtres fréquents
-- ═══════════════════════════════════════════

-- Filtre courant : status + cabinet (liste des décisions du cabinet)
CREATE INDEX IF NOT EXISTS idx_decisions_cabinet_status
  ON decisions(cabinet_id, status);

-- Filtre courant : validées + juridiction_type (stats)
CREATE INDEX IF NOT EXISTS idx_decisions_validated_juridiction
  ON decisions(juridiction_type) WHERE status = 'validated';

-- Filtre courant : validées + resultat (stats)
CREATE INDEX IF NOT EXISTS idx_decisions_validated_resultat
  ON decisions(resultat) WHERE status = 'validated';

-- Filtre courant : date ordonnance 2017
CREATE INDEX IF NOT EXISTS idx_decisions_validated_post2017
  ON decisions(post_ordonnance_2017) WHERE status = 'validated';
