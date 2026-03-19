// ============================================================
// Enum types (matching Postgres enums as string unions)
// ============================================================

export type CivilizationStatus = 'active' | 'fallen' | 'abandoned' | 'mythic';

export type CauseOfDeath =
  | 'siege'
  | 'flood'
  | 'magma'
  | 'starvation'
  | 'tantrum_spiral'
  | 'plague'
  | 'undead'
  | 'cave_in'
  | 'forgotten_beast'
  | 'abandonment'
  | 'unknown'
  | 'titan';

export type DwarfStatus = 'alive' | 'dead' | 'missing' | 'ghost' | 'feral';

export type ItemQuality =
  | 'garbage'
  | 'poor'
  | 'standard'
  | 'fine'
  | 'superior'
  | 'exceptional'
  | 'masterwork'
  | 'artifact';

export type ItemCategory =
  | 'weapon'
  | 'armor'
  | 'tool'
  | 'food'
  | 'drink'
  | 'gem'
  | 'cloth'
  | 'furniture'
  | 'mechanism'
  | 'book'
  | 'crafted'
  | 'raw_material'
  | 'container';

export type RelationshipType =
  | 'friend'
  | 'rival'
  | 'lover'
  | 'spouse'
  | 'parent'
  | 'child'
  | 'sibling'
  | 'mentor'
  | 'student'
  | 'nemesis'
  | 'acquaintance';

export type FactionType =
  | 'guild'
  | 'noble_house'
  | 'religious_sect'
  | 'military_order'
  | 'criminal'
  | 'merchant_consortium'
  | 'outsider_civ';

export type ExpeditionStatus =
  | 'traveling'
  | 'active'
  | 'looting'
  | 'retreating'
  | 'complete'
  | 'lost';

export type EventCategory =
  | 'battle'
  | 'death'
  | 'birth'
  | 'marriage'
  | 'artifact_created'
  | 'artifact_lost'
  | 'fortress_founded'
  | 'fortress_fallen'
  | 'migration'
  | 'discovery'
  | 'myth'
  | 'monster_sighting'
  | 'monster_slain'
  | 'monster_siege';

export type TerrainType =
  | 'mountain'
  | 'forest'
  | 'plains'
  | 'desert'
  | 'tundra'
  | 'swamp'
  | 'ocean'
  | 'volcano'
  | 'underground'
  | 'haunted'
  | 'savage'
  | 'evil';

export type MonsterType =
  | 'forgotten_beast'
  | 'titan'
  | 'megabeast'
  | 'dragon'
  | 'demon'
  | 'undead_lord'
  | 'night_creature'
  | 'giant'
  | 'siege_beast'
  | 'nature_spirit'
  | 'construct'
  | 'vermin_lord';

export type MonsterStatus =
  | 'active'
  | 'dormant'
  | 'slain'
  | 'fled'
  | 'imprisoned'
  | 'legendary';

export type MonsterBehavior =
  | 'neutral'
  | 'territorial'
  | 'aggressive'
  | 'sieging'
  | 'corrupting'
  | 'fleeing'
  | 'hibernating'
  | 'hunting';

export type EncounterOutcome =
  | 'repelled'
  | 'overrun'
  | 'fled'
  | 'captured'
  | 'negotiated'
  | 'pyrrhic_victory'
  | 'catastrophic_loss'
  | 'unknown';

export type TaskType =
  | 'mine'
  | 'haul'
  | 'farm_till'
  | 'farm_plant'
  | 'farm_harvest'
  | 'eat'
  | 'drink'
  | 'sleep'
  | 'build_wall'
  | 'build_floor'
  | 'build_stairs_up'
  | 'build_stairs_down'
  | 'build_stairs_both'
  | 'wander';

