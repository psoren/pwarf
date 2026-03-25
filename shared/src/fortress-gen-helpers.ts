import { createNoise2D, type NoiseFunction2D } from "simplex-noise";
import { createAleaRng, fbm } from "./world-gen-helpers.js";
import type { FortressTileType, TerrainType } from "./db-types.js";
import {
  CAVE_SIZE,
  CAVE_OFFSET,
  CAVE_NAME_ADJECTIVES,
  CAVE_NAME_NOUNS,
  CAVE_NAME_MATERIALS,
} from "./constants.js";

// ============================================================
// Constants
// ============================================================

export const FORTRESS_SIZE = 512;
export const SURFACE_Z = 0;

/** @deprecated Use per-entrance z-levels instead. Kept for backwards compat. */
export const CAVE_Z = -1;

// ============================================================
// Derived tile interface
// ============================================================

export interface DerivedFortressTile {
  tileType: FortressTileType;
  material: string | null;
}

export interface CaveEntrance {
  x: number;
  y: number;
  z: number;
}

export interface FortressDeriver {
  deriveTile(x: number, y: number, z: number): DerivedFortressTile;
  baseTileType: FortressTileType;
  entrances: readonly CaveEntrance[];
  getZForEntrance(x: number, y: number): number | null;
  getEntranceForZ(z: number): CaveEntrance | null;
  getCaveName(z: number): string | null;
}

// ============================================================
// Cave generation (cellular automata)
// ============================================================

const CA_INITIAL_OPEN = 0.45;
const CA_SMOOTHING_ITERATIONS = 5;
const CA_SOLID_NEIGHBOR_THRESHOLD = 5;
const MIN_REGION_SIZE = 50;

function buildCaveGrid(
  noise: NoiseFunction2D,
  z: number,
  frequency: number,
  size: number = FORTRESS_SIZE,
): boolean[] {
  let grid = new Array<boolean>(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const val = (noise(x * frequency + z * 100, y * frequency + z * 100) + 1) / 2;
      grid[y * size + x] = val < CA_INITIAL_OPEN;
    }
  }

  for (let iter = 0; iter < CA_SMOOTHING_ITERATIONS; iter++) {
    const next = new Array<boolean>(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let solidCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= size || ny < 0 || ny >= size) {
              solidCount++;
            } else if (!grid[ny * size + nx]) {
              solidCount++;
            }
          }
        }
        next[y * size + x] = solidCount < CA_SOLID_NEIGHBOR_THRESHOLD;
      }
    }
    grid = next;
  }

  const minRegion = size < FORTRESS_SIZE ? 20 : MIN_REGION_SIZE;
  const labels = new Int32Array(size * size);
  let regionId = 0;
  const regionSizes = new Map<number, number>();

  for (let i = 0; i < grid.length; i++) {
    if (!grid[i] || labels[i] !== 0) continue;
    regionId++;
    let count = 0;
    const stack = [i];
    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (labels[idx] !== 0) continue;
      if (!grid[idx]) continue;
      labels[idx] = regionId;
      count++;
      const ix = idx % size;
      const iy = (idx - ix) / size;
      if (ix > 0) stack.push(idx - 1);
      if (ix < size - 1) stack.push(idx + 1);
      if (iy > 0) stack.push(idx - size);
      if (iy < size - 1) stack.push(idx + size);
    }
    regionSizes.set(regionId, count);
  }

  for (let i = 0; i < grid.length; i++) {
    if (grid[i] && (regionSizes.get(labels[i]) ?? 0) < minRegion) {
      grid[i] = false;
    }
  }

  const surviving = new Set<number>();
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] && labels[i] !== 0) surviving.add(labels[i]);
  }

  if (surviving.size > 1) {
    const reps = new Map<number, number>();
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] && surviving.has(labels[i]) && !reps.has(labels[i])) {
        reps.set(labels[i], i);
      }
    }

    const regionList = [...reps.entries()];
    for (let r = 1; r < regionList.length; r++) {
      const fromIdx = regionList[r - 1][1];
      const toIdx = regionList[r][1];
      const fx = fromIdx % size;
      const fy = (fromIdx - fx) / size;
      const tx = toIdx % size;
      const ty = (toIdx - tx) / size;

      const xStep = tx > fx ? 1 : -1;
      for (let x = fx; x !== tx; x += xStep) {
        grid[fy * size + x] = true;
      }
      const yStep = ty > fy ? 1 : -1;
      for (let y = fy; y !== ty; y += yStep) {
        grid[y * size + tx] = true;
      }
      grid[ty * size + tx] = true;
    }
  }

  return grid;
}

// ============================================================
// Per-entrance cave generation
// ============================================================

function caveSeed(baseSeed: bigint, entranceX: number, entranceY: number): bigint {
  return baseSeed ^ BigInt(entranceX * 7919 + entranceY * 6271);
}

