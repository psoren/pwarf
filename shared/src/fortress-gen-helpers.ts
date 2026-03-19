import { createNoise2D, type NoiseFunction2D } from "simplex-noise";
import { createAleaRng, fbm } from "./world-gen-helpers.js";
import type { FortressTileType, TerrainType } from "./db-types.js";

// ============================================================
// Constants
// ============================================================

export const FORTRESS_SIZE = 512;
export const FORTRESS_MIN_Z = -19;
export const FORTRESS_MAX_Z = 0;

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
// Ore / gem material definitions
// ============================================================

interface MaterialDef {
  name: string;
  kind: "ore" | "gem";
  minZ: number;
  maxZ: number;
  threshold: number;
  priority: number; // higher = rarer = wins ties
}

const MATERIALS: MaterialDef[] = [
  { name: "iron",       kind: "ore", minZ: -12, maxZ: -5,  threshold: 0.94, priority: 1 },
  { name: "copper",     kind: "ore", minZ: -12, maxZ: -5,  threshold: 0.94, priority: 2 },
  { name: "tin",        kind: "ore", minZ: -14, maxZ: -5,  threshold: 0.95, priority: 3 },
  { name: "gold",       kind: "ore", minZ: -15, maxZ: -8,  threshold: 0.97, priority: 5 },
  { name: "silver",     kind: "ore", minZ: -17, maxZ: -10, threshold: 0.96, priority: 4 },
  { name: "platinum",   kind: "ore", minZ: -18, maxZ: -12, threshold: 0.98, priority: 6 },
  { name: "ruby",       kind: "gem", minZ: -17, maxZ: -10, threshold: 0.97, priority: 7 },
  { name: "sapphire",   kind: "gem", minZ: -17, maxZ: -10, threshold: 0.97, priority: 8 },
  { name: "emerald",    kind: "gem", minZ: -18, maxZ: -12, threshold: 0.98, priority: 9 },
  { name: "diamond",    kind: "gem", minZ: -19, maxZ: -14, threshold: 0.99, priority: 10 },
  { name: "adamantine", kind: "ore", minZ: -19, maxZ: -19, threshold: 0.995, priority: 11 },
];

// ============================================================
// Cavern cellular automata
// ============================================================

const CAVERN_SIZE = FORTRESS_SIZE;
const CAVERN_MIN_Z = -18;
const CAVERN_MAX_Z = -15;
const CA_INITIAL_OPEN = 0.45;
const CA_SMOOTHING_ITERATIONS = 5;
const CA_SOLID_NEIGHBOR_THRESHOLD = 5;
const MIN_REGION_SIZE = 50;