export type TaskStatus =
  | 'pending'
  | 'claimed'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type FortressTileType =
  | 'open_air'
  | 'grass'
  | 'tree'
  | 'rock'
  | 'bush'
  | 'pond'
  | 'soil'
  | 'stone'
  | 'ore'
  | 'gem'
  | 'water'
  | 'magma'
  | 'lava_stone'
  | 'cavern_floor'
  | 'cavern_wall'
  | 'constructed_wall'
  | 'constructed_floor'
  | 'stair_up'
  | 'stair_down'
  | 'stair_both'
  | 'well'
  | 'mushroom_garden'
  | 'empty';

// ============================================================
// Row types for all tables
// ============================================================

export interface World {
  id: string;
  name: string;
  seed: number;
  width: number;
  height: number;
  age_years: number;
  created_at: string;
  is_public: boolean;
  history_summary: Record<string, unknown>;
}

export interface WorldTile {
  id: string;
  world_id: string;
  /** PostGIS geometry stored as GeoJSON or WKT — opaque at the TS layer */
  coord: unknown;
  x: number;
  y: number;
  terrain: TerrainType;
  elevation: number;
  biome_tags: string[];
  explored: boolean;
}

export interface Player {
  id: string;
  username: string;
  display_name: string | null;
  world_id: string | null;
  created_at: string;
  last_active_at: string | null;
  total_years_survived: number;
  legendary_deeds: unknown[];
}

export interface Civilization {
  id: string;
  player_id: string;
  world_id: string;
  name: string;
  epithet: string | null;
  status: CivilizationStatus;
  founded_year: number;
  fallen_year: number | null;
  cause_of_death: CauseOfDeath | null;
  tile_x: number;
  tile_y: number;
  population: number;
  wealth: number;
  snapshot: Record<string, unknown> | null;
  snapshot_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Ruin {
  id: string;
  civilization_id: string;
  world_id: string;
  name: string;
  tile_x: number;
  tile_y: number;
  fallen_year: number;
  cause_of_death: CauseOfDeath;
  original_wealth: number;
  remaining_wealth: number;
  peak_population: number;
  danger_level: number;
  is_contaminated: boolean;
  contamination_type: string | null;
  ghost_count: number;
  is_trapped: boolean;
  resident_monster_id: string | null;
  snapshot: Record<string, unknown> | null;
  snapshot_url: string | null;
  is_published: boolean;
  created_at: string;
}

export interface Expedition {
  id: string;
  player_id: string;
  ruin_id: string;
  status: ExpeditionStatus;
  dwarf_ids: string[];
  started_at: string;
  completed_at: string | null;
  items_looted: string[];
  dwarves_lost: number;
  expedition_log: string | null;
}

export interface Dwarf {
  id: string;
  civilization_id: string;
  name: string;
  surname: string | null;
  status: DwarfStatus;
  age: number;
  gender: string | null;
  need_food: number;
  need_drink: number;
  need_sleep: number;
  need_social: number;
  need_purpose: number;
  need_beauty: number;
  stress_level: number;
  is_in_tantrum: boolean;
  health: number;
  injuries: unknown[];
  memories: unknown[];
  trait_openness: number | null;
  trait_conscientiousness: number | null;
  trait_extraversion: number | null;
  trait_agreeableness: number | null;
  trait_neuroticism: number | null;
  religious_devotion: number;
  faction_id: string | null;
  born_year: number | null;
  died_year: number | null;
  cause_of_death: string | null;
  current_task_id: string | null;
  position_x: number;
  position_y: number;
  position_z: number;
  created_at: string;
}

export interface DwarfSkill {
  id: string;
  dwarf_id: string;
  skill_name: string;
  level: number;
  xp: number;
  last_used_year: number | null;
}

export interface DwarfRelationship {
  id: string;
  dwarf_a_id: string;
  dwarf_b_id: string;
  type: RelationshipType;
  strength: number;
  shared_events: unknown[];
  formed_year: number | null;
}

export interface Faction {
  id: string;
  world_id: string;
  name: string;
  type: FactionType;
  power_level: number;
  disposition: number;
  lore: string | null;
  founded_year: number | null;
  is_active: boolean;
  beliefs: Record<string, unknown>;
}

export interface CivFactionRelation {
  id: string;
  civilization_id: string;
  faction_id: string;
  standing: number;
  is_at_war: boolean;
  trade_active: boolean;
}

export interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  quality: ItemQuality;
  material: string | null;
  weight: number | null;
  value: number;
  is_artifact: boolean;
  created_by_dwarf_id: string | null;
  created_in_civ_id: string | null;
  created_year: number | null;
  held_by_dwarf_id: string | null;
  located_in_civ_id: string | null;
  located_in_ruin_id: string | null;
  lore: string | null;
  properties: Record<string, unknown>;
  created_at: string;
}