function buildCaveForEntrance(
  baseSeed: bigint,
  entranceX: number,
  entranceY: number,
): { grid: boolean[]; materialNoises: NoiseFunction2D[]; floorNoise: NoiseFunction2D } {
  const seed = caveSeed(baseSeed, entranceX, entranceY);
  const rng = createAleaRng(seed);
  const noise = createNoise2D(rng);
  const grid = buildCaveGrid(noise, -1, 0.03, CAVE_SIZE);

  // Ensure the entrance tile (center of cave) is always open
  const center = Math.floor(CAVE_SIZE / 2);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = center + dx;
      const ny = center + dy;
      if (nx >= 0 && nx < CAVE_SIZE && ny >= 0 && ny < CAVE_SIZE) {
        grid[ny * CAVE_SIZE + nx] = true;
      }
    }
  }

  const materialNoises: NoiseFunction2D[] = CAVE_MATERIALS.map(() => createNoise2D(rng));
  const floorNoise = createNoise2D(rng);
  return { grid, materialNoises, floorNoise };
}

// ============================================================
// Seed combination
// ============================================================

function combineSeed(worldSeed: bigint, civId: string): bigint {
  let hash = 0n;
  for (let i = 0; i < civId.length; i++) {
    hash = ((hash << 5n) - hash + BigInt(civId.charCodeAt(i))) & 0xFFFFFFFFFFFFFFFFn;
  }
  return worldSeed ^ hash;
}

// ============================================================
// Cave entrance placement
// ============================================================

function pickCaveEntrances(
  entranceNoise: NoiseFunction2D,
): Array<{ x: number; y: number }> {
  const candidates: Array<{ x: number; y: number; val: number }> = [];
  const step = 32;

  for (let sy = step; sy < FORTRESS_SIZE - step; sy += step) {
    for (let sx = step; sx < FORTRESS_SIZE - step; sx += step) {
      const val = (entranceNoise(sx * 0.01, sy * 0.01) + 1) / 2;
      if (val > 0.7) {
        candidates.push({ x: sx, y: sy, val });
      }
    }
  }

  candidates.sort((a, b) => b.val - a.val);

  const positions: Array<{ x: number; y: number }> = [];
  const minDist = 80;

  for (const c of candidates) {
    if (positions.length >= 5) break;
    const tooClose = positions.some(
      (p) => Math.abs(p.x - c.x) + Math.abs(p.y - c.y) < minDist,
    );
    if (tooClose) continue;
    positions.push({ x: c.x, y: c.y });
  }

  positions.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
  return positions;
}

// ============================================================
// Cave name generation
// ============================================================

export function generateCaveName(seed: bigint): string {
  const n = Number(seed & 0xFFFFFFFFn);
  const adj = CAVE_NAME_ADJECTIVES[n % CAVE_NAME_ADJECTIVES.length];
  const noun = CAVE_NAME_NOUNS[Math.floor(n / 13) % CAVE_NAME_NOUNS.length];
  const mat = CAVE_NAME_MATERIALS[Math.floor(n / 157) % CAVE_NAME_MATERIALS.length];
  return `The ${adj} ${noun} of ${mat}`;
}

export function getCaveSeed(worldSeed: bigint, civId: string, entranceX: number, entranceY: number): bigint {
  return caveSeed(combineSeed(worldSeed, civId), entranceX, entranceY);
}

// ============================================================
// Ore / gem material definitions
// ============================================================

interface MaterialDef {
  name: string;
  kind: "ore" | "gem" | "crystal";
  threshold: number;
  priority: number;
}

const CAVE_MATERIALS: MaterialDef[] = [
  { name: "iron",     kind: "ore",     threshold: 0.94, priority: 1 },
  { name: "copper",   kind: "ore",     threshold: 0.94, priority: 2 },
  { name: "tin",      kind: "ore",     threshold: 0.95, priority: 3 },
  { name: "gold",     kind: "ore",     threshold: 0.97, priority: 5 },
  { name: "silver",   kind: "ore",     threshold: 0.96, priority: 4 },
  { name: "ruby",     kind: "gem",     threshold: 0.97, priority: 7 },
  { name: "sapphire", kind: "gem",     threshold: 0.97, priority: 8 },
  { name: "crystal",  kind: "crystal", threshold: 0.96, priority: 6 },
];

