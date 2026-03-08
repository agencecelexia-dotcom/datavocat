-- Table des cabinets (multi-tenant)
CREATE TABLE cabinets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour la recherche par slug
CREATE INDEX idx_cabinets_slug ON cabinets(slug);
