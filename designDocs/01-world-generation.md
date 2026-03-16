# World Generation

## Overview

The game uses a **two-tier world generation** system:

1. **Overworld (512x512 tiles)** — A minimap/world map generated with coherent noise. Multiple noise octaves for elevation, moisture, and temperature produce smooth biome transitions. Mountains form ranges, forests cluster, and oceans are contiguous bodies. Each tile maps to a `terrain_type` enum value.

2. **Fortress map (512x512 x 20 z-levels)** — When a player picks an overworld tile and embarks, a detailed local map is generated for that single tile. The surface terrain derives from the overworld biome, while subsurface layers contain soil, stone, ore veins, caverns, aquifers, and magma.

All world state lives in the `worlds`, `world_tiles`, and `fortress_tiles` Supabase tables.

## Overworld Generation

### Noise Algorithm

The overworld is generated using **Simplex noise** with multiple octaves. Each noise layer uses the world seed to produce deterministic output. Three independent noise fields are sampled at every (x, y) coordinate:

| Layer       | Octaves | Frequency | Amplitude | Purpose                          |
|-------------|---------|-----------|-----------|----------------------------------|
| Elevation   | 6       | 0.005     | 1.0       | Height map — peaks, valleys, sea |
| Moisture    | 4       | 0.008     | 1.0       | Rainfall / wetness               |
| Temperature | 3       | 0.004     | 1.0       | Hot/cold gradient                |

Each layer is normalized to [0, 1] after octave summation. Fractal Brownian motion (fBm) is used: each successive octave doubles the frequency and halves the amplitude, adding fine detail on top of broad shapes.

### Terrain Type Derivation

The combination of elevation, moisture, and temperature determines the `terrain_type` for each tile. The rules are evaluated in priority order:

| Priority | Condition                                             | Terrain      |
|----------|-------------------------------------------------------|--------------|
| 1        | elevation < 0.25                                      | ocean        |
| 2        | elevation > 0.85 and temperature < 0.3                | tundra       |
| 3        | elevation > 0.85                                      | mountain     |
| 4        | elevation > 0.75 and moisture < 0.2 and temp > 0.7    | volcano      |
| 5        | temperature < 0.15                                    | tundra       |
| 6        | moisture > 0.7 and temperature > 0.6                  | swamp        |
| 7        | moisture < 0.2 and temperature > 0.6                  | desert       |
| 8        | moisture > 0.5 and temperature > 0.3                  | forest       |
| 9        | elevation > 0.6                                       | mountain     |
| 10       | otherwise                                             | plains       |

Special terrain types (`underground`, `haunted`, `savage`, `evil`) are assigned as rare overlays by a separate low-frequency noise layer with a high threshold (> 0.95), ensuring they appear as isolated pockets.

### Database Persistence

When a world is generated server-side, all 262,144 tiles (512x512) are inserted into `world_tiles`:

```sql
world_tiles (
  id, world_id, coord, x, y,
  terrain,      -- terrain_type enum
  elevation,    -- int, meters
  biome_tags,   -- text[], e.g. ['temperate', 'humid']
  explored      -- boolean, starts false
)
```

Tiles start unexplored. The player's starting tile and immediate neighbors are revealed at embark. Scouting reveals more.

### Seed Determinism

Each world has a unique `bigint` seed stored in `worlds.seed`. The generation algorithm must be **purely deterministic given the seed** — the same seed always produces the same world. This enables:

- Regenerating tile data without re-storing it (for debugging)
- Sharing seeds between players as a social feature
- Verification that world state has not been tampered with

## Fortress Map Generation

### Embark Trigger

When a player selects an overworld tile and embarks, the server generates a **512x512 x 20 z-level** fortress map for that tile. The fortress map is tied to the player's civilization. Generation is a one-time operation; the resulting tiles are persisted and mutated by gameplay (mining, building, flooding, etc.).

### Z-Level Layout

Z-levels use a top-down indexing scheme:

| Z-Level | Description              |
|---------|--------------------------|
| z = 0   | Surface                  |
| z = -1  | Shallow subsurface       |
| z = -2 to -4   | Soil layers       |
| z = -5 to -9   | Stone layers      |
| z = -10 to -14 | Deep stone layers |
| z = -15 to -17 | Cavern zone       |
| z = -18        | Deep caverns      |
| z = -19        | Magma sea         |

### Surface Level (z = 0)

The surface terrain is derived from the overworld biome of the embarked tile:

| Overworld Terrain | Surface Tile Composition                        |
|-------------------|--------------------------------------------------|
| mountain          | Mostly stone, scattered ore, steep elevation     |
| forest            | Soil floor with tree objects, some water          |
| plains            | Open soil, grass, few obstacles                   |
| desert            | Sand (soil variant), no water, sparse             |
| tundra            | Frozen soil, ice (water variant), sparse          |
| swamp             | Soil with heavy water coverage, mud               |
| ocean             | Entirely water (cannot embark)                    |
| volcano           | Lava stone, magma pools on surface                |

### Layer Types by Depth

Each z-level is generated with a primary material composition:

**Soil (z = -1 to -4):** Mostly `soil` tiles with occasional `water` (aquifer pockets). Easy to dig through. No significant ore.

**Stone (z = -5 to -9):** Transition to `stone` tiles. Ore veins begin appearing. Common ores (iron, copper, tin) are placed here. Occasional small cavern pockets.

