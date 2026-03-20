/** Maps a skill level (0–20) to a 0–5 star count. */
export function levelToStars(level: number): number {
  if (level === 0) return 0;
  if (level >= 16) return 5;
  if (level >= 13) return 4;
  if (level >= 9) return 3;
  if (level >= 5) return 2;
  return 1;
}

export function skillStars(level: number): string {
  const stars = levelToStars(level);
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}
