-- Bug reports with full game state snapshot for scenario test generation
CREATE TABLE bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL REFERENCES worlds(id),
  civilization_id UUID NOT NULL REFERENCES civilizations(id),
  player_id UUID NOT NULL REFERENCES players(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  game_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: players can insert their own reports and read all reports
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can insert their own bug reports"
  ON bug_reports FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players can read all bug reports"
  ON bug_reports FOR SELECT
  USING (true);
