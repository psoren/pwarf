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
// Social / purpose / beauty need restoration
// ============================================================

/** How much social need restored per tick per nearby dwarf */
export const SOCIAL_RESTORE_PER_NEARBY_DWARF = 0.3;

/** Manhattan-distance radius within which dwarves count as "nearby" for social need */
export const SOCIAL_PROXIMITY_RADIUS = 8;

/** Max number of nearby dwarves that contribute to social restore (diminishing returns beyond this) */
export const SOCIAL_PROXIMITY_MAX_DWARVES = 3;

/** Purpose restored on completing a skilled work task (mine, build, farm, brew) */
export const PURPOSE_RESTORE_SKILLED = 15;

/** Purpose restored on completing a hauling task */
export const PURPOSE_RESTORE_HAUL = 5;

/** Purpose restored on completing any other work task */
export const PURPOSE_RESTORE_DEFAULT = 8;

/** Baseline beauty restoration per tick (passive, always applies) */
export const BEAUTY_RESTORE_PASSIVE = 0.02;

/** Bonus beauty restoration per tick when near a well or mushroom garden */
export const BEAUTY_RESTORE_NEAR_STRUCTURE = 0.15;

/** Manhattan-distance radius for beauty structure proximity */
export const BEAUTY_STRUCTURE_RADIUS = 6;

/** Bonus beauty restoration per tick when near an engraved stone tile */
export const BEAUTY_RESTORE_NEAR_ENGRAVING = 0.08;

/** Manhattan-distance radius within which an engraved tile provides beauty */
export const BEAUTY_ENGRAVING_RADIUS = 4;

/** Number of recent world events to load at startup for engrave scene generation */
export const WORLD_EVENTS_RECENT_LIMIT = 20;

// ============================================================
// Personality trait modifiers
// ============================================================

/**
 * How much neuroticism scales stress gains.
 * Formula: gain × (1 + (trait - 0.5) × NEUROTICISM_STRESS_MULTIPLIER)
 * At trait=1.0: gains × 1.5 (neurotic — more stress)
 * At trait=0.5: gains × 1.0 (average — no effect)
 * At trait=0.0: gains × 0.5 (stable — less stress)
 */
export const NEUROTICISM_STRESS_MULTIPLIER = 1.0;

/**
 * Passive stress recovery added per tick at agreeableness=1.0.
 * Stacks on top of the base recovery when all needs are comfortable.
 */
export const AGREEABLENESS_RECOVERY_BONUS = 0.1;

/**
 * How much conscientiousness scales work speed.
 * Formula: workRate × (1 + (trait - 0.5) × CONSCIENTIOUSNESS_WORK_MULTIPLIER)
 * At trait=1.0: workRate × 1.25 (diligent — finishes faster)
 * At trait=0.5: workRate × 1.0 (average — no effect)
 * At trait=0.0: workRate × 0.75 (lazy — finishes slower)
 */
export const CONSCIENTIOUSNESS_WORK_MULTIPLIER = 0.5;

/**
 * How much extraversion scales social need decay.
 * Formula: socialDecay × (1 + (trait - 0.5) × EXTRAVERSION_SOCIAL_DECAY_MULTIPLIER)
 * At trait=1.0: decay × 1.5 (extravert — craves social contact more urgently)
 * At trait=0.5: decay × 1.0 (average — no effect)
 * At trait=0.0: decay × 0.5 (introvert — comfortable alone)
 */
export const EXTRAVERSION_SOCIAL_DECAY_MULTIPLIER = 1.0;

/**
 * How much openness scales beauty restoration from nearby structures.
 * Formula: bonus × (1 + (trait - 0.5) × OPENNESS_BEAUTY_MULTIPLIER)
 * At trait=1.0: bonus × 1.5 (appreciates art and beauty more)
 * At trait=0.5: bonus × 1.0 (average — no effect)
 * At trait=0.0: bonus × 0.5 (philistine — unmoved by surroundings)
 */
export const OPENNESS_BEAUTY_MULTIPLIER = 1.0;

// ============================================================
// Aging
// ============================================================

/** Age at which dwarves start rolling for natural death each year */
export const ELDER_DEATH_AGE = 80;

/**
 * Probability of natural death per year past ELDER_DEATH_AGE.
 * Compounds: a dwarf aged 85 has 5 extra years × 10% = ~50% accumulated risk.
 * Each year past 80 rolls independently at this probability.
 */
export const ELDER_DEATH_CHANCE_PER_YEAR = 0.1;

