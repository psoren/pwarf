-- Add travel and party fields to the expeditions table for the expedition system.

ALTER TABLE expeditions ADD COLUMN IF NOT EXISTS civilization_id UUID REFERENCES civilizations(id);
ALTER TABLE expeditions ADD COLUMN IF NOT EXISTS travel_ticks_remaining INT NOT NULL DEFAULT 0;
ALTER TABLE expeditions ADD COLUMN IF NOT EXISTS return_ticks_remaining INT NOT NULL DEFAULT 0;
ALTER TABLE expeditions ADD COLUMN IF NOT EXISTS destination_tile_x INT;
ALTER TABLE expeditions ADD COLUMN IF NOT EXISTS destination_tile_y INT;
ALTER TABLE expeditions ADD COLUMN IF NOT EXISTS party_strength INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS expeditions_civ_idx ON expeditions(civilization_id);
