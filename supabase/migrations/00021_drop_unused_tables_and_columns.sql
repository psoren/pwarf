-- ============================================================
-- Drop unused tables, columns, stored procedures, and enums
-- ============================================================

-- 1. Drop stored procedures
DROP FUNCTION IF EXISTS fossilize_civilization(uuid, cause_of_death);
DROP FUNCTION IF EXISTS spawn_monster(uuid, text, monster_type, int, int, int, int, text);

-- 2. Drop FK constraints from surviving tables that reference tables being dropped
ALTER TABLE world_events DROP CONSTRAINT IF EXISTS world_events_faction_id_fkey;
ALTER TABLE dwarves DROP CONSTRAINT IF EXISTS dwarves_faction_fk;

-- 3. Drop FK constraint on column being dropped
ALTER TABLE ruins DROP CONSTRAINT IF EXISTS ruins_monster_fk;

-- 4. Drop unused tables
DROP TABLE IF EXISTS expeditions CASCADE;
DROP TABLE IF EXISTS civ_faction_relations CASCADE;
DROP TABLE IF EXISTS diseases CASCADE;
DROP TABLE IF EXISTS trade_caravans CASCADE;
DROP TABLE IF EXISTS monster_encounters CASCADE;
DROP TABLE IF EXISTS monster_bounties CASCADE;
DROP TABLE IF EXISTS factions CASCADE;

-- 5. Drop unused columns from surviving tables
ALTER TABLE dwarves
  DROP COLUMN IF EXISTS religious_devotion,
  DROP COLUMN IF EXISTS faction_id,
  DROP COLUMN IF EXISTS injuries;

ALTER TABLE worlds
  DROP COLUMN IF EXISTS history_summary;

ALTER TABLE players
  DROP COLUMN IF EXISTS last_active_at,
  DROP COLUMN IF EXISTS total_years_survived,
  DROP COLUMN IF EXISTS legendary_deeds;

ALTER TABLE civilizations
  DROP COLUMN IF EXISTS snapshot,
  DROP COLUMN IF EXISTS snapshot_url,
  DROP COLUMN IF EXISTS epithet;

ALTER TABLE ruins
  DROP COLUMN IF EXISTS snapshot,
  DROP COLUMN IF EXISTS snapshot_url,
  DROP COLUMN IF EXISTS resident_monster_id,
  DROP COLUMN IF EXISTS is_contaminated,
  DROP COLUMN IF EXISTS contamination_type,
  DROP COLUMN IF EXISTS is_trapped;

ALTER TABLE monsters
  DROP COLUMN IF EXISTS body_parts,
  DROP COLUMN IF EXISTS attacks,
  DROP COLUMN IF EXISTS abilities,
  DROP COLUMN IF EXISTS weaknesses,
  DROP COLUMN IF EXISTS origin_myth;

-- 6. Drop orphaned enums
DROP TYPE IF EXISTS faction_type;
DROP TYPE IF EXISTS expedition_status;
DROP TYPE IF EXISTS encounter_outcome;