// ============================================================
// Immigration
// ============================================================

/** Probability of an immigration wave arriving each year (starting year 2). */
export const IMMIGRATION_CHANCE_PER_YEAR = 0.6;

/** Maximum number of immigrants that can arrive in a single wave. */
export const IMMIGRATION_MAX_ARRIVALS = 3;

/** Dwarf first names — shared between sim (immigration) and app (embark). */
export const DWARF_FIRST_NAMES = [
  'Urist', 'Doren', 'Kadol', 'Aban', 'Likot', 'Morul', 'Fikod',
  'Bomrek', 'Ducim', 'Erith', 'Goden', 'Ingiz', 'Kumil', 'Litast',
  'Mosus', 'Nish', 'Olon', 'Rigoth', 'Sodel', 'Tekkud',
];

/** Dwarf clan surnames — shared between sim (immigration) and app (embark). */
export const DWARF_SURNAMES = [
  'Hammerstone', 'Ironpick', 'Deepdelve', 'Coppervein', 'Granitearm',
  'Boulderfist', 'Axebeard', 'Goldseam', 'Rockjaw', 'Tunnelborn',
];

// ============================================================
// Disease
// ============================================================

/** Per-year probability of a disease outbreak starting */
export const DISEASE_OUTBREAK_CHANCE = 0.07;

/** Per-year probability that each healthy dwarf adjacent to an infected dwarf catches the disease */
export const DISEASE_SPREAD_CHANCE = 0.4;

/**
 * Per-year probability that disease spreads when a well exists in the fortress.
 * Wells represent clean water access which reduces transmission.
 */
export const DISEASE_SPREAD_CHANCE_WITH_WELL = 0.2;

/** Health lost per year by an infected dwarf */
export const DISEASE_HEALTH_DAMAGE_PER_YEAR = 15;

/**
 * Per-year probability that an infected dwarf recovers naturally.
 * Dwarves at full health recover faster; this applies regardless.
 */
export const DISEASE_RECOVERY_CHANCE = 0.5;

/** Manhattan-distance radius within which dwarves can spread disease */
export const DISEASE_SPREAD_RADIUS = 4;

// ============================================================
// Strange moods (artifact creation)
// ============================================================

/**
 * Probability that a dwarf at severe stress enters a strange mood
 * (producing an artifact) instead of a tantrum.
 */
export const STRANGE_MOOD_CHANCE = 0.05;

/** Work ticks required to complete an artifact during a strange mood */
export const STRANGE_MOOD_WORK = 500;

// ============================================================
// Witness stress (death trauma)
// ============================================================

/** Stress applied to alive dwarves who witness a nearby death */
export const WITNESS_DEATH_STRESS = 8;

/** Manhattan-distance radius within which a death is "witnessed" */
export const WITNESS_DEATH_RADIUS = 5;

// ============================================================
// Dwarf memory system
// ============================================================

/** Stress delta per tick for each active memory (scaled by intensity). */
export const MEMORY_STRESS_PER_TICK = 0.01;

/** Intensity of a "witnessed_death" memory (positive = stress). */
export const MEMORY_WITNESSED_DEATH_INTENSITY = 15;

/** How many in-game years a death memory lingers. */
export const MEMORY_WITNESSED_DEATH_DURATION_YEARS = 3;

/** Intensity of a "created_artifact" memory (negative = stress relief). */
export const MEMORY_ARTIFACT_INTENSITY = -20;

/** How many in-game years an artifact creation memory lingers. */
export const MEMORY_ARTIFACT_DURATION_YEARS = 5;

/** Intensity of a "created_masterwork" memory (negative = stress relief). */
export const MEMORY_MASTERWORK_INTENSITY = -10;

/** How many in-game years a masterwork memory lingers. */
export const MEMORY_MASTERWORK_DURATION_YEARS = 2;

// ============================================================
// Haunting
// ============================================================

/** Stress applied per tick to a living dwarf near an active ghost */
export const GHOST_STRESS_PER_TICK = 0.5;

/** Manhattan-distance radius within which a ghost haunts nearby dwarves */
export const GHOST_HAUNTING_RADIUS = 6;

// ============================================================
// Stress severity tiers
// ============================================================

/** Mild tantrum threshold (same as STRESS_TANTRUM_THRESHOLD) */
export const STRESS_TANTRUM_MILD = 80;

/** Moderate tantrum threshold */
export const STRESS_TANTRUM_MODERATE = 90;