function checkCaveMaterial(
  x: number,
  y: number,
  materialNoises: NoiseFunction2D[],
): DerivedFortressTile | null {
  let bestMatch: MaterialDef | null = null;

  for (let i = 0; i < CAVE_MATERIALS.length; i++) {
    const mat = CAVE_MATERIALS[i];
    const noise = materialNoises[i];
    const val = (noise(x * 0.05, y * 0.05) + 1) / 2;

    if (val > mat.threshold) {
      if (!bestMatch || mat.priority > bestMatch.priority) {
        bestMatch = mat;
      }
    }
  }

  if (bestMatch) {
    const tileType = bestMatch.kind === "gem" ? "gem"
      : bestMatch.kind === "crystal" ? "crystal"
      : "ore";
    return { tileType, material: bestMatch.name };
  }
  return null;
}

// ============================================================
// Surface feature generation (z=0)
// ============================================================

interface SurfaceProfile {
  base: FortressTileType;
  baseMaterial: string | null;
  treeRegion: number;
  treeDetail: number;
  bushRegionMin: number;
  bushRegionMax: number;
  bushDetail: number;
  rockThreshold: number;
  pondRegion: number;
  pondDetail: number;
  pondTile: FortressTileType;
}

const DEFAULT_PROFILE: SurfaceProfile = {
  base: "grass", baseMaterial: null,
  treeRegion: 0.45, treeDetail: 0.55,
  bushRegionMin: 0.35, bushRegionMax: 0.55, bushDetail: 0.7,
  rockThreshold: 0.88,
  pondRegion: 0.65, pondDetail: 0.75,
  pondTile: "pond",
};

const SURFACE_PROFILES: Partial<Record<TerrainType, Partial<SurfaceProfile>>> = {
  mountain: {
    base: "stone", baseMaterial: null,
    treeRegion: 0.75, treeDetail: 0.7,
    bushRegionMin: 0.65, bushRegionMax: 0.8, bushDetail: 0.8,
    rockThreshold: 0.6,
    pondRegion: 0.85, pondDetail: 0.85,
  },
  forest: {
    treeRegion: 0.25, treeDetail: 0.4,
    bushRegionMin: 0.15, bushRegionMax: 0.35, bushDetail: 0.55,
    rockThreshold: 0.93,
    pondRegion: 0.6, pondDetail: 0.7,
  },
  plains: {
    treeRegion: 0.7, treeDetail: 0.65,
    bushRegionMin: 0.6, bushRegionMax: 0.75, bushDetail: 0.75,
    rockThreshold: 0.92,
    pondRegion: 0.65, pondDetail: 0.75,
  },
  desert: {
    base: "sand", baseMaterial: null,
    treeRegion: 2, treeDetail: 2,
    bushRegionMin: 2, bushRegionMax: 2, bushDetail: 2,
    rockThreshold: 0.85,
    pondRegion: 2, pondDetail: 2,
  },
  tundra: {
    base: "grass", baseMaterial: null,
    treeRegion: 0.85, treeDetail: 0.8,
    bushRegionMin: 0.8, bushRegionMax: 0.9, bushDetail: 0.85,
    rockThreshold: 0.82,
    pondRegion: 0.55, pondDetail: 0.65,
    pondTile: "ice",
  },
  swamp: {
    base: "mud", baseMaterial: null,
    treeRegion: 0.55, treeDetail: 0.6,
    bushRegionMin: 0.4, bushRegionMax: 0.6, bushDetail: 0.6,
    rockThreshold: 0.95,
    pondRegion: 0.35, pondDetail: 0.5,
  },
  volcano: {
    base: "lava_stone", baseMaterial: null,
    treeRegion: 2, treeDetail: 2,
    bushRegionMin: 2, bushRegionMax: 2, bushDetail: 2,
    rockThreshold: 0.65,
    pondRegion: 0.55, pondDetail: 0.6,
    pondTile: "magma",
  },
};

function getProfile(terrain: TerrainType): SurfaceProfile {
  const overrides = SURFACE_PROFILES[terrain];
  if (!overrides) return DEFAULT_PROFILE;
  return { ...DEFAULT_PROFILE, ...overrides };
}

export function deriveSurfaceTile(
  x: number, y: number,
  treeNoise: NoiseFunction2D,
  rockNoise: NoiseFunction2D,
  pondNoise: NoiseFunction2D,
  terrain: TerrainType = "plains",
): DerivedFortressTile {
  const p = getProfile(terrain);

  const pondVal = (pondNoise(x * 0.04, y * 0.04) + 1) / 2;
  const pondRegion = (pondNoise(x * 0.008 + 300, y * 0.008 + 300) + 1) / 2;
  if (pondRegion > p.pondRegion && pondVal > p.pondDetail) {
    return { tileType: p.pondTile, material: null };
  }

  const treeRegion = (treeNoise(x * 0.006, y * 0.006) + 1) / 2;
  const treeDetail = (treeNoise(x * 0.08 + 500, y * 0.08 + 500) + 1) / 2;
  if (treeRegion > p.treeRegion && treeDetail > p.treeDetail) {
    return { tileType: "tree", material: "wood" };
  }

  if (treeRegion > p.bushRegionMin && treeRegion < p.bushRegionMax && treeDetail > p.bushDetail) {
    return { tileType: "bush", material: null };
  }

  // Flowers — appear in grass regions with a different noise detail threshold
  if (treeRegion < p.bushRegionMin && treeDetail > 0.85) {
    return { tileType: "flower", material: null };
  }

  const rockVal = (rockNoise(x * 0.05, y * 0.05) + 1) / 2;
  if (rockVal > p.rockThreshold) {
    return { tileType: "rock", material: "stone" };
  }

  // Spring — very rare natural water source
  if (pondRegion > p.pondRegion + 0.1 && pondVal > p.pondDetail + 0.15) {
    return { tileType: "spring", material: null };
  }

  return { tileType: p.base, material: p.baseMaterial };
}