export interface Monster {
  id: string;
  world_id: string;
  name: string;
  epithet: string | null;
  type: MonsterType;
  status: MonsterStatus;
  behavior: MonsterBehavior;
  is_named: boolean;
  lair_tile_x: number | null;
  lair_tile_y: number | null;
  current_tile_x: number | null;
  current_tile_y: number | null;
  threat_level: number;
  health: number;
  size_category: string;
  body_parts: unknown[];
  attacks: unknown[];
  abilities: unknown[];
  weaknesses: unknown[];
  lore: string | null;
  origin_myth: string | null;
  properties: Record<string, unknown>;
  first_seen_year: number | null;
  slain_year: number | null;
  slain_by_dwarf_id: string | null;
  slain_in_civ_id: string | null;
  slain_in_ruin_id: string | null;
  created_at: string;
}

export interface MonsterEncounter {
  id: string;
  monster_id: string;
  world_id: string;
  civilization_id: string | null;
  ruin_id: string | null;
  year: number;
  outcome: EncounterOutcome;
  dwarves_killed: number;
  monster_health_after: number | null;
  items_destroyed: string[];
  items_stolen: string[];
  structures_damaged: string[];
  description: string | null;
  encounter_log: string | null;
  event_data: Record<string, unknown>;
}

export interface MonsterBounty {
  id: string;
  monster_id: string;
  world_id: string;
  posted_by_civ_id: string | null;
  reward_value: number;
  reward_item_id: string | null;
  posted_year: number;
  expires_year: number | null;
  is_claimed: boolean;
  claimed_by_player_id: string | null;
  claimed_year: number | null;
}

export interface WorldEvent {
  id: string;
  world_id: string;
  year: number;
  category: EventCategory;
  civilization_id: string | null;
  ruin_id: string | null;
  dwarf_id: string | null;
  item_id: string | null;
  faction_id: string | null;
  monster_id: string | null;
  description: string;
  event_data: Record<string, unknown>;
  created_at: string;
}

export interface TradeCaravan {
  id: string;
  world_id: string;
  faction_id: string | null;
  origin_civ_id: string | null;
  destination_civ_id: string | null;
  arrived_year: number | null;
  departed_year: number | null;
  manifest: Record<string, unknown>;
  outcome: string | null;
  reputation_delta: number | null;
}

export interface Disease {
  id: string;
  world_id: string;
  name: string;
  lethality: number;
  contagion_rate: number;
  incubation_days: number;
  active_in_civs: string[];
  active_in_ruins: string[];
  first_seen_year: number | null;
  is_eradicated: boolean;
}

export interface Structure {
  id: string;
  civilization_id: string;
  name: string | null;
  type: string;
  completion_pct: number;
  built_year: number | null;
  ruin_id: string | null;
  quality: ItemQuality | null;
  notes: string | null;
}

export interface FortressTile {
  id: string;
  civilization_id: string;
  x: number;
  y: number;
  z: number;
  tile_type: FortressTileType;
  material: string | null;
  is_revealed: boolean;
  is_mined: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  civilization_id: string;
  task_type: TaskType;
  status: TaskStatus;
  priority: number;
  assigned_dwarf_id: string | null;
  target_x: number | null;
  target_y: number | null;
  target_z: number | null;
  target_item_id: string | null;
  work_progress: number;
  work_required: number;
  created_at: string;
  completed_at: string | null;
}
