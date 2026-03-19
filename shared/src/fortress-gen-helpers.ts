import { createNoise2D, type NoiseFunction2D } from "simplex-noise";
import { createAleaRng, fbm } from "./world-gen-helpers.js";
import type { FortressTileType, TerrainType } from "./db-types.js";

// ============================================================
// Constants
// ============================================================

export const FORTRESS_SIZE = 512;

/** Surface level — the only level generated at embark. */
export const SURFACE_Z = 0;

/** First cave level — generated when a cave entrance exists. */
export const CAVE_Z = -1;

// ============================================================
// Derived tile interface
// ============================================================

export interface DerivedFortressTile {
  tileType: FortressTileType;
  material: string | null;
}

export interface FortressDeriver {
  deriveTile(x: number, y: number, z: number): DerivedFortressTile;
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
): boolean[] {
  const size = FORTRESS_SIZE;
  // Initialize from noise
  let grid = new Array<boolean>(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const val = (noise(x * frequency + z * 100, y * frequency + z * 100) + 1) / 2;
      grid[y * size + x] = val < CA_INITIAL_OPEN; // true = open
    }
  }

  // Smoothing iterations
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
              solidCount++; // edges count as solid
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

  // Flood-fill to find connected regions, discard small ones
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

  // Remove small regions
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] && (regionSizes.get(labels[i]) ?? 0) < MIN_REGION_SIZE) {
      grid[i] = false;
    }
  }

  // Connect disjoint regions with corridors
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

/**
 * Pick cave entrance positions on the surface. Uses noise to place
 * entrances at natural-looking locations, biased toward rocky/hilly areas.
 * Returns positions where cave_entrance tiles should appear at z=0,
 * each connecting to an open cavern_floor tile at z=-1.
 */
function pickCaveEntrances(
  entranceNoise: NoiseFunction2D,
  caveGrid: boolean[],
): Array<{ x: number; y: number }> {
  const candidates: Array<{ x: number; y: number; val: number }> = [];
  const step = 32; // Sample grid at regular intervals

  for (let sy = step; sy < FORTRESS_SIZE - step; sy += step) {
    for (let sx = step; sx < FORTRESS_SIZE - step; sx += step) {
      // Only place an entrance if the cave below is open
      if (!caveGrid[sy * FORTRESS_SIZE + sx]) continue;

      const val = (entranceNoise(sx * 0.01, sy * 0.01) + 1) / 2;
      if (val > 0.7) {
        candidates.push({ x: sx, y: sy, val });
      }
    }
  }

  candidates.sort((a, b) => b.val - a.val);

  // Pick up to 5 entrances, spaced apart
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

  return positions;
}

// ============================================================
// Ore / gem material definitions
// ============================================================

interface MaterialDef {
  name: string;
  kind: "ore" | "gem";
  threshold: number;
  priority: number; // higher = rarer = wins ties
}

/** Materials found in cave walls at z=-1. */
const CAVE_MATERIALS: MaterialDef[] = [
  { name: "iron",   kind: "ore", threshold: 0.94, priority: 1 },
  { name: "copper", kind: "ore", threshold: 0.94, priority: 2 },
  { name: "tin",    kind: "ore", threshold: 0.95, priority: 3 },
  { name: "gold",   kind: "ore", threshold: 0.97, priority: 5 },
  { name: "silver", kind: "ore", threshold: 0.96, priority: 4 },
  { name: "ruby",   kind: "gem", threshold: 0.97, priority: 7 },
  { name: "sapphire", kind: "gem", threshold: 0.97, priority: 8 },
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
    return {
      tileType: bestMatch.kind === "gem" ? "gem" : "ore",
      material: bestMatch.name,
    };
  }
  return null;
}

// ============================================================
// Surface feature generation (z=0)
// ============================================================