// ============================================================
// Main deriver factory
// ============================================================

export function createFortressDeriver(
  worldSeed: bigint,
  civId: string,
  terrain: TerrainType = "plains",
): FortressDeriver {
  const seed = combineSeed(worldSeed, civId);
  const rng = createAleaRng(seed);

  // Consume noise in same order as before to keep RNG sequence stable
  const _caveNoise = createNoise2D(rng);
  const entranceNoise = createNoise2D(rng);
  const surfaceTreeNoise = createNoise2D(rng);
  const surfaceRockNoise = createNoise2D(rng);
  const surfacePondNoise = createNoise2D(rng);
  CAVE_MATERIALS.forEach(() => createNoise2D(rng));

  const entrancePositions = pickCaveEntrances(entranceNoise);

  const entrances: CaveEntrance[] = entrancePositions.map((p, i) => ({
    x: p.x, y: p.y, z: -(i + 1),
  }));
  const entranceByPos = new Map<string, CaveEntrance>(
    entrances.map(e => [`${e.x},${e.y}`, e]),
  );
  const entranceByZ = new Map<number, CaveEntrance>(
    entrances.map(e => [e.z, e]),
  );

  const caveCache = new Map<number, { grid: boolean[]; materialNoises: NoiseFunction2D[]; floorNoise: NoiseFunction2D }>();

  function getCaveData(z: number) {
    const entrance = entranceByZ.get(z);
    if (!entrance) return null;
    let data = caveCache.get(z);
    if (!data) {
      data = buildCaveForEntrance(seed, entrance.x, entrance.y);
      caveCache.set(z, data);
    }
    return data;
  }

  const profile = getProfile(terrain);

  return {
    baseTileType: profile.base,
    entrances,

    getZForEntrance(x: number, y: number): number | null {
      return entranceByPos.get(`${x},${y}`)?.z ?? null;
    },

    getEntranceForZ(z: number): CaveEntrance | null {
      return entranceByZ.get(z) ?? null;
    },

    getCaveName(z: number): string | null {
      const entrance = entranceByZ.get(z);
      if (!entrance) return null;
      return generateCaveName(caveSeed(seed, entrance.x, entrance.y));
    },

    deriveTile(x: number, y: number, z: number): DerivedFortressTile {
      if (z === SURFACE_Z) {
        if (entranceByPos.has(`${x},${y}`)) {
          return { tileType: "cave_entrance", material: null };
        }

        const center = Math.floor(FORTRESS_SIZE / 2);
        const nearCenter = Math.abs(x - center) <= 3 && Math.abs(y - center) <= 3;
        if (nearCenter) {
          return { tileType: profile.base, material: profile.baseMaterial };
        }

        return deriveSurfaceTile(x, y, surfaceTreeNoise, surfaceRockNoise, surfacePondNoise, terrain);
      }

      if (z < 0) {
        const cave = getCaveData(z);
        if (!cave) return { tileType: "empty", material: null };

        const cx = x - CAVE_OFFSET;
        const cy = y - CAVE_OFFSET;
        if (cx < 0 || cx >= CAVE_SIZE || cy < 0 || cy >= CAVE_SIZE) {
          return { tileType: "cavern_wall", material: null };
        }

        if (cave.grid[cy * CAVE_SIZE + cx]) {
          // Floor variants: glowing_moss (~10%) and fungal_growth (~5%)
          const floorVal = (cave.floorNoise(cx * 0.07, cy * 0.07) + 1) / 2;
          if (floorVal > 0.90) {
            return { tileType: "glowing_moss", material: null };
          }
          if (floorVal > 0.85) {
            return { tileType: "fungal_growth", material: null };
          }
          return { tileType: "cavern_floor", material: null };
        }

        const mat = checkCaveMaterial(cx, cy, cave.materialNoises);
        if (mat) return mat;

        return { tileType: "cavern_wall", material: null };
      }

      return { tileType: "empty", material: null };
    },
  };
}
