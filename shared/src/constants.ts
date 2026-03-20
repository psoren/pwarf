// ============================================================
// Simulation timing
// ============================================================

/** Target sim steps executed per real-time second */
export const STEPS_PER_SECOND = 10;

/** Total sim steps in one in-game year (30 real minutes) */
export const STEPS_PER_YEAR = 18_000;

/** Approximate sim steps in one in-game day (18000 / 365 ≈ 49) */
export const STEPS_PER_DAY = 49;

// ============================================================
// World dimensions
// ============================================================

export const WORLD_WIDTH = 512;
export const WORLD_HEIGHT = 512;

// ============================================================
// Dwarf needs & stress
// ============================================================

/** Upper bound for any need value */
export const MAX_NEED = 100;

/** Lower bound for any need value */
export const MIN_NEED = 0;

/** Stress level at which a dwarf may enter a tantrum */
export const STRESS_TANTRUM_THRESHOLD = 80;

// ============================================================
// Need decay rates (per tick)
// ============================================================
// Physical needs decay faster than psychological needs.

/** How much food need decreases each tick */
export const FOOD_DECAY_PER_TICK = 0.15;

/** How much drink need decreases each tick (thirst is more urgent) */
export const DRINK_DECAY_PER_TICK = 0.2;

/** How much sleep need decreases each tick */
export const SLEEP_DECAY_PER_TICK = 0.12;

/** How much social need decreases each tick */
export const SOCIAL_DECAY_PER_TICK = 0.05;

/** How much purpose need decreases each tick */
export const PURPOSE_DECAY_PER_TICK = 0.04;

/** How much beauty need decreases each tick */
export const BEAUTY_DECAY_PER_TICK = 0.03;

// ============================================================
// Stress severity tiers
// ============================================================

/** Mild tantrum threshold (same as STRESS_TANTRUM_THRESHOLD) */
export const STRESS_TANTRUM_MILD = 80;

/** Moderate tantrum threshold */
export const STRESS_TANTRUM_MODERATE = 90;

/** Severe tantrum threshold */
export const STRESS_TANTRUM_SEVERE = 96;

// ============================================================
// Skills
// ============================================================

/** Maximum achievable skill level for any dwarf skill */
export const MAX_SKILL_LEVEL = 20;

// ============================================================
// Task dispatch
// ============================================================

/** Base work progress added per tick (before skill modifier) */
export const BASE_WORK_RATE = 1;

/** Need threshold below which a dwarf interrupts work to drink */
export const NEED_INTERRUPT_DRINK = 30;

/** Need threshold below which a dwarf interrupts work to eat */
export const NEED_INTERRUPT_FOOD = 30;

/** Need threshold below which a dwarf interrupts work to sleep */
export const NEED_INTERRUPT_SLEEP = 20;

/** Ticks at need_food=0 before starvation death (~10 in-game days) */
export const STARVATION_TICKS = 490;

/** Ticks at need_drink=0 before dehydration death (~5 in-game days) */
export const DEHYDRATION_TICKS = 245;

/** Amount need_food is restored when eating basic food */
export const FOOD_RESTORE_AMOUNT = 40;

/** Amount need_drink is restored when drinking basic drink */
export const DRINK_RESTORE_AMOUNT = 50;

/** Total amount need_sleep is restored over the course of one sleep task */
export const SLEEP_RESTORE_AMOUNT = 60;

/** Stress penalty per tick for sleeping on the floor instead of a bed */
export const FLOOR_SLEEP_STRESS = 5;

// ============================================================
// Task work requirements
// ============================================================

/** Base work required to mine a tile */
export const WORK_MINE_BASE = 100;

/** Work required to chop a tree */
export const WORK_CHOP_TREE = 60;

/** Work required to clear a rock */
export const WORK_CLEAR_ROCK = 40;

/** Work required to clear a bush */
export const WORK_CLEAR_BUSH = 20;

/** Base work required to haul an item */
export const WORK_HAUL_BASE = 20;

/** Work required for a haul task (quick — mostly walking) */
export const WORK_HAUL = 10;

/** Base work required to till a farm plot */
export const WORK_FARM_TILL_BASE = 60;

/** Base work required to plant seeds */
export const WORK_FARM_PLANT_BASE = 40;

/** Base work required to harvest a crop */
export const WORK_FARM_HARVEST_BASE = 30;

/** Work required for eating */
export const WORK_EAT = 10;

/** Work required for drinking */
export const WORK_DRINK = 10;

/** Work required for sleeping (~8 in-game hours ≈ 16 ticks) */
export const WORK_SLEEP = 16;

/** Amount need_sleep is restored per tick while sleeping (SLEEP_RESTORE_AMOUNT / WORK_SLEEP) */
export const SLEEP_RESTORE_PER_TICK = SLEEP_RESTORE_AMOUNT / WORK_SLEEP;

/** Work required to build a wall */
export const WORK_BUILD_WALL = 80;

/** Work required to build a floor */
export const WORK_BUILD_FLOOR = 50;

/** Work required to build a bed */
export const WORK_BUILD_BED = 60;

/** Work required to wander (just walking, instant once arrived) */
export const WORK_WANDER = 1;

/** Max distance a dwarf will wander from current position */
export const WANDER_RADIUS = 8;

// ============================================================
// Material hardness multipliers (for mining)
// ============================================================

export const HARDNESS_SOIL = 0.3;
export const HARDNESS_STONE = 1.0;
export const HARDNESS_IGNITE = 1.5;
export const HARDNESS_ORE = 1.2;
export const HARDNESS_GEM = 1.4;

// ============================================================
// XP awards
// ============================================================

export const XP_MINE = 15;
export const XP_FARM_TILL = 10;
export const XP_FARM_PLANT = 10;
export const XP_FARM_HARVEST = 10;
export const XP_BUILD = 12;
export const XP_HAUL = 5;

// ============================================================
// Inventory & stockpile
// ============================================================

/** Maximum weight a dwarf can carry */
export const DWARF_CARRY_CAPACITY = 50;

/** Maximum items per stockpile tile */
export const STOCKPILE_TILE_CAPACITY = 3;

// ============================================================
// Scoring weights (job claiming)
// ============================================================

export const SCORE_PRIORITY_WEIGHT = 3;
export const SCORE_SKILL_WEIGHT = 2;
export const SCORE_DISTANCE_WEIGHT = 0.5;

/** Bonus added when a task matches the dwarf's highest-level skill */
export const SCORE_BEST_SKILL_BONUS = 5;

// ============================================================
// Polling / flush intervals (milliseconds)
// ============================================================

/** Milliseconds between sim write cycles */
export const WRITE_INTERVAL = 1_000;

/** Number of sim ticks per write cycle (WRITE_INTERVAL / tick duration) */
export const WRITE_TICKS = 10;

/** How often the sim engine flushes dirty state to Supabase and polls for new tasks */
export const SIM_FLUSH_INTERVAL_MS = 15_000;

/** How often the frontend polls for dwarf updates */
export const POLL_DWARVES_MS = 2_000;

/** How often the frontend polls for task updates */
export const POLL_TASKS_MS = 2_000;

/** How often the frontend polls for event updates */
export const POLL_EVENTS_MS = 3_000;

/** How often the frontend polls for fortress tile overrides */
export const POLL_FORTRESS_TILES_MS = 3_000;