function buildCavernGrid(
  noise: NoiseFunction2D,
  z: number,
  frequency: number,
): boolean[] {
  const size = CAVERN_SIZE;
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
    // Find representative point for each region
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

      // Carve straight-line corridor (horizontal then vertical)
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
// Stair position generation
// ============================================================

function pickStairColumns(
  stairNoise: NoiseFunction2D,
): Array<{ x: number; y: number }> {
  // Pick 3 global stair columns that span all z-levels
  const candidates: Array<{ x: number; y: number; val: number }> = [];
  const step = 64;

  for (let sy = step; sy < FORTRESS_SIZE - step; sy += step) {
    for (let sx = step; sx < FORTRESS_SIZE - step; sx += step) {
      const val = (stairNoise(sx * 0.01, sy * 0.01) + 1) / 2;
      candidates.push({ x: sx, y: sy, val });
    }
  }

  candidates.sort((a, b) => b.val - a.val);

  const positions: Array<{ x: number; y: number }> = [];
  const minDist = 100;

  for (const c of candidates) {
    if (positions.length >= 3) break;
    const tooClose = positions.some(
      (p) => Math.abs(p.x - c.x) + Math.abs(p.y - c.y) < minDist,
    );
    if (tooClose) continue;
    positions.push({ x: c.x, y: c.y });
  }

  return positions;
}

function isWaterTile(
  x: number,
  y: number,
  z: number,
  aquiferNoise: NoiseFunction2D,
): boolean {
  if (z < -3 || z > -1) return false;
  const region = (aquiferNoise(x * 0.008, y * 0.008) + 1) / 2;
  if (region < 0.6) return false;
  const density = (aquiferNoise(x * 0.05 + 500, y * 0.05 + 500) + 1) / 2;
  return density > 0.7;
}

function isMagmaTile(
  x: number,
  y: number,
  z: number,
  magmaIslandNoise: NoiseFunction2D,
): boolean {
  if (z !== -19) return false;
  const val = (magmaIslandNoise(x * 0.01, y * 0.01) + 1) / 2;
  return val < 0.8; // 80% magma, 20% islands
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
  const cavernNoise = createNoise2D(rng);
  const aquiferNoise = createNoise2D(rng);
  const magmaIslandNoise = createNoise2D(rng);
  const magmaPipeNoise = createNoise2D(rng);
  const stairNoise = createNoise2D(rng);
  const surfaceTreeNoise = createNoise2D(rng);
  const surfaceRockNoise = createNoise2D(rng);
  const surfacePondNoise = createNoise2D(rng);

  // Per-material noise
  const materialNoises: NoiseFunction2D[] = MATERIALS.map(() => createNoise2D(rng));

  // Pre-compute cavern grids
  const cavernGrids = new Map<number, boolean[]>();
  for (let z = CAVERN_MIN_Z; z <= CAVERN_MAX_Z; z++) {
    cavernGrids.set(z, buildCavernGrid(cavernNoise, z, 0.03));
  }

  // Pre-compute stair columns (global positions that span all z-levels)
  const stairColumns = pickStairColumns(stairNoise);
  const stairSet = new Set<string>();

  // Every stair column gets a stair at every z-level
  for (const col of stairColumns) {
    for (let z = FORTRESS_MAX_Z; z >= FORTRESS_MIN_Z; z--) {
      const key = `${col.x},${col.y},${z}`;
      if (z === FORTRESS_MAX_Z) {
        stairSet.add(key + ",stair_down");
      } else if (z === FORTRESS_MIN_Z) {
        stairSet.add(key + ",stair_up");
      } else {
        stairSet.add(key + ",stair_both");
      }
    }
  }

  // Build lookup: "x,y,z" -> FortressTileType
  const stairTypes = new Map<string, FortressTileType>();
  for (const entry of stairSet) {
    const parts = entry.split(",");
    const stType = parts[3] as FortressTileType;
    const posKey = `${parts[0]},${parts[1]},${parts[2]}`;
    stairTypes.set(posKey, stType);
  }

  return {
    deriveTile(x: number, y: number, z: number): DerivedFortressTile {
      // Clamp z
      if (z > FORTRESS_MAX_Z || z < FORTRESS_MIN_Z) {
        return { tileType: "empty", material: null };
      }

      // Check for stairs first
      const stairKey = `${x},${y},${z}`;
      const stairType = stairTypes.get(stairKey);
      if (stairType) {
        return { tileType: stairType, material: null };
      }

      // z=0: Surface with features varying by biome
      if (z === 0) {
        // Clear surface features near stair columns and fortress center so
        // dwarves aren't trapped by trees on spawn or unable to reach stairs
        const center = Math.floor(FORTRESS_SIZE / 2);
        const nearCenter = Math.abs(x - center) <= 3 && Math.abs(y - center) <= 3;
        if (nearCenter || isAdjacentToStair(x, y, stairTypes)) {
          const p = getProfile(terrain);
          return { tileType: p.base, material: p.baseMaterial };
        }
        return deriveSurfaceTile(x, y, surfaceTreeNoise, surfaceRockNoise, surfacePondNoise, terrain);
      }

      // z=-19: Magma sea
      if (z === -19) {
        // Check for magma pipes extending upward
        const pipeVal = (magmaPipeNoise(x * 0.02, y * 0.02) + 1) / 2;
        const isIsland = (magmaIslandNoise(x * 0.01, y * 0.01) + 1) / 2 > 0.8;

        if (isIsland) {
          // Check for adamantine in lava_stone islands
          const mat = checkMaterial(x, y, z, materialNoises, 1.0);
          if (mat) return mat;
          return { tileType: "lava_stone", material: null };
        }

        // Check magma pipe spots at z=-19 — these define pipes
        if (pipeVal > 0.92) {
          return { tileType: "magma", material: null };
        }

        return { tileType: "magma", material: null };
      }

      // Magma pipes: z=-15 to -18, high pipe noise
      if (z >= -18 && z <= -15) {
        const pipeVal = (magmaPipeNoise(x * 0.02, y * 0.02) + 1) / 2;
        if (pipeVal > 0.92) {
          return { tileType: "magma", material: null };
        }
      }

      // z=-15 to -18: Cavern zone
      if (z >= CAVERN_MIN_Z && z <= CAVERN_MAX_Z) {
        const grid = cavernGrids.get(z)!;
        const inBounds = x >= 0 && x < CAVERN_SIZE && y >= 0 && y < CAVERN_SIZE;
        const isOpen = inBounds && grid[y * CAVERN_SIZE + x];

        if (isOpen) {
          return { tileType: "cavern_floor", material: null };
        }

        // Cavern wall — check for ore/gem with slightly boosted density
        const mat = checkMaterial(x, y, z, materialNoises, 1.03);
        if (mat) return mat;

        return { tileType: "cavern_wall", material: null };
      }

      // z=-1 to -3: Soil with aquifer
      if (z >= -3 && z <= -1) {
        if (isWaterTile(x, y, z, aquiferNoise)) {
          return { tileType: "water", material: null };
        }
        return { tileType: "soil", material: null };
      }

      // z=-4: Soil (no aquifer)
      if (z === -4) {
        return { tileType: "soil", material: null };
      }

      // z=-5 to -9: Stone with ore/gem veins
      // z=-10 to -14: Deep stone with denser ore/gem veins
      const densityMultiplier = z <= -10 ? 1.03 : 1.0;
      const mat = checkMaterial(x, y, z, materialNoises, densityMultiplier);
      if (mat) return mat;

      return { tileType: "stone", material: null };
    },
  };
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
    treeRegion: 0.75, treeDetail: 0.7,       // sparse trees
    bushRegionMin: 0.65, bushRegionMax: 0.8, bushDetail: 0.8,
    rockThreshold: 0.6,                       // lots of rocks
    pondRegion: 0.85, pondDetail: 0.85,       // rare ponds
  },
  forest: {
    treeRegion: 0.25, treeDetail: 0.4,        // dense trees
    bushRegionMin: 0.15, bushRegionMax: 0.35, bushDetail: 0.55,
    rockThreshold: 0.93,                       // few rocks
    pondRegion: 0.6, pondDetail: 0.7,          // some ponds
  },
  plains: {
    treeRegion: 0.7, treeDetail: 0.65,         // sparse trees
    bushRegionMin: 0.6, bushRegionMax: 0.75, bushDetail: 0.75,
    rockThreshold: 0.92,                       // few rocks
    pondRegion: 0.65, pondDetail: 0.75,
  },
  desert: {
    base: "sand", baseMaterial: null,
    treeRegion: 2, treeDetail: 2,              // no trees
    bushRegionMin: 2, bushRegionMax: 2, bushDetail: 2,
    rockThreshold: 0.85,                       // some rocks
    pondRegion: 2, pondDetail: 2,              // no water
  },
  tundra: {
    base: "grass", baseMaterial: null,
    treeRegion: 0.85, treeDetail: 0.8,         // very sparse trees
    bushRegionMin: 0.8, bushRegionMax: 0.9, bushDetail: 0.85,
    rockThreshold: 0.82,                       // scattered rocks
    pondRegion: 0.55, pondDetail: 0.65,        // ice patches
    pondTile: "ice",
  },
  swamp: {
    base: "mud", baseMaterial: null,
    treeRegion: 0.55, treeDetail: 0.6,         // moderate trees
    bushRegionMin: 0.4, bushRegionMax: 0.6, bushDetail: 0.6,
    rockThreshold: 0.95,                       // rare rocks
    pondRegion: 0.35, pondDetail: 0.5,         // lots of water
  },
  volcano: {
    base: "lava_stone", baseMaterial: null,
    treeRegion: 2, treeDetail: 2,              // no trees
    bushRegionMin: 2, bushRegionMax: 2, bushDetail: 2,
    rockThreshold: 0.65,                       // lots of rocks
    pondRegion: 0.55, pondDetail: 0.6,         // magma pools
    pondTile: "magma",
  },
};

