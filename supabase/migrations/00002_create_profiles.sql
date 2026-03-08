-- Table des profils utilisateurs
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cabinet_id UUID REFERENCES cabinets(id),
  full_name TEXT,
  role TEXT DEFAULT 'avocat' CHECK (role IN ('avocat', 'admin', 'collaborateur')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour la recherche par cabinet
CREATE INDEX idx_profiles_cabinet ON profiles(cabinet_id);

-- Trigger pour créer automatiquement un profil + cabinet à l'inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_cabinet_id UUID;
  cabinet_slug TEXT;
BEGIN
  -- Créer un cabinet si un nom est fourni dans les métadonnées
  IF NEW.raw_user_meta_data->>'cabinet_name' IS NOT NULL THEN
    cabinet_slug := lower(regexp_replace(
      NEW.raw_user_meta_data->>'cabinet_name',
      '[^a-zA-Z0-9]+', '-', 'g'
    ));
    -- Ajouter un suffixe unique si le slug existe déjà
    IF EXISTS (SELECT 1 FROM cabinets WHERE slug = cabinet_slug) THEN
      cabinet_slug := cabinet_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
    END IF;

    INSERT INTO cabinets (name, slug)
    VALUES (NEW.raw_user_meta_data->>'cabinet_name', cabinet_slug)
    RETURNING id INTO new_cabinet_id;
  END IF;

  -- Créer le profil
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
