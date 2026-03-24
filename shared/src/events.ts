import type {
  CauseOfDeath,
  EventCategory,
  MonsterBehavior,
  MonsterType,
} from './db-types.js';

// ============================================================
// Base event shape — every sim event carries these fields
// ============================================================

export interface SimEventBase {
  /** Monotonically increasing sim step when the event fired */
  step: number;
  /** In-game year */
  year: number;
  /** In-game day within the year (0-364) */
  day: number;
}

// ============================================================
// Sim tick heartbeat
// ============================================================

export interface SimTickEvent extends SimEventBase {
  type: 'sim_tick';
}

// ============================================================
// Dwarf events
// ============================================================

export type DwarfActionType =
  | 'mine'
  | 'build'
  | 'craft'
  | 'haul'
  | 'eat'
  | 'drink'
  | 'sleep'
  | 'socialize'
  | 'pray'
  | 'idle'
  | 'patrol'
  | 'train'
  | 'heal'
  | 'farm'
  | 'brew'
  | 'cook'
  | 'smith'
  | 'woodcut'
  | 'hunt';

export interface DwarfActionEvent extends SimEventBase {
  type: 'dwarf_action';
  dwarf_id: string;
  action: DwarfActionType;
  target_id: string | null;
  target_description: string | null;
}

export interface DwarfNeedCriticalEvent extends SimEventBase {
  type: 'dwarf_need_critical';
  dwarf_id: string;
  need: 'food' | 'drink' | 'sleep' | 'social' | 'purpose' | 'beauty';
  value: number;
}

export interface DwarfTantrumEvent extends SimEventBase {
  type: 'dwarf_tantrum';
  dwarf_id: string;
  stress_level: number;
  target_dwarf_id: string | null;
  items_destroyed: string[];
}

export interface DwarfMoodEvent extends SimEventBase {
  type: 'dwarf_mood';
  dwarf_id: string;
  mood: 'strange' | 'fey' | 'possessed' | 'melancholy' | 'berserk';
}

// ============================================================
// Combat events
// ============================================================

export interface CombatEvent extends SimEventBase {
  type: 'combat';
  attacker_id: string;
  attacker_kind: 'dwarf' | 'monster';
  defender_id: string;
  defender_kind: 'dwarf' | 'monster';
  damage: number;
  description: string;
}

// ============================================================
// Death events
// ============================================================

export interface DeathEvent extends SimEventBase {
  type: 'death';
  dwarf_id: string;
  cause: string;
  killer_id: string | null;
  killer_kind: 'dwarf' | 'monster' | 'environment' | null;
}

// ============================================================
// Migration events
// ============================================================

export interface MigrationEvent extends SimEventBase {
  type: 'migration';
  civilization_id: string;
  dwarf_count: number;
  dwarf_ids: string[];
}

// ============================================================
// Monster events
// ============================================================

export interface MonsterSpawnEvent extends SimEventBase {
  type: 'monster_spawn';
  monster_id: string;
  monster_type: MonsterType;
  name: string;
  tile_x: number;
  tile_y: number;
  threat_level: number;
}

export interface MonsterMoveEvent extends SimEventBase {
  type: 'monster_move';
  monster_id: string;
  from_x: number;
  from_y: number;
  to_x: number;
  to_y: number;
  behavior: MonsterBehavior;
}

export interface MonsterSiegeEvent extends SimEventBase {
  type: 'monster_siege';
  monster_id: string;
  civilization_id: string;
  description: string;
}

export interface MonsterSlainEvent extends SimEventBase {
  type: 'monster_slain';
  monster_id: string;
  slain_by_dwarf_id: string | null;
  civilization_id: string;
}

// ============================================================
// Fortress lifecycle events
// ============================================================

export interface FortressFoundedEvent extends SimEventBase {
  type: 'fortress_founded';
  civilization_id: string;
  name: string;
  tile_x: number;
  tile_y: number;
}

export interface FortressFallenEvent extends SimEventBase {
  type: 'fortress_fallen';
  civilization_id: string;
  cause: CauseOfDeath;
  population_at_death: number;
  wealth_at_death: number;
}

// ============================================================
// World / discovery events
// ============================================================

export interface DiscoveryEvent extends SimEventBase {
  type: 'discovery';
  civilization_id: string;
  description: string;
  tile_x: number;
  tile_y: number;
}

export interface ArtifactCreatedEvent extends SimEventBase {
  type: 'artifact_created';
  item_id: string;
  dwarf_id: string;
  civilization_id: string;
  description: string;
}

export interface TradeCaravanArrivalEvent extends SimEventBase {
  type: 'trade_caravan_arrival';
  caravan_id: string;
  faction_id: string | null;
  civilization_id: string;
}

export interface DiseaseOutbreakEvent extends SimEventBase {
  type: 'disease_outbreak';
  disease_id: string;
  civilization_id: string;
  name: string;
  lethality: number;
}

export interface YearRollupEvent extends SimEventBase {
  type: 'year_rollup';
  civilization_id: string;
  population: number;
  wealth: number;
  age_years: number;
}

// ============================================================
// Union of all sim events
// ============================================================

export type SimEvent =
  | SimTickEvent
  | DwarfActionEvent
  | DwarfNeedCriticalEvent
  | DwarfTantrumEvent
  | DwarfMoodEvent
  | CombatEvent
  | DeathEvent
  | MigrationEvent
  | MonsterSpawnEvent
  | MonsterMoveEvent
  | MonsterSiegeEvent
  | MonsterSlainEvent
  | FortressFoundedEvent
  | FortressFallenEvent
  | DiscoveryEvent
  | ArtifactCreatedEvent
  | TradeCaravanArrivalEvent
  | DiseaseOutbreakEvent
  | YearRollupEvent;
