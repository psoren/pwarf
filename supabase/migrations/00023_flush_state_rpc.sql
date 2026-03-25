-- Add missing fortress tile types used by the sim
ALTER TYPE fortress_tile_type ADD VALUE IF NOT EXISTS 'door';
ALTER TYPE fortress_tile_type ADD VALUE IF NOT EXISTS 'smooth_stone';
ALTER TYPE fortress_tile_type ADD VALUE IF NOT EXISTS 'engraved_stone';
ALTER TYPE fortress_tile_type ADD VALUE IF NOT EXISTS 'sand';
ALTER TYPE fortress_tile_type ADD VALUE IF NOT EXISTS 'mud';
ALTER TYPE fortress_tile_type ADD VALUE IF NOT EXISTS 'ice';

-- Drop FK constraints between sim-managed tables. The sim engine maintains
-- referential integrity in memory — these DB constraints only cause cascading
-- flush failures when entities are created/consumed between flush cycles.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_target_item_id_fkey;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_dwarf_id_fkey;
ALTER TABLE dwarves DROP CONSTRAINT IF EXISTS dwarves_current_task_id_fkey;

-- Keep items FK constraints deferrable (less problematic, still useful for data integrity)
ALTER TABLE items ALTER CONSTRAINT items_held_by_dwarf_id_fkey DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE items ALTER CONSTRAINT items_created_by_dwarf_id_fkey DEFERRABLE INITIALLY IMMEDIATE;

