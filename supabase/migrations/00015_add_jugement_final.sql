-- Add final judgment tracking to analyses
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS jugement_final TEXT;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS jugement_date TIMESTAMPTZ;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS jugement_resultat TEXT CHECK (jugement_resultat IN ('favorable', 'partiellement_favorable', 'defavorable'));
