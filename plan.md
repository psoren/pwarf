# pWarf — Implementation Plan

## Status Legend

- [ ] Not started
- [x] Complete
- 🔧 Stubbed (file exists, minimal/no implementation)

**Last updated**: 2026-03-23

---

## Deliverable 1: Core Sim Engine (No UI)

**Goal**: The sim can run headless, tick a civilization, decay needs, update stress, and persist to Supabase. Testable via DB queries alone.

**Status: Complete**

### D1.1 — Shared Types & Constants
- [x] **D1.1-1**: Define DB row types in `shared/src/db-types.ts`
- [x] **D1.1-2**: Define timing constants in `shared/src/constants.ts`
- [x] **D1.1-3**: Per-need decay rate constants (FOOD_DECAY_PER_TICK, DRINK_DECAY_PER_TICK, etc.)
- [x] **D1.1-4**: Stress severity tier thresholds and personality modifiers

### D1.2 — SimRunner & Context
- [x] **D1.2-1**: `sim-runner.ts` — start/stop/tick loop with setInterval, SimSnapshot emission
- [x] **D1.2-2**: `sim-context.ts` — SimContext + CachedState with dirty tracking (dirtyDwarfIds, dirtyMonsterIds, etc.)
- [x] **D1.2-3**: `load-state.ts` — populate CachedState from Supabase on start
- [x] **D1.2-4**: `flush-state.ts` — batched dirty writes with proper FK ordering
- [x] **D1.2-5**: Seeded RNG (`rng.ts`) for deterministic sim runs
- [x] **D1.2-6**: `run-scenario.ts` — headless scenario runner for tests (no Supabase, no timers)

### D1.3 — Phase: Needs Decay
- [x] **D1.3-1**: `needs-decay.ts` — decrement all six need meters per alive dwarf per tick
- [x] **D1.3-2**: Configurable decay rates with personality trait modulation
- [x] **D1.3-3**: Dirty tracking after mutation

### D1.4 — Phase: Stress Update
- [x] **D1.4-1**: `stress-update.ts` — raise stress from low needs, memories, personality
- [x] **D1.4-2**: Lower stress from satisfied needs, positive memories, agreeableness
- [x] **D1.4-3**: Neuroticism multiplier on stress gains

### D1.5 — Phase: Tantrum Check & Actions
- [x] **D1.5-1**: `tantrum-check.ts` — trigger tantrums at threshold, strange moods
- [x] **D1.5-2**: `tantrum-actions.ts` — tantrum behaviors and duration management

### D1.6 — Phase: Event Firing
- [x] **D1.6-1**: `event-firing.ts` — critical need warnings, task completions, fortress-fallen events

### D1.7 — Phase: Yearly Rollup
- [x] **D1.7-1**: `yearly-rollup.ts` — age dwarves, natural death for elders
- [x] **D1.7-2**: Immigration wave logic (new dwarves based on population)
- [x] **D1.7-3**: Trade caravan arrivals
- [x] **D1.7-4**: Disease phase, memory decay, relationship formation

### D1.8 — Testing
- [x] **D1.8-1**: `runScenario()` — headless scenario runner with seeded RNG
- [x] **D1.8-2**: 700+ unit and scenario tests across all phases
- [x] **D1.8-3**: Skill level-up scenarios, combat scenarios, task completion scenarios

---

## Deliverable 2: World Generation

**Goal**: Player gets a procedurally generated 512x512 world stored in Supabase.

**Status: Complete**

### D2.1 — World Gen
- [x] **D2.1-1**: Simplex noise terrain generation seeded from `worlds.seed`
- [x] **D2.1-2**: Elevation, moisture, and temperature noise layers with FBM
- [x] **D2.1-3**: Terrain type derivation (ocean, mountain, forest, plains, desert, tundra, swamp, volcano)
- [x] **D2.1-4**: Bulk insert 262,144 tiles into `world_tiles`
- [x] **D2.1-5**: Biome tags and special overlays (underground, haunted, savage, evil)

### D2.2 — Embark Flow
- [x] **D2.2-1**: World map with tile inspector and embark button
- [x] **D2.2-2**: Player picks a tile, creates civilization + 7 starting dwarves with role skills
- [x] **D2.2-3**: Transition to fortress mode after embark

### D2.3 — Fortress Map
- [x] **D2.3-1**: 512x512 surface (z=0) generated from biome profile
- [x] **D2.3-2**: Cave level (z=-1) with cellular automata and corridor connections
- [x] **D2.3-3**: Ore/gem vein placement with rarity tiers (iron → diamond)
- [x] **D2.3-4**: Cave entrances connecting surface to caves
- [x] **D2.3-5**: Sparse override pattern — only modified tiles stored in DB