/** Severe tantrum threshold */
export const STRESS_TANTRUM_SEVERE = 96;

/** Minimum ticks a mild tantrum lasts (stress 80–89) */
export const TANTRUM_DURATION_MILD = 50;

/** Minimum ticks a moderate tantrum lasts (stress 90–95) */
export const TANTRUM_DURATION_MODERATE = 100;

/** Minimum ticks a severe tantrum lasts (stress 96–100) */
export const TANTRUM_DURATION_SEVERE = 200;

/** Per-tick probability a mild tantrum dwarf destroys a nearby item */
export const TANTRUM_DESTROY_CHANCE_MILD = 0.02;

/** Per-tick probability a moderate tantrum dwarf destroys a nearby item */
export const TANTRUM_DESTROY_CHANCE_MODERATE = 0.05;

/** Per-tick probability a severe tantrum dwarf destroys a nearby item */
export const TANTRUM_DESTROY_CHANCE_SEVERE = 0.08;

/** Per-tick probability a moderate/severe tantrum dwarf attacks a nearby dwarf */
export const TANTRUM_ATTACK_CHANCE = 0.02;

/** Damage dealt to victim of a tantrum attack */
export const TANTRUM_ATTACK_DAMAGE = 10;

/** Stress applied to dwarves who witness a tantrum attack */
export const TANTRUM_WITNESS_STRESS = 5;

/** Manhattan-distance radius within which tantrum effects apply */
export const TANTRUM_PROXIMITY_RADIUS = 3;

// ============================================================
// Skills
// ============================================================

/** Maximum achievable skill level for any dwarf skill */
export const MAX_SKILL_LEVEL = 20;

/**
 * Dwarf Fortress-style skill tier names indexed by skill level (0–20).
 * Level 0 = Dabbling, level 20 = Legendary+4.
 */
export const SKILL_TIER_NAMES: readonly string[] = [
  'Dabbling',     // 0
  'Novice',       // 1
  'Apprentice',   // 2
  'Journeyman',   // 3
  'Competent',    // 4
  'Skilled',      // 5
  'Proficient',   // 6
  'Talented',     // 7
  'Adept',        // 8
  'Expert',       // 9
  'Professional', // 10
  'Accomplished', // 11
  'Great',        // 12
  'Master',       // 13
  'High Master',  // 14
  'Grand Master', // 15
  'Legendary',    // 16
  'Legendary+1',  // 17
  'Legendary+2',  // 18
  'Legendary+3',  // 19
  'Legendary+4',  // 20
];

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
export const WORK_BUILD_WALL = 40;

/** Work required to build a floor */
export const WORK_BUILD_FLOOR = 25;

/** Work required to build a bed */
export const WORK_BUILD_BED = 30;

/** Work required to build a well */
export const WORK_BUILD_WELL = 60;

/** Work required to build a mushroom garden */
export const WORK_BUILD_MUSHROOM_GARDEN = 50;

/** Work required to deconstruct a built structure or tile */
export const WORK_DECONSTRUCT = 30;

/** Work required to wander (just walking, instant once arrived) */
export const WORK_WANDER = 1;

/** Work required to smooth a stone tile */
export const WORK_SMOOTH = 80;

/** Work required to engrave a smoothed tile */
export const WORK_ENGRAVE = 60;

/** Work required to brew a batch of ale */
export const WORK_BREW = 50;

/** Minimum drink item count before auto-brew creates a new brew task */
export const MIN_DRINK_STOCK = 10;

/** Work required to cook a meal */
export const WORK_COOK = 40;

/** Minimum cooked food stock before auto-cook triggers */
export const MIN_COOK_STOCK = 15;

/** Work required to smith an item */
export const WORK_SMITH = 70;

/** Work required to engrave a memorial slab for a fallen dwarf */
export const WORK_ENGRAVE_MEMORIAL = 80;

/** Work required to forage food from a grass, tree, or bush tile */
export const WORK_FORAGE = 15;

/** Minimum food item count before auto-forage creates a new forage task */
export const MIN_FORAGE_FOOD_STOCK = 5;

/** XP awarded to the foraging skill on completing a forage task */
export const XP_FORAGE = 8;

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
export const XP_SMOOTH = 8;
export const XP_ENGRAVE = 10;
export const XP_BREW = 12;
export const XP_COOK = 12;
export const XP_SMITH = 15;

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
// Monsters & Combat
// ============================================================

/** Ticks between monster spawn checks. */
export const MONSTER_SPAWN_INTERVAL = 200;

