const MAX_STARS = 5;
const LEVELS_PER_STAR = 4;

/**
 * Converts a skill level (0–20) to a star string like "★★★☆☆".
 * Each 4 levels = 1 star; level 0 = all empty.
 */
export function skillStars(level: number): string {
  const filled = Math.min(MAX_STARS, Math.ceil(level / LEVELS_PER_STAR));
  return "★".repeat(filled) + "☆".repeat(MAX_STARS - filled);
}