---

## Deliverable 3: Dwarf Behavior & Jobs

**Goal**: Dwarves move, eat, drink, sleep, and work. The player can designate tasks.

**Status: Complete**

### D3.1 — Dwarf Positioning & Pathfinding
- [x] **D3.1-1**: `position_x`, `position_y`, `position_z` on dwarves
- [x] **D3.1-2**: BFS pathfinding (`pathfinding.ts`) with tile walkability checks
- [x] **D3.1-3**: Dwarves move one tile per tick toward their task target
- [x] **D3.1-4**: Idle wandering (`idle-wandering.ts`) for dwarves with no task

### D3.2 — Phase: Need Satisfaction
- [x] **D3.2-1**: `need-satisfaction.ts` — autonomous eat/drink/sleep tasks when needs cross interrupt thresholds
- [x] **D3.2-2**: Item consumption (food/drink items with ground positions)
- [x] **D3.2-3**: Bed assignment (find nearest unoccupied bed → claim → sleep → restore energy)

### D3.3 — Phase: Job Claiming
- [x] **D3.3-1**: `job-claiming.ts` — greedy matching with priority/skill/distance scoring
- [x] **D3.3-2**: Skill requirement checking (`dwarfHasSkill`)
- [x] **D3.3-3**: Best-skill bonus for matching specialization

### D3.4 — Phase: Task Execution
- [x] **D3.4-1**: `task-execution.ts` — advance work_progress per tick
- [x] **D3.4-2**: Job types: mine, build_wall, build_floor, build_bed, build_well, build_mushroom_garden, smooth, engrave, farm_till, haul, deconstruct, brew, cook, smith, forage
- [x] **D3.4-3**: Skill-based speed modifiers + conscientiousness trait modifier
- [x] **D3.4-4**: Mining hardness (soil/stone/ore/gem/lava_stone)
- [x] **D3.4-5**: Complete jobs at 100%, free dwarf, award XP, fire level-up events

### D3.5 — Phase: Construction Progress
- 🔧 **D3.5-1**: `construction-progress.ts` — stub only, build logic handled in task-completion.ts

### D3.6 — Designations (Frontend → DB)
- [x] **D3.6-1**: Tasks table for pending designations
- [x] **D3.6-2**: Frontend designation modes: mine, build (wall/floor/bed/well/mushroom garden), deconstruct, smooth, engrave, farm, stockpile
- [x] **D3.6-3**: Drag-rectangle area designation with Supabase persistence
- [x] **D3.6-4**: Visual overlay with designation preview glyphs and build progress
- [x] **D3.6-5**: Optimistic tiles for immediate feedback
- [x] **D3.6-6**: Task priorities and cancel area support
- [x] **D3.6-7**: Haul assignment (`haul-assignment.ts`) for moving items to stockpiles

---

## Deliverable 4: Frontend Game HUD

**Goal**: The three-panel HUD renders live game state.

**Status: Complete** (uses sim snapshot polling, not Supabase Realtime subscriptions)

### D4.1 — Live Data
- [x] **D4.1-1**: SimSnapshot system — sim emits full state snapshot each tick to frontend
- [x] **D4.1-2**: Polling fallback for tasks and stockpile tiles
- [x] **D4.1-3**: React state management with useState/useMemo hooks

### D4.2 — Toolbar
- [x] **D4.2-1**: Display year, population, speed controls, pause button, sound toggle
- [x] **D4.2-2**: Speed presets (1x, 2x, 5x)

### D4.3 — Left Panel: Dwarf Roster
- [x] **D4.3-1**: Scrollable dwarf list with name, activity status
- [x] **D4.3-2**: Click → DwarfModal with needs bars, skills, traits, memories, stress
- [x] **D4.3-3**: InventoryModal for item inspection

### D4.4 — Right Panel: Log
- [x] **D4.4-1**: Event log with color-coded entries

### D4.5 — Canvas Rendering
- [x] **D4.5-1**: HTML5 canvas with monospace character grid (10x18px cells)
- [x] **D4.5-2**: Dwarf glyphs (smiley face) at positions
- [x] **D4.5-3**: Monster glyphs (M in red) at positions
- [x] **D4.5-4**: Structure/tile glyphs (walls, floors, beds, wells, etc.)
- [x] **D4.5-5**: Designation overlays with build progress interpolation
- [x] **D4.5-6**: Stockpile overlays
- [x] **D4.5-7**: Ground item glyphs
- [x] **D4.5-8**: World mode terrain rendering with biome colors