function getProfile(terrain: TerrainType): SurfaceProfile {
  const overrides = SURFACE_PROFILES[terrain];
  if (!overrides) return DEFAULT_PROFILE;
  return { ...DEFAULT_PROFILE, ...overrides };
}

/** Check if a tile is cardinally adjacent to a stair column on the surface. */
function isAdjacentToStair(x: number, y: number, stairTypes: Map<string, FortressTileType>): boolean {
  return stairTypes.has(`${x + 1},${y},0`)
    || stairTypes.has(`${x - 1},${y},0`)
    || stairTypes.has(`${x},${y + 1},0`)
    || stairTypes.has(`${x},${y - 1},0`);
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

function checkMaterial(
  x: number,
  y: number,
  z: number,
  materialNoises: NoiseFunction2D[],
  densityMultiplier: number,
): DerivedFortressTile | null {
  let bestMatch: MaterialDef | null = null;

  for (let i = 0; i < MATERIALS.length; i++) {
    const mat = MATERIALS[i];
    if (z < mat.minZ || z > mat.maxZ) continue;

    const noise = materialNoises[i];
    const val = (noise(x * 0.05, y * 0.05) + 1) / 2;
    // Lower threshold = more generous with densityMultiplier
    const adjustedThreshold = mat.threshold / densityMultiplier;

    if (val > adjustedThreshold) {
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
