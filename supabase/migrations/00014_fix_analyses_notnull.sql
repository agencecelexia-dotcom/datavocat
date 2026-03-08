-- Ensure user_id is never null on analyses
ALTER TABLE analyses ALTER COLUMN user_id SET NOT NULL;
