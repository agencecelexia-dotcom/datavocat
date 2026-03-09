-- Drop client_id from analyses
ALTER TABLE analyses DROP COLUMN IF EXISTS client_id;

-- Drop clients table
DROP TABLE IF EXISTS clients CASCADE;

-- Drop decisions table
DROP TABLE IF EXISTS decisions CASCADE;

-- Drop stats_cache table
DROP TABLE IF EXISTS stats_cache CASCADE;

-- Drop views
DROP VIEW IF EXISTS v_stats_par_juridiction CASCADE;
DROP VIEW IF EXISTS v_stats_par_motif CASCADE;
DROP VIEW IF EXISTS v_stats_appel CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS refresh_stats_cache();
DROP FUNCTION IF EXISTS score_affaire_similaire(text, text, text, integer, boolean, boolean, boolean);
