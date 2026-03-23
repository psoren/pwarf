# Terrain Variety Brainstorm

## Current State

Each fortress map (512x512) is generated from a single biome profile. Within a biome, the terrain is mostly uniform — noise controls placement density of trees/rocks/ponds but the overall feel is flat and repetitive. There are no transitions, no large-scale features, and no elevation changes on the surface.

**What we have:**
- 7 biome profiles (plains, mountain, forest, desert, tundra, swamp, volcano)
- Per-biome base tile, tree/bush/rock density, pond tile type
- Cave level with cellular automata and ore veins
- Cave entrances connecting z=0 to z=-1

**What's missing:**
- No rivers or flowing water
- No elevation within a fortress (surface is flat)
- No biome transitions (e.g., forest thinning at the edges)
- No large-scale landforms (ravines, cliffs, plateaus)
- No special features (ruins, clearings, mineral outcrops)

---

## Ideas

### 1. Rivers and Streams

**Concept:** A noise-based river system that carves through the fortress map.

- Use a ridge noise function (absolute value of standard noise) to create natural-looking meandering paths
- Rivers are 1–3 tiles wide, always flow from one edge of the map to another
- Shallow crossings at certain points (fordable tiles)
- Rivers carve through underground too — waterfalls at cave entrances where rivers meet z=-1
- Biome interaction: rivers freeze to ice in tundra, dry up in desert (cracked riverbed tiles), boil in volcano (steam vents)

**Implementation complexity:** Medium. Need a new noise pass + river tile types + pathfinding awareness.

### 2. Elevation Variation (Hills and Valleys)

**Concept:** A continuous elevation field that affects movement speed, visibility, and building placement.

- Low-frequency noise generates gentle hills (0–3 height levels above baseline)
- Hills don't block movement but slow it (uphill penalty)
- High ground gives line-of-sight advantage for future ranged combat
- Valleys collect water (ponds form naturally at local elevation minima)
- Cliffs: sharp elevation changes (>2 levels between adjacent tiles) create impassable terrain — must mine through or build ramps

**Implementation complexity:** High. Needs new elevation field on fortress tiles, rendering changes (gradient shading), pathfinding cost updates.

### 3. Biome Transition Zones

**Concept:** When the world-level biomes around the embarked tile differ, the fortress edges blend between biomes.

- Sample the 8 neighboring world tiles' biomes
- Edge strips (20–40 tiles deep) interpolate between the fortress biome and the neighbor biome
- Example: embarking on a forest tile next to a desert produces a gradual forest → scrubland → sand transition on that edge
- This creates naturally varied fortress maps without complex generation

**Implementation complexity:** Low-medium. Just needs neighbor biome lookup + profile interpolation in the deriver.

### 4. Clearings and Groves

**Concept:** Large-scale terrain features that break up the monotony.

- **Clearings:** Open grass/soil patches in forests (80–150 tile diameter), good building sites
- **Dense groves:** Extra-thick tree clusters in plains/forests, harder to clear
- **Rock outcrops:** Surface stone formations in any biome — exposed ore/gems visible before mining
- **Mushroom circles:** Rare magical clearings with pre-grown mushroom gardens
- **Ancient ruins:** Stone walls/floors from a previous civilization, partially intact

**Implementation complexity:** Low. Just add large-scale feature noise layers with high thresholds.

### 5. Water Features (Beyond Rivers)

**Concept:** More varied water than just ponds.

- **Lakes:** Large connected water bodies (50–200 tiles), shore tiles with beach/sand transition
- **Springs:** Single-tile water sources in caves that create small underground pools
- **Waterfalls:** Where rivers meet cliff edges or cave entrances
- **Marshland:** Partially walkable waterlogged tiles (slow movement), common in swamp biomes
- **Hot springs:** In volcano biomes, provide warmth bonus for nearby dwarves

**Implementation complexity:** Medium. Lakes are straightforward (enlarge pond noise regions); marshland needs a new tile type; waterfalls need cross-z-level rendering.

### 6. Seasonal Variation

**Concept:** Surface tiles change appearance and properties with the in-game calendar.

- **Spring:** Grass turns bright green, flowers appear, rivers swell
- **Summer:** Full foliage, longest days
- **Autumn:** Trees turn amber/red, leaves fall (cosmetic ground litter tiles)
- **Winter:** Snow covers grass, ponds freeze, trees become bare

This doesn't change the generation itself but adds temporal variety to the same map.

**Implementation complexity:** Medium. Need a seasonal calendar + tile glyph/color variants keyed to season. No structural changes to terrain.

### 7. Deeper Cave Variety

**Concept:** Cave level gets its own sub-biomes and features.

- **Underground lakes:** Large water bodies in caves (use flood-fill on low points)
- **Lava tubes:** In volcano biomes, magma rivers flow through cave networks
- **Crystal caverns:** Rare cave rooms with gem-encrusted walls (visual + resource bonus)
- **Fungal forests:** Cave areas with tall mushroom "trees" (resource source, atmospheric)
- **Ancient mines:** Pre-existing tunnels from the ruin system, partially collapsed

**Implementation complexity:** Medium. Mostly new tile types and cave-specific noise layers.

### 8. Soil Layers

**Concept:** Surface tiles have depth — top layer is soil/grass, but mining reveals different materials underneath.

- First 2–3 tiles down from surface: soil (easy to dig, no resources)
- Below soil: stone layers (granite, marble, sandstone) — harder to dig, can be smoothed
- Deepest: cave layer with ores

This gives a sense of vertical terrain variety even at z=0.

**Implementation complexity:** Medium-high. Needs per-tile material stack concept.

---

## Priority Recommendations

**Quick wins (low effort, high impact):**
1. Clearings and groves (#4) — just noise threshold tweaks
2. Biome transition zones (#3) — neighbor lookup in deriver
3. Lakes (#5, partial) — enlarge existing pond noise

**Medium-term (significant impact):**
4. Rivers (#1) — signature terrain feature
5. Seasonal variation (#6) — visual refresh without structural changes
6. Deeper cave variety (#7) — extends existing cave system

**Long-term (architectural):**
7. Elevation variation (#2) — big change to movement/rendering
8. Soil layers (#8) — new material model

---

## Open Questions

- Should terrain variety affect gameplay difficulty (e.g., river crossings slow enemies)?
- How do we handle rivers in pathfinding — bridges as buildable structures?
- Should biome transitions be visible on the world map or only in fortress view?
- How much seasonal variation is cosmetic vs. gameplay-affecting (frozen rivers, snow movement penalty)?
