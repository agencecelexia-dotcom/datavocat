-- Table clients : gestion des clients par avocat/cabinet
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cabinet_id UUID REFERENCES cabinets(id) ON DELETE SET NULL,
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  email TEXT,
  telephone TEXT,
  entreprise TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_cabinet_id ON clients(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_clients_nom ON clients(nom);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own clients" ON clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clients" ON clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clients" ON clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clients" ON clients FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on clients" ON clients FOR ALL USING (true) WITH CHECK (true);

-- Ajout de client_id à la table analyses
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_analyses_client_id ON analyses(client_id);
