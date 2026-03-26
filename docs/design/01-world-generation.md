# World Generation

> **Status:** Implemented
> **Last verified:** 2026-03-25

## Overview

The game uses a **two-tier world generation** system:

1. **Overworld (512x512 tiles)** — A minimap/world map generated with coherent noise. Multiple noise octaves for elevation, moisture, and temperature produce smooth biome transitions. Mountains form ranges, forests cluster, and oceans are contiguous bodies. Each tile maps to a `terrain_type` enum value.

2. **Fortress map (512x512, surface + caves)** — When a player picks an overworld tile and embarks, a detailed local map is generated for that single tile. Only the surface (z=0) is generated at embark time. Underground caves are discovered organically through cave entrances on the surface.

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

When a player selects an overworld tile and embarks, the server generates a **512x512 surface map (z=0)** for that tile. The fortress map is tied to the player's civilization. The underground is not generated upfront — instead, cave entrances on the surface lead to cave levels that are generated deterministically from the seed when first accessed.

### Z-Level Layout

The fortress uses a discovery-based vertical layout:

| Z-Level | Description                              |
|---------|------------------------------------------|
| z = 0   | Surface — generated at embark            |
| z = -1  | Cave level — accessed via cave entrances |

Cave entrances (`cave_entrance` tiles) appear on the surface at noise-determined positions. Each entrance connects to an open `cavern_floor` tile at z=-1. The cave level is a cellular-automata-generated cave system with ore and gem veins in its walls.

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

### Cave Entrances

Cave entrances are placed on the surface using a noise field. Placement rules:

- Up to 5 entrances per fortress, spaced at least 80 tiles apart
- Only placed where the cave below has open floor (ensuring the entrance actually leads somewhere)
- Noise threshold > 0.7 determines candidate positions
- Rendered as `▼` in earthy brown (#886644)

### Cave Level (z = -1)

The cave level is generated using **cellular automata**:

1. Seed the grid with random `open` / `solid` tiles (45% open probability) using noise
2. Run 5 smoothing iterations: a tile becomes solid if it has >= 5 solid neighbors (Moore neighborhood), otherwise open
3. Flood-fill to identify connected regions; discard regions smaller than 50 tiles
4. Connect disjoint surviving regions with straight-line corridors

Cave walls may contain ore and gem veins:

| Material    | Rarity   |
|-------------|----------|
| Iron ore    | Common   |
| Copper ore  | Common   |
| Tin ore     | Common   |
| Gold ore    | Uncommon |
| Silver ore  | Uncommon |
| Ruby        | Uncommon |
| Sapphire    | Uncommon |

### Pathfinding Between Levels

Cave entrances act as z-level transitions in pathfinding:

- Standing on a `cave_entrance` at z=0 allows moving to z=-1 (if the tile below is walkable)
- Standing at z=-1 directly below a `cave_entrance` allows moving up to z=0

This replaces the old stair column system. Dwarves discover caves by wandering near entrances or being assigned tasks in the cave.

### Future: Deeper Caves

In a future phase, caves will support multiple depths:

- Cave passages at z=-1 may contain **deep cave entrances** leading to z=-2
- Deeper caves (z=-2, z=-3, ...) have rarer resources and greater danger
- Each deeper level is generated on-demand with the same cellular automata approach
- Material tables expand at depth: platinum, emerald, diamond, adamantine appear only in deep caves
- Multi-room cave systems with branching passages

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

The deriver generates all tile layouts deterministically from the seed, so only **modified** tiles (mined, built) need database rows. This sparse override pattern means a fortress with no player modifications has zero rows — the frontend and sim derive tiles on-the-fly. Cave tiles at z=-1 follow the same pattern: derived from the seed, with DB rows only for player modifications.

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
| `▼`   | Cave entrance    | #886644 |
| `<`   | Stair up         | #4af626 |
| `>`   | Stair down       | #4af626 |
| `X`   | Stair up+down    | #4af626 |
| `$`   | Ore vein         | #ffbf00 |
| `♦`   | Gem deposit      | #ff44ff |
| `@`   | Dwarf            | #4af626 |
| `D`   | Dragon           | #ff4444 |
| `B`   | Beast            | #ff8800 |

### Performance

At 10px x 18px cells in a typical 1200x800 viewport, the renderer draws ~120 columns x ~44 rows = ~5,280 tiles per frame. This is well within canvas performance for a `fillText` loop with no complex shading.
