# World Generation Design Doc

**Issue:** #27 — SPIKE: World generation research and design doc
**Status:** Decisions resolved — ready for Phase 1 implementation
**Blocks:** #28, #30, #32, #33, #34, #35, #36, #37, #38, #40

---

## Overview

World generation produces a 128×128×33 tile grid (`World3D`) from a single integer seed. The z-axis runs from **−16** (deepest underground) through **0** (surface) to **+16** (highest elevation). The pipeline runs in six sequential steps, each emitting progress events consumed by the loading-screen UI (#35). The entire pipeline must complete in < 3 seconds on a mid-range 2022 laptop.

The result is a fully populated `World3D` where every tile has a `TileType`, a `material` index, and optional `flags`. Seven dwarves are placed at a valid embark site on the surface.

---

## Seeded RNG

All generators use **mulberry32** — a fast, single-state, 32-bit PRNG with good statistical quality.

```ts
function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0
    let t = Math.imul(s ^ s >>> 15, 1 | s)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
```

**Guarantee:** Given the same seed the world generation pipeline produces byte-identical output across runs, browsers, and Node.js versions. No `Math.random()` is used anywhere in the pipeline.

Each generator derives its own sub-seed by mixing the master seed with a step-specific constant:

```ts
const heightmapSeed  = masterSeed ^ 0x9E3779B9
const biomeSeed      = masterSeed ^ 0x243F6A88
const undergroundSeed = masterSeed ^ 0xB7E15162
const riverSeed      = masterSeed ^ 0x71374491
```

---

## Tile Metadata

### Extra fields on World3D

The existing `World3D.materials` and `World3D.flags` arrays (both `Uint8Array`, same `width×height×depth` size) are used as follows:

| Array | Meaning |
|---|---|
| `tiles` | `TileType` enum value (Air, Stone, Soil, Water, Floor, Wall, …) |
| `materials` | Material index into a global materials table (0 = none) |
| `flags` | Bit-packed: bit 0 = exposed to sky, bit 1 = river, bit 2 = cavern, bits 3–7 reserved |

### New TileTypes needed (to be added to `src/map/tileTypes.ts`)

| Enum | Value | Description |
|---|---|---|
| `Grass` | 6 | Soil surface with grass — biome: temperate/tropical |
| `Sand` | 7 | Desert/beach surface |
| `Snow` | 8 | Arctic surface |
| `Ice` | 9 | Frozen water |
| `Ore` | 10 | Underground ore vein (material index identifies the ore type) |
| `Magma` | 11 | Magma pool at deepest z-levels |

---

## Pipeline Steps

### Step 1 — Heightmap (`#28`)

**Algorithm:** Fractal Brownian Motion (fBm) using simplex noise with 6 octaves.

```
for each (x, y) in 128×128:
  elevation[x][y] = fBm(x / 64, y / 64, octaves=6, lacunarity=2.0, gain=0.5)
```

Output: `Float32Array[128×128]` with values in `[−1, 1]`. Normalize to `[0, 1]` after generation.

**Thresholds (normalized elevation `e`):**

| e range | Surface classification |
|---|---|
| e < 0.25 | Ocean / deep water |
| 0.25 ≤ e < 0.35 | Coastal / shallow water |
| 0.35 ≤ e < 0.60 | Lowland |
| 0.60 ≤ e < 0.80 | Highland |
| e ≥ 0.80 | Mountain |

**Implementation note:** Use `fast-noise/simplex` (pure-TS, no WASM). Must run in Node.js for headless tests.

**Pass criteria:**
- Standard deviation of output elevations > 0.15 (meaningful variation)
- At least 10% of tiles have `e < 0.35` (water coverage)
- At least 5% of tiles have `e ≥ 0.80` (mountains present)

---

### Step 2 — Biome Assignment (`#30`)

**Algorithm:** Whittaker biome model using temperature × moisture axes.

Temperature per tile is derived from elevation and latitude (y-position):
```
temperature[x][y] = 1.0 − elevation[x][y] * 0.4 − (y / 128) * 0.3 + noise(x, y) * 0.1
```

Moisture per tile uses a second independent fBm pass:
```
moisture[x][y] = fBm(x / 48, y / 48, octaves=4, lacunarity=2.0, gain=0.5)  // normalized [0,1]
```

**Biome table:**

| Temperature | Moisture | Biome |
|---|---|---|
| < 0.2 | any | Tundra |
| 0.2–0.5 | < 0.3 | Desert |
| 0.2–0.5 | 0.3–0.7 | Grassland |
| 0.2–0.5 | > 0.7 | Temperate Forest |
| > 0.5 | < 0.3 | Savanna |
| > 0.5 | 0.3–0.7 | Tropical Forest |
| > 0.5 | > 0.7 | Rainforest |

Tiles with `e < 0.35` are always classified as Water regardless of biome.

**Pass criteria:**
- At least 3 distinct biomes present
- No biome covers more than 60% of non-water tiles

---

### Step 3 — Underground Layers (`#32`)

**Algorithm:** Layered stone generation with domain-warped noise for ore veins.

**Z-level scheme** (z=0 surface, negative = underground, positive = above-ground elevation):

| z range | Layer |
|---|---|
| z = 0 | Surface (handled by biome step) |
| z = −1 to −3 | Shallow underground (topsoil/loam) |
| z = −4 to −9 | Mid stone — primary ore veins |
| z = −10 to −13 | Deep stone — rare ore veins + caverns |
| z = −14 to −15 | Very deep stone / large caverns |
| z = −16 | Magma layer |
| z = +1 to +16 | Above-ground (hills/mountains — Air unless solid terrain) |

**Stone type selection:**

Each column `(x, y)` is assigned a primary stone type from:
- Granite, Limestone, Sandstone, Basalt, Marble (probability based on elevation)

```ts
const stoneNoise = fBm(x / 32, y / 32, octaves=3) // [0, 1]
// 0–0.2: Granite, 0.2–0.4: Limestone, 0.4–0.6: Sandstone, 0.6–0.8: Basalt, 0.8–1.0: Marble
```

**Ore vein generation:**

Domain-warped noise controls ore placement. For each ore type, run:
```ts
// warp the noise coords first (3 noise passes)
wx = x + 4 * fBm(x/8, y/8, z/8, octaves=2)
wy = y + 4 * fBm(x/8 + 2, y/8 + 2, z/8 + 2, octaves=2)
oreNoise = fBm(wx/16, wy/16, z/4, octaves=3)
if (oreNoise > threshold) → tile is Ore with this material
```

| Ore | z-range | threshold | Rarity |
|---|---|---|---|
| Coal | −1 to −8 | 0.72 | Common |
| Iron | −3 to −10 | 0.78 | Common |
| Copper | −3 to −10 | 0.80 | Common |
| Gold | −8 to −15 | 0.85 | Rare |
| Adamantine | −13 to −16 | 0.92 | Very rare |

**Cavern generation:**

At z = −7 to −15, 3D simplex noise creates open cavern spaces:
```ts
cavernNoise = simplex3d(x/24, y/24, z/6)
if (cavernNoise > 0.55) → tile is Air (cavern)
```

**Pass criteria:**
- Each ore type present ≥ 5 tiles
- Cavern tiles ≥ 2% of total underground volume
- Magma tiles present at z = −16

---

### Step 4 — Rivers and Water Features (`#33`)

**Algorithm:** Flow accumulation on the heightmap gradient.

1. For each cell, compute flow direction to the steepest downhill neighbor (D8 method).
2. Accumulate flow: each cell's accumulation = 1 + sum of upstream cells.
3. Cells with accumulation > `RIVER_THRESHOLD = 64` become river tiles.
4. Rivers carve a 1-tile-wide path, setting tile to Water.
5. Cells with `e < 0.35` (ocean) are set to Water at z = 0.

Lake formation: closed basins (no outlet to a lower cell) fill with water up to the basin rim.

**Pass criteria:**
- At least 1 continuous river from a highland cell (e > 0.60) to a water/ocean cell
- Total river tile count ≥ 10

---

### Step 5 — World Gen Orchestrator (`#34`)

The orchestrator calls each generator in order and emits progress events:

```ts
type WorldGenProgressEvent = {
  step: 'heightmap' | 'biomes' | 'underground' | 'rivers' | 'tile_resolve' | 'embark'
  progress: number  // 0.0–1.0
  label: string     // human-readable, e.g. "Carving rivers…"
}
```

Each step emits at least one event at `progress = 0` (start) and one at `progress = 1` (done). Steps that iterate may emit intermediate events every ~10% of work.

The orchestrator is an `async` function so the event loop is not blocked. Each generator step yields via `await new Promise(resolve => setTimeout(resolve, 0))` at natural checkpoints.

```ts
async function generateWorld(
  seed: number,
  onProgress: (event: WorldGenProgressEvent) => void,
): Promise<World3D>
```

---

### Step 6 — Tile Type Resolver (`#36`)

Maps the raw generator outputs to `TileType` enum values for each tile:

```
Surface (z = 0):
  elevation < 0.25 → Water
  elevation < 0.35 → Water
  biome = Tundra   → Snow
  biome = Desert   → Sand
  else             → Soil (grass visual determined by renderer)

Underground (z < 0):
  cavern = true    → Air
  ore = true       → Ore (material = ore type)
  z = −16          → Magma
  else             → Stone (material = stone type)

Above ground (z > 0):
  elevation maps to solid Stone/Soil terrain or Air

River flag = true   → Water (overrides surface tile)
```

---

### Step 7 — World Slice Builder (`#37`)

Writes resolved `TileType` values and material indices into `World3D.tiles` and `World3D.materials`. This is the final step before embark.

---

### Step 8 — Starting Embark Site (`#38`)

Selects a valid embark site on the surface (z = 0) and places dwarves:

1. Find all "good" embark tiles: non-water, non-mountain (`e ∈ [0.35, 0.75]`), biome ≠ Tundra.
2. Pick a random 5×5 cluster of good tiles.
3. Place 7 dwarves at the center of the cluster (scattered 1–2 tiles apart).
4. Drop a crate entity near the dwarves (starting supplies — contents TBD in Phase 2).

---

## Performance Budget

Total pipeline: ≤ 3 000 ms on a mid-range 2022 laptop (single-threaded, unoptimized JS).

| Step | Budget |
|---|---|
| Heightmap | 200 ms |
| Biomes | 100 ms |
| Underground | 500 ms |
| Rivers | 300 ms |
| Tile resolve | 200 ms |
| Embark | 50 ms |
| Overhead | 150 ms |
| **Total** | **1 500 ms** (50% headroom) |

---

## Integration Test Pass Criteria (`#40`)

The Phase 1 integration test (`tests/integration/phase1.test.ts`) will assert:

1. Surface (z = 0) has ≥ 3 distinct `TileType` values.
2. At least one Water tile exists on z = 0 (river or ocean).
3. Underground (z ≤ −4) has at least one `Ore` tile.
4. Exactly 7 dwarves spawned at valid surface tiles.
5. All dwarves start at `z = 0`.
6. Pipeline completes in ≤ 5 000 ms (generous CI budget).

---

## Design Decisions (resolved)

1. **Simplex noise library:** `fast-noise/simplex` — pure-TS, no WASM, runs in Node.
2. **Z-axis direction:** z = 0 is surface; z goes negative underground (min −16); z goes positive for above-ground terrain (max +16). Total depth is 33 z-levels.
3. **Biome enum location:** `const enum Biome` lives in `src/map/biomes.ts` — shared file imported by both the generator and the tile resolver.
4. **New TileTypes:** All 6 approved (Grass=6, Sand=7, Snow=8, Ice=9, Ore=10, Magma=11). Add to `src/map/tileTypes.ts` before Phase 1 implementation begins.
5. **Material table:** Separate typed TypeScript `const` object — no YAML. Stone types and ore types defined as a plain struct in `src/map/materials.ts`. Can migrate to YAML later if needed.

---

## Files to Create (Phase 1)

```
src/map/biomes.ts                  ← shared Biome enum (#30)
src/map/materials.ts               ← typed material const table (stone types, ore types)
src/map/generators/
  heightmap.ts              ← #28
  biomes.ts                 ← #30
  underground.ts            ← #32
  rivers.ts                 ← #33
  worldGenOrchestrator.ts   ← #34
  tileTypeResolver.ts       ← #36
  worldSliceBuilder.ts      ← #37
src/ui/WorldGenProgressScreen.tsx  ← #35
src/entities/embarkSite.ts         ← #38
tests/integration/phase1.test.ts   ← #40
```