### D4.6 — Bottom Bar
- [x] **D4.6-1**: Cursor coordinates and z-level display
- [x] **D4.6-2**: Tile description under cursor

---

## Deliverable 5: Monsters & Combat

**Goal**: Monsters spawn, move, and fight dwarves.

**Status: Mostly complete** (no military UI)

### D5.1 — Monster Spawning
- [x] **D5.1-1**: `monster-spawning.ts` — periodic spawns near dwarf centroid
- [x] **D5.1-2**: Spawn rate gated by MONSTER_SPAWN_INTERVAL, capped at MONSTER_MAX_ACTIVE
- [x] **D5.1-3**: Monster name generation from syllable tables

### D5.2 — Monster Pathfinding
- [x] **D5.2-1**: `monster-pathfinding.ts` — greedy movement toward nearest dwarf
- [x] **D5.2-2**: Behavior filtering (aggressive, neutral, hibernating, fleeing)

### D5.3 — Combat Resolution
- [x] **D5.3-1**: `combat-resolution.ts` — same-tile combat with damage rolls
- [x] **D5.3-2**: Threat-level and XP-based damage scaling
- [x] **D5.3-3**: Monster death → event, XP award
- [x] **D5.3-4**: Dwarf death handling with cause tracking

### D5.4 — Military UI
- [ ] **D5.4-1**: Military screen — create squads, assign dwarves
- [ ] **D5.4-2**: Squad orders: patrol zone, station, attack target

---

## Deliverable 6: Graveyard & Ruins

**Goal**: Fallen fortresses become ruins. Players can browse other players' ruins.

**Status: Partially complete** (fortress death + epitaph)

### D6.1 — Fortress Death
- [x] **D6.1-1**: Detect fortress fall (civFallen flag when all dwarves dead)
- [x] **D6.1-2**: EpitaphScreen with stats, events, and "Publish to Graveyard" button

### D6.2 — Graveyard Browser
- [x] **D6.2-1**: Published ruins query via usePublishedRuins()

### D6.3 — Ruin Decay
- [ ] **D6.4-1**: Yearly wealth reduction
- [ ] **D6.4-2**: Monster occupation of abandoned ruins

---

## Deliverable 7: Menus & Polish

**Goal**: Complete screen flow from main menu through gameplay to death.

**Status: Partially complete**

### D7.1 — Auth & Entry
- [x] **D7.1-1**: AuthScreen with login/signup/guest play
- [x] **D7.1-2**: Supabase Auth integration (email/password, guest mode)

### D7.2 — Gameplay Controls
- [x] **D7.2-1**: Pause/unpause (Space key)
- [x] **D7.2-2**: Speed control (1x/2x/5x via 1/2/5 keys)
- [x] **D7.2-3**: Z-level navigation (< / > keys)
- [x] **D7.2-4**: Full keyboard shortcut system (useKeyboard.ts)

### D7.3 — Settings
- [x] **D7.3-1**: Sound on/off toggle with volume (useSettings.ts, localStorage)
- [x] **D7.3-2**: Animations toggle
- [ ] **D7.3-3**: Display options (tile size, font)

### D7.4 — Sound Engine
- [x] **D7.4-1**: Procedural audio foundation (synth-presets.ts, use-sound-engine.ts)
- [ ] **D7.4-2**: Mining and construction sounds
- [ ] **D7.4-3**: Combat and death sounds
- [ ] **D7.4-4**: Needs and daily life sounds
- [ ] **D7.4-5**: Milestone and dramatic event sounds

### D7.5 — Visual Effects
- [ ] **D7.5-1**: Canvas effects layer
- [ ] **D7.5-2**: ASCII particle system
- [ ] **D7.5-3**: UI transitions and animations
- [ ] **D7.5-4**: Dwarf critical need blink warning
- [ ] **D7.5-5**: Fortress fallen / siege screen effects

---

## What's Left

### High-priority gaps
1. **Military UI** (D5.4) — squads, patrol orders, combat commands
2. **Sound effects** (D7.4) — foundation is built, content sounds needed

### Nice-to-have
3. **Visual effects** (D7.5) — particles, animations, screen effects
4. **Ruin decay** (D6.3) — ruins become more dangerous over time
5. **Display options** (D7.3) — tile size, font customization
7. **Terrain variety** — rivers, elevation, biome transitions (see `docs/brainstorm/terrain-variety.md`)
