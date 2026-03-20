/**
 * Seeded pseudo-random number generator (mulberry32).
 *
 * All sim phases must use this instead of Math.random() or crypto.randomUUID()
 * so that runs with the same seed produce identical results.
 */
export interface Rng {
  /** Returns a float in [0, 1). */
  random(): number;
  /** Returns a random integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Returns a v4-like UUID using the seeded RNG. */
  uuid(): string;
}

/** Creates a seeded RNG using the mulberry32 algorithm. */
export function createRng(seed: number): Rng {
  let s = seed >>> 0;

  function random(): number {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  }

  function int(min: number, max: number): number {
    return Math.floor(random() * (max - min + 1)) + min;
  }

  function uuid(): string {
    // Generate a v4-like UUID using the seeded RNG
    const hex = (n: number) => n.toString(16).padStart(2, '0');
    const b = Array.from({ length: 16 }, () => Math.floor(random() * 256));
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant
    return [
      hex(b[0]) + hex(b[1]) + hex(b[2]) + hex(b[3]),
      hex(b[4]) + hex(b[5]),
      hex(b[6]) + hex(b[7]),
      hex(b[8]) + hex(b[9]),
      hex(b[10]) + hex(b[11]) + hex(b[12]) + hex(b[13]) + hex(b[14]) + hex(b[15]),
    ].join('-');
  }

  return { random, int, uuid };
}

/** Default seed used in tests for reproducible results. */
export const DEFAULT_TEST_SEED = 12345;
