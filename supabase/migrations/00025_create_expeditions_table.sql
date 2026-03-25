-- Create the expeditions table (was missing — migration 00022 assumed it existed).

CREATE TYPE expedition_status AS ENUM (
  'traveling', 'active', 'looting', 'retreating', 'complete', 'failed'
);

CREATE TABLE IF NOT EXISTS expeditions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players(id),
  ruin_id UUID NOT NULL REFERENCES ruins(id),
  status expedition_status NOT NULL DEFAULT 'traveling',
  dwarf_ids UUID[] NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  items_looted UUID[] NOT NULL DEFAULT '{}',
  dwarves_lost INT NOT NULL DEFAULT 0,
  expedition_log TEXT,
  civilization_id UUID REFERENCES civilizations(id),
  travel_ticks_remaining INT NOT NULL DEFAULT 0,
  return_ticks_remaining INT NOT NULL DEFAULT 0,
  destination_tile_x INT,
  destination_tile_y INT,
  party_strength INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS expeditions_civ_idx ON expeditions(civilization_id);
CREATE INDEX IF NOT EXISTS expeditions_player_idx ON expeditions(player_id);

-- RLS: players can only see their own expeditions
ALTER TABLE expeditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view own expeditions"
  ON expeditions FOR SELECT
  USING (player_id = auth.uid());

CREATE POLICY "Players can insert own expeditions"
  ON expeditions FOR INSERT
  WITH CHECK (player_id = auth.uid());

CREATE POLICY "Players can update own expeditions"
  ON expeditions FOR UPDATE
  USING (player_id = auth.uid());
