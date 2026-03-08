-- Table for storing analysis history
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

-- RLS policies
CREATE POLICY "Users can view own analyses" ON analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own analyses" ON analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own analyses" ON analyses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own analyses" ON analyses FOR DELETE USING (auth.uid() = user_id);
-- Service role bypass for API routes
CREATE POLICY "Service role full access" ON analyses FOR ALL USING (true) WITH CHECK (true);