**Deep Stone (z = -10 to -14):** Dense `stone` with rarer ores (gold, silver, platinum) and gem veins (ruby, sapphire, emerald, diamond). Larger cavern systems possible.

**Cavern Zone (z = -15 to -18):** Open `cavern_floor` and `cavern_wall` tiles forming large connected cave systems. Underground water bodies. Rare ores and gems at higher density. Dangerous creatures inhabit these levels.

**Magma Sea (z = -19):** The deepest level. Dominated by `magma` tiles with `lava_stone` islands. Contains adamantine veins (the rarest material). Extremely dangerous.

### Ore and Gem Vein Generation

Ore and gem deposits are placed using a separate noise field per material type, seeded from the world seed plus the civilization id. Each material has:

- **Depth range:** Minimum and maximum z-level where it can appear
- **Rarity:** Threshold on the noise value (higher = rarer)
- **Vein size:** Number of connected tiles when a vein spawns

| Material    | Depth Range    | Rarity   |
|-------------|---------------|----------|
| Iron ore    | -5 to -14     | Common   |
| Copper ore  | -5 to -12     | Common   |
| Tin ore     | -5 to -12     | Common   |
| Gold ore    | -10 to -17    | Uncommon |
| Silver ore  | -8 to -15     | Uncommon |
| Platinum    | -12 to -18    | Rare     |
| Ruby        | -10 to -17    | Uncommon |
| Sapphire    | -10 to -17    | Uncommon |
| Emerald     | -12 to -18    | Rare     |
| Diamond     | -14 to -19    | Very rare|
| Adamantine  | -19           | Legendary|

### Cavern Generation Algorithm

Caverns are generated using a **cellular automata** approach:

1. Seed the cavern zone z-levels with random `open` / `solid` tiles (45% open probability)
2. Run 4-5 smoothing iterations: a tile becomes solid if it has >= 5 solid neighbors (Moore neighborhood), otherwise open
3. Flood-fill to identify connected regions; keep only regions above a minimum size threshold
4. Connect disjoint regions with tunneled corridors (A* or straight-line carving)
5. Place `stair_down` / `stair_up` / `stair_both` tiles at the edges of cavern floors to connect z-levels

### Aquifer and Magma Placement

**Aquifers (z = -1 to -3):** A low-frequency noise layer marks aquifer regions. Within these regions, `water` tiles are placed at ~30% density. Aquifers create flooding hazards when mined into.

**Magma (z = -19):** The entire level defaults to `magma` tiles. A secondary noise field carves out `lava_stone` islands (solid ground) at ~20% coverage. Magma also appears in narrow vertical columns ("magma pipes") that can extend from z = -19 up to z = -15 in rare cases.

### Stair Connections

Every z-level pair is connected by stair tiles:

- `stair_down` at z = n connects to `stair_up` at z = n-1
- `stair_both` is placed when a tile connects both up and down

Stairs are placed at 2-4 locations per z-level, biased toward the edges of open areas. The surface level (z = 0) only has `stair_down` tiles. The deepest level (z = -19) only has `stair_up` tiles.

### Database Persistence

Fortress tiles are stored in the `fortress_tiles` table:

```sql
fortress_tiles (
  id, civilization_id, x, y, z,
  tile_type,     -- fortress_tile_type enum
  material,      -- text, nullable (e.g. 'granite', 'iron_ore', 'ruby')
  is_revealed,   -- boolean, default false
  is_mined,      -- boolean, default false
  created_at     -- timestamptz
)
```

The table has a unique constraint on `(civilization_id, x, y, z)` and indexes for per-level queries and tile type lookups.

A full fortress contains up to 512 x 512 x 20 = 5,242,880 tiles. To manage this volume, tiles can be generated lazily per z-level (only materialize rows when the player first visits or mines toward a level) or bulk-inserted at embark time with batch inserts.

## Rendering

Both map modes are rendered to an HTML5 `<canvas>` element using a monospace character grid.

### Grid Snapping

All rendering and panning snaps to whole character cells. The cell size is:
- **Width**: 10px per character
- **Height**: 18px per character

Panning updates `offsetX` / `offsetY` by integer tile counts — never fractional. Mouse drag calculates tile deltas via `Math.round(pixelDelta / charSize)`.

### Viewport

The viewport is a sliding window over the world grid. State tracked in `useViewport` hook:
- `offsetX`, `offsetY`: top-left tile of the visible window
- `cursorX`, `cursorY`: world-space position of the highlighted tile

### Fortress Tile Glyphs

| Glyph | Meaning          | Color   |
|-------|------------------|---------|
| `.`   | Floor (stone)    | #555    |
| `#`   | Wall             | #888    |
| `≈`   | Water            | #4488ff |
| `~`   | Magma            | #ff4400 |
| `▲`   | Stair up         | #4af626 |
| `▼`   | Stair down       | #4af626 |
| `♦`   | Stair up+down    | #4af626 |
| `$`   | Ore vein         | #ffbf00 |
| `*`   | Gem deposit      | #ff77ff |
| `@`   | Dwarf            | #4af626 |
| `D`   | Dragon           | #ff4444 |
| `B`   | Beast            | #ff8800 |

### Performance

At 10px x 18px cells in a typical 1200x800 viewport, the renderer draws ~120 columns x ~44 rows = ~5,280 tiles per frame. This is well within canvas performance for a `fillText` loop with no complex shading.