/** Per-biome thresholds controlling surface tile distribution. */
interface SurfaceProfile {
  /** Base tile when nothing else matches */
  base: FortressTileType;
  baseMaterial: string | null;
  /** Tree region threshold (lower = more trees). Set > 1 to disable. */
  treeRegion: number;
  treeDetail: number;
  /** Bush region range + detail threshold */
  bushRegionMin: number;
  bushRegionMax: number;
  bushDetail: number;
  /** Rock threshold (lower = more rocks) */
  rockThreshold: number;
  /** Pond region + detail thresholds. Set > 1 to disable. */
  pondRegion: number;
  pondDetail: number;
  /** Optional water tile type override (e.g. ice for tundra) */
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
  x: number,
  y: number,
  treeNoise: NoiseFunction2D,
  rockNoise: NoiseFunction2D,
  pondNoise: NoiseFunction2D,
  terrain: TerrainType = "plains",
): DerivedFortressTile {
  const p = getProfile(terrain);

  // Ponds / water features
  const pondVal = (pondNoise(x * 0.04, y * 0.04) + 1) / 2;
  const pondRegion = (pondNoise(x * 0.008 + 300, y * 0.008 + 300) + 1) / 2;
  if (pondRegion > p.pondRegion && pondVal > p.pondDetail) {
    return { tileType: p.pondTile, material: null };
  }

  // Trees
  const treeRegion = (treeNoise(x * 0.006, y * 0.006) + 1) / 2;
  const treeDetail = (treeNoise(x * 0.08 + 500, y * 0.08 + 500) + 1) / 2;
  if (treeRegion > p.treeRegion && treeDetail > p.treeDetail) {
    return { tileType: "tree", material: "wood" };
  }

  // Bushes
  if (treeRegion > p.bushRegionMin && treeRegion < p.bushRegionMax && treeDetail > p.bushDetail) {
    return { tileType: "bush", material: null };
  }

  // Rocks
  const rockVal = (rockNoise(x * 0.05, y * 0.05) + 1) / 2;
  if (rockVal > p.rockThreshold) {
    return { tileType: "rock", material: "stone" };
  }

  // Base tile (grass, sand, mud, stone, lava_stone depending on biome)
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

  // Noise fields
  const caveNoise = createNoise2D(rng);
  const entranceNoise = createNoise2D(rng);
  const surfaceTreeNoise = createNoise2D(rng);
  const surfaceRockNoise = createNoise2D(rng);
  const surfacePondNoise = createNoise2D(rng);

  // Per-material noise for cave walls
  const materialNoises: NoiseFunction2D[] = CAVE_MATERIALS.map(() => createNoise2D(rng));

  // Pre-compute cave grid for z=-1
  const caveGrid = buildCaveGrid(caveNoise, CAVE_Z, 0.03);

  // Pre-compute cave entrance positions
  const entrancePositions = pickCaveEntrances(entranceNoise, caveGrid);
  const entranceSet = new Set<string>(
    entrancePositions.map(p => `${p.x},${p.y}`),
  );

  return {
    deriveTile(x: number, y: number, z: number): DerivedFortressTile {
      // Only z=0 (surface) and z=-1 (caves) are valid
      if (z !== SURFACE_Z && z !== CAVE_Z) {
        return { tileType: "empty", material: null };
      }

      // z=0: Surface with cave entrances
      if (z === SURFACE_Z) {
        // Check for cave entrance
        if (entranceSet.has(`${x},${y}`)) {
          return { tileType: "cave_entrance", material: null };
        }

        return deriveSurfaceTile(x, y, surfaceTreeNoise, surfaceRockNoise, surfacePondNoise, terrain);
      }

      // z=-1: Cave level
      const inBounds = x >= 0 && x < FORTRESS_SIZE && y >= 0 && y < FORTRESS_SIZE;
      const isOpen = inBounds && caveGrid[y * FORTRESS_SIZE + x];

      if (isOpen) {
        return { tileType: "cavern_floor", material: null };
      }

      // Cave wall — check for ore/gem veins
      const mat = checkCaveMaterial(x, y, materialNoises);
      if (mat) return mat;

      return { tileType: "cavern_wall", material: null };
    },
  };
}