-- Single RPC function that flushes all dirty sim state in one transaction.
-- Replaces 12 separate REST calls with 1, eliminating auth-lock contention.
CREATE OR REPLACE FUNCTION flush_state(
  p_items           jsonb DEFAULT '[]',
  p_structures      jsonb DEFAULT '[]',
  p_tasks           jsonb DEFAULT '[]',
  p_dwarves         jsonb DEFAULT '[]',
  p_monsters        jsonb DEFAULT '[]',
  p_dwarf_skills    jsonb DEFAULT '[]',
  p_fortress_tiles  jsonb DEFAULT '[]',
  p_new_relationships jsonb DEFAULT '[]',
  p_dirty_relationships jsonb DEFAULT '[]',
  p_events          jsonb DEFAULT '[]',
  p_ruins           jsonb DEFAULT '[]',
  -- Civilization updates
  p_civ_id          uuid    DEFAULT NULL,
  p_civ_fallen      boolean DEFAULT false,
  p_civ_fallen_year int     DEFAULT NULL,
  p_civ_cause       text    DEFAULT NULL,
  p_civ_population  int     DEFAULT NULL,
  p_civ_wealth      bigint  DEFAULT NULL,
  p_civ_dirty       boolean DEFAULT false,
  -- Ruin creation on civ fall
  p_new_ruin        jsonb   DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- Defer all FK checks until end of transaction so insert order doesn't matter
  SET CONSTRAINTS ALL DEFERRED;

  -- 1. Items
  IF jsonb_array_length(p_items) > 0 THEN
    INSERT INTO items (id, name, category, quality, material, weight, value,
      is_artifact, created_by_dwarf_id, created_in_civ_id, created_year,
      held_by_dwarf_id, located_in_civ_id, located_in_ruin_id, lore,
      properties, created_at, position_x, position_y, position_z)
    SELECT * FROM jsonb_populate_recordset(null::items, p_items)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      quality = EXCLUDED.quality,
      material = EXCLUDED.material,
      weight = EXCLUDED.weight,
      value = EXCLUDED.value,
      is_artifact = EXCLUDED.is_artifact,
      held_by_dwarf_id = EXCLUDED.held_by_dwarf_id,
      located_in_civ_id = EXCLUDED.located_in_civ_id,
      located_in_ruin_id = EXCLUDED.located_in_ruin_id,
      position_x = EXCLUDED.position_x,
      position_y = EXCLUDED.position_y,
      position_z = EXCLUDED.position_z;
  END IF;

  -- 2. Structures
  IF jsonb_array_length(p_structures) > 0 THEN
    INSERT INTO structures (id, civilization_id, name, type, completion_pct,
      built_year, ruin_id, quality, notes, position_x, position_y, position_z,
      occupied_by_dwarf_id)
    SELECT * FROM jsonb_populate_recordset(null::structures, p_structures)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      completion_pct = EXCLUDED.completion_pct,
      quality = EXCLUDED.quality,
      notes = EXCLUDED.notes,
      occupied_by_dwarf_id = EXCLUDED.occupied_by_dwarf_id;
  END IF;

  -- 3. Tasks
  IF jsonb_array_length(p_tasks) > 0 THEN
    INSERT INTO tasks (id, civilization_id, task_type, status, priority,
      assigned_dwarf_id, target_x, target_y, target_z, target_item_id,
      work_progress, work_required, created_at, completed_at)
    SELECT * FROM jsonb_populate_recordset(null::tasks, p_tasks)
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      priority = EXCLUDED.priority,
      assigned_dwarf_id = EXCLUDED.assigned_dwarf_id,
      target_item_id = EXCLUDED.target_item_id,
      work_progress = EXCLUDED.work_progress,
      work_required = EXCLUDED.work_required,
      completed_at = EXCLUDED.completed_at;
  END IF;

  -- 4. Dwarves
  IF jsonb_array_length(p_dwarves) > 0 THEN
    INSERT INTO dwarves (id, civilization_id, name, surname, status, age, gender,
      need_food, need_drink, need_sleep, need_social, need_purpose, need_beauty,
      stress_level, is_in_tantrum, health, memories,
      trait_openness, trait_conscientiousness, trait_extraversion,
      trait_agreeableness, trait_neuroticism,
      born_year, died_year, cause_of_death, created_at,
      current_task_id, position_x, position_y, position_z)
    SELECT * FROM jsonb_populate_recordset(null::dwarves, p_dwarves)
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      need_food = EXCLUDED.need_food,
      need_drink = EXCLUDED.need_drink,
      need_sleep = EXCLUDED.need_sleep,
      need_social = EXCLUDED.need_social,
      need_purpose = EXCLUDED.need_purpose,
      need_beauty = EXCLUDED.need_beauty,
      stress_level = EXCLUDED.stress_level,
      is_in_tantrum = EXCLUDED.is_in_tantrum,
      health = EXCLUDED.health,
      memories = EXCLUDED.memories,
      died_year = EXCLUDED.died_year,
      cause_of_death = EXCLUDED.cause_of_death,
      current_task_id = EXCLUDED.current_task_id,
      position_x = EXCLUDED.position_x,
      position_y = EXCLUDED.position_y,
      position_z = EXCLUDED.position_z;
  END IF;

  -- 5. Monsters
  IF jsonb_array_length(p_monsters) > 0 THEN
    INSERT INTO monsters
    SELECT * FROM jsonb_populate_recordset(null::monsters, p_monsters)
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      behavior = EXCLUDED.behavior,
      current_tile_x = EXCLUDED.current_tile_x,
      current_tile_y = EXCLUDED.current_tile_y,
      health = EXCLUDED.health,
      slain_year = EXCLUDED.slain_year,
      slain_by_dwarf_id = EXCLUDED.slain_by_dwarf_id,
      slain_in_civ_id = EXCLUDED.slain_in_civ_id,
      slain_in_ruin_id = EXCLUDED.slain_in_ruin_id;
  END IF;

  -- 6. Dwarf skills
  IF jsonb_array_length(p_dwarf_skills) > 0 THEN
    INSERT INTO dwarf_skills (id, dwarf_id, skill_name, level, xp, last_used_year)
    SELECT * FROM jsonb_populate_recordset(null::dwarf_skills, p_dwarf_skills)
    ON CONFLICT (id) DO UPDATE SET
      level = EXCLUDED.level,
      xp = EXCLUDED.xp,
      last_used_year = EXCLUDED.last_used_year;
  END IF;

  -- 7. Fortress tiles (unique on civilization_id, x, y, z)
  IF jsonb_array_length(p_fortress_tiles) > 0 THEN
    INSERT INTO fortress_tiles (id, civilization_id, x, y, z, tile_type,
      material, is_revealed, is_mined, created_at)
    SELECT * FROM jsonb_populate_recordset(null::fortress_tiles, p_fortress_tiles)
    ON CONFLICT (civilization_id, x, y, z) DO UPDATE SET
      tile_type = EXCLUDED.tile_type,
      material = EXCLUDED.material,
      is_revealed = EXCLUDED.is_revealed,
      is_mined = EXCLUDED.is_mined;
  END IF;

  -- 8. Relationships (new = insert, dirty = upsert)
  IF jsonb_array_length(p_new_relationships) > 0 THEN
    INSERT INTO dwarf_relationships
    SELECT * FROM jsonb_populate_recordset(null::dwarf_relationships, p_new_relationships)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  IF jsonb_array_length(p_dirty_relationships) > 0 THEN
    INSERT INTO dwarf_relationships
    SELECT * FROM jsonb_populate_recordset(null::dwarf_relationships, p_dirty_relationships)
    ON CONFLICT (id) DO UPDATE SET
      type = EXCLUDED.type,
      strength = EXCLUDED.strength,
      shared_events = EXCLUDED.shared_events;
  END IF;

  -- 9. Ruins
  IF jsonb_array_length(p_ruins) > 0 THEN
    INSERT INTO ruins
    SELECT * FROM jsonb_populate_recordset(null::ruins, p_ruins)
    ON CONFLICT (id) DO UPDATE SET
      remaining_wealth = EXCLUDED.remaining_wealth,
      danger_level = EXCLUDED.danger_level,
      ghost_count = EXCLUDED.ghost_count,
      is_published = EXCLUDED.is_published;
  END IF;

  -- 10. Events (immutable — skip duplicates)
  IF jsonb_array_length(p_events) > 0 THEN
    INSERT INTO world_events (id, world_id, year, category, civilization_id,
      ruin_id, dwarf_id, item_id, faction_id, monster_id, description,
      event_data, created_at)
    SELECT * FROM jsonb_populate_recordset(null::world_events, p_events)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- 11. Civilization status
  IF p_civ_fallen AND p_civ_id IS NOT NULL THEN
    UPDATE civilizations SET
      status = 'fallen',
      fallen_year = p_civ_fallen_year,
      cause_of_death = p_civ_cause::cause_of_death,
      population = 0
    WHERE id = p_civ_id;

    IF p_new_ruin IS NOT NULL THEN
      INSERT INTO ruins (civilization_id, world_id, name, tile_x, tile_y,
        fallen_year, cause_of_death, peak_population)
      SELECT civilization_id, world_id, name, tile_x, tile_y,
        fallen_year, cause_of_death::cause_of_death, peak_population
      FROM jsonb_populate_record(null::ruins, p_new_ruin);
    END IF;
  ELSIF p_civ_dirty AND p_civ_id IS NOT NULL THEN
    UPDATE civilizations SET
      population = p_civ_population,
      wealth = p_civ_wealth
    WHERE id = p_civ_id;
  END IF;

END;
$$;
