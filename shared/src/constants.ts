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

export const FOOD_DECAY_PER_TICK = 0.15;
export const DRINK_DECAY_PER_TICK = 0.2;
export const SLEEP_DECAY_PER_TICK = 0.12;
export const SOCIAL_DECAY_PER_TICK = 0.05;
export const PURPOSE_DECAY_PER_TICK = 0.04;
export const BEAUTY_DECAY_PER_TICK = 0.03;

// ============================================================
// Stress severity tiers
// ============================================================

export const STRESS_TANTRUM_MILD = 80;
export const STRESS_TANTRUM_MODERATE = 90;
export const STRESS_TANTRUM_SEVERE = 96;

// ============================================================
// Skills
// ============================================================

/** Maximum achievable skill level for any dwarf skill */
export const MAX_SKILL_LEVEL = 20;