/** Maximum number of active monsters at a time (MVP cap). */
export const MONSTER_MAX_ACTIVE = 1;

/** Base health for a spawned night_creature. */
export const MONSTER_NIGHT_CREATURE_HEALTH = 50;

/** Base threat level for a spawned night_creature. */
export const MONSTER_NIGHT_CREATURE_THREAT = 30;

/** Base damage a monster deals per combat tick (before threat scaling). */
export const MONSTER_ATTACK_BASE = 8;

/** Base damage a dwarf deals per combat tick. */
export const DWARF_ATTACK_BASE = 6;

/** Damage range spread (±) around the base value. */
export const COMBAT_DAMAGE_SPREAD = 5;

/** XP awarded to the dwarf who kills a monster. */
export const XP_MONSTER_KILL = 20;

// ============================================================
// Polling / flush intervals (milliseconds)
// ============================================================

/** Milliseconds between sim write cycles */
export const WRITE_INTERVAL = 1_000;

/** Number of sim ticks per write cycle (WRITE_INTERVAL / tick duration) */
export const WRITE_TICKS = 10;

/** How often the sim engine flushes dirty state to Supabase and polls for new tasks */
export const SIM_FLUSH_INTERVAL_MS = 2_000;

/** How often the frontend polls for dwarf updates */
export const POLL_DWARVES_MS = 2_000;

/** How often the frontend polls for task updates */
export const POLL_TASKS_MS = 2_000;

/** How often the frontend polls for event updates */
export const POLL_EVENTS_MS = 3_000;

/** How often the frontend polls for fortress tile overrides */
export const POLL_FORTRESS_TILES_MS = 3_000;


// ============================================================
// Dwarf relationships
// ============================================================

/** Probability that two nearby dwarves form an acquaintance relationship each year */
export const FRIENDSHIP_FORMATION_CHANCE = 0.3;

/** Years as acquaintance before upgrading to friend */
export const FRIEND_UPGRADE_YEARS = 2;

/** Extra stress spike when a close friend dies (immediate, on top of witness stress) */
export const GRIEF_FRIEND_STRESS = 20;

/** Intensity of a "grief_friend" memory (positive = stress) */
export const MEMORY_GRIEF_FRIEND_INTENSITY = 25;

/** How many in-game years grief from losing a friend lingers */
export const MEMORY_GRIEF_FRIEND_DURATION_YEARS = 5;

/** Probability that two friends get married each year (requires MARRIAGE_FRIEND_MIN_YEARS as friends) */
export const MARRIAGE_CHANCE = 0.05;

/** Minimum years as friends before a marriage can occur */
export const MARRIAGE_FRIEND_MIN_YEARS = 3;

/** Positive stress intensity of the "married" joy memory (negative = stress relief) */
export const MEMORY_MARRIAGE_JOY_INTENSITY = -20;

/** How many in-game years the marriage joy memory lasts */
export const MEMORY_MARRIAGE_JOY_DURATION_YEARS = 5;

/** Extra stress spike when a spouse dies (immediate, higher than friend grief) */
export const GRIEF_SPOUSE_STRESS = 35;

/** Intensity of a "grief_spouse" memory (positive = stress gain) */
export const MEMORY_SPOUSE_GRIEF_INTENSITY = 40;

/** How many in-game years grief from losing a spouse lingers */
export const MEMORY_SPOUSE_GRIEF_DURATION_YEARS = 10;


// ============================================================
// Fortress name generation
// ============================================================

export const FORTRESS_NAME_MATERIALS = [
  'Iron', 'Steel', 'Copper', 'Gold', 'Silver', 'Stone', 'Granite',
  'Obsidian', 'Marble', 'Bronze', 'Cobalt', 'Adamantine', 'Ash',
  'Bone', 'Crystal', 'Diamond', 'Emerald', 'Flint', 'Onyx',
];

export const FORTRESS_NAME_NOUNS = [
  'hold', 'forge', 'gate', 'vault', 'hall', 'peak', 'keep',
  'ridge', 'crag', 'spire', 'bridge', 'mine', 'deep', 'bastion',
  'anvil', 'crown', 'tower', 'wall', 'barrow', 'haven',
];

/** How many years between trade caravan arrivals */
export const CARAVAN_INTERVAL_YEARS = 5;

/** Number of drink items a caravan brings */
export const CARAVAN_DRINK_COUNT = 15;

/** Number of food items a caravan brings */
export const CARAVAN_FOOD_COUNT = 10;
