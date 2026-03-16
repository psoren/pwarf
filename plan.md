# pWarf — Implementation Plan

## Status Legend

- [ ] Not started
- [x] Complete
- 🔧 Scaffolded (file exists, not implemented)

---

## Pre-requisites

### P0: Design Doc Cleanup

- [ ] **P0-1**: Fix terrain table in `01-world-generation.md` to match the `terrain_type` enum in the schema (tundra, swamp, volcano, underground, haunted, savage, evil — not jungle/grassland/barren)
- [ ] **P0-2**: Fix phase count in `02-core-game-loop.md` ("10 standard phases" → 11)
- [ ] **P0-3**: Remove duplicate CachedState definition in `02-core-game-loop.md` (keep the dirty-tracking version)
- [ ] **P0-4**: Decide on local saves in `09-ui-screens-and-interaction.md` — cut the feature or design IndexedDB persistence
- [ ] **P0-5**: Decide on audio in `09-ui-screens-and-interaction.md` — cut the settings panel or add an audio design doc

---

## Deliverable 1: Core Sim Engine (No UI)

**Goal**: The sim can run headless, tick a civilization, decay needs, update stress, and persist to Supabase. Testable via DB queries alone.

### D1.1 — Shared Types & Constants
- [x] **D1.1-1**: Define DB row types in `shared/src/db-types.ts`
- [x] **D1.1-2**: Define SimEvent union in `shared/src/events.ts`
- [x] **D1.1-3**: Define timing constants in `shared/src/constants.ts`
- [ ] **D1.1-4**: Add per-need decay rate constants (FOOD_DECAY, DRINK_DECAY, etc.)
- [ ] **D1.1-5**: Add stress severity tier thresholds (mild 80–89, moderate 90–95, severe 96–100)

### D1.2 — SimRunner & Context
- [x] **D1.2-1**: `sim-runner.ts` — start/stop/tick loop with setInterval
- [x] **D1.2-2**: `sim-context.ts` — SimContext + CachedState interfaces
- [ ] **D1.2-3**: Add dirty tracking to CachedState (dirtyDwarfIds, dirtyMonsterIds, etc.)
- [ ] **D1.2-4**: Implement `loadStateFromSupabase()` — populate CachedState on start
- [ ] **D1.2-5**: Implement `flushToSupabase()` — batched dirty writes on 1-second timer
- [ ] **D1.2-6**: Graceful shutdown (SIGINT/SIGTERM → flush → exit)

### D1.3 — Phase 1: Needs Decay
- 🔧 **D1.3-1**: Implement `needs-decay.ts` — decrement six need meters per alive dwarf per tick
- [ ] **D1.3-2**: Use configurable decay rates from constants
- [ ] **D1.3-3**: Mark dwarves dirty after mutation

### D1.4 — Phase 4: Stress Update
- 🔧 **D1.4-1**: Implement `stress-update.ts` — raise stress from low needs, memories, personality
- [ ] **D1.4-2**: Lower stress from satisfied needs, positive memories, agreeableness
- [ ] **D1.4-3**: Apply neuroticism multiplier to stress gains

### D1.5 — Phase 5: Tantrum Check
- 🔧 **D1.5-1**: Implement `tantrum-check.ts` — trigger tantrums at threshold
- [ ] **D1.5-2**: Severity tiers: mild (80–89), moderate (90–95), severe (96–100)
- [ ] **D1.5-3**: Queue tantrum events for Phase 10

### D1.6 — Phase 10: Event Firing
- 🔧 **D1.6-1**: Implement `event-firing.ts` — collect queued events, bulk insert to `world_events`

### D1.7 — Phase 11: Yearly Rollup
- 🔧 **D1.7-1**: Implement `yearly-rollup.ts` — age dwarves, roll death checks for elderly
- [ ] **D1.7-2**: Immigration wave logic (new dwarves based on wealth/fame)
- [ ] **D1.7-3**: Skill level-up (XP → level conversion)

### D1.8 — Integration Test
- [ ] **D1.8-1**: Seed a test civilization with 7 dwarves in Supabase
- [ ] **D1.8-2**: Run sim for 100 ticks, verify needs decayed and state persisted
- [ ] **D1.8-3**: Run sim for 18,000 ticks (1 year), verify yearly rollup fired

---

## Deliverable 2: World Generation

**Goal**: Player gets a procedurally generated 512x512 world stored in Supabase.

### D2.1 — Server-Side World Gen
- [ ] **D2.1-1**: Implement coherent noise terrain generation (Simplex or diamond-square) seeded from `worlds.seed`
- [ ] **D2.1-2**: Generate elevation map as primary layer
- [ ] **D2.1-3**: Derive terrain type from elevation + moisture noise layers
- [ ] **D2.1-4**: Bulk insert 262,144 tiles into `world_tiles`
- [ ] **D2.1-5**: Populate PostGIS `coord` column for spatial queries
- [ ] **D2.1-6**: Mark starting tile + neighbors as explored

### D2.2 — Embark Flow
- [ ] **D2.2-1**: Embark screen — world map with tile inspector sidebar
- [ ] **D2.2-2**: Player picks a tile, creates civilization + 7 starting dwarves
- [ ] **D2.2-3**: Transition to fortress mode after embark

### D2.3 — Fortress Map (Single Z-Level MVP)
- [ ] **D2.3-1**: Generate a single-level fortress interior for the embark tile
- [ ] **D2.3-2**: Room carving algorithm (connected rooms with corridors)
- [ ] **D2.3-3**: Place ore deposits by depth/rarity
- [ ] **D2.3-4**: Store fortress layout (local state or new DB table)

---

## Deliverable 3: Dwarf Behavior & Jobs

**Goal**: Dwarves move, eat, drink, sleep, and work. The player can designate tasks.

### D3.1 — Dwarf Positioning
- [ ] **D3.1-1**: Add `pos_x`, `pos_y`, `pos_z` columns to dwarves (or use existing tile coords)
- [ ] **D3.1-2**: Pathfinding — A* or simple BFS on fortress grid
- [ ] **D3.1-3**: Dwarves move one tile per tick toward their target

### D3.2 — Phase 3: Need Satisfaction
- 🔧 **D3.2-1**: Implement `need-satisfaction.ts` — dwarves near food/drink/beds consume and refill needs
- [ ] **D3.2-2**: Track stockpile inventories (food, drink items)
- [ ] **D3.2-3**: Bed assignment (unoccupied bed → claim → sleep)

### D3.3 — Phase 9: Job Claiming
- 🔧 **D3.3-1**: Implement `job-claiming.ts` — idle dwarves claim unclaimed work orders
- [ ] **D3.3-2**: Match by enabled labors, skill, proximity, priority

### D3.4 — Phase 2: Task Execution
- 🔧 **D3.4-1**: Implement `task-execution.ts` — advance job progress per tick
- [ ] **D3.4-2**: Job types: mine, build, haul, craft, cook
- [ ] **D3.4-3**: Skill-based speed modifiers
- [ ] **D3.4-4**: Complete jobs at 100%, free dwarf, award XP

### D3.5 — Phase 8: Construction Progress
- 🔧 **D3.5-1**: Implement `construction-progress.ts` — advance build jobs
- [ ] **D3.5-2**: Check material availability
- [ ] **D3.5-3**: Mark structures complete, create world event

### D3.6 — Designations (Frontend → DB)
- [ ] **D3.6-1**: Work orders table or JSONB field for pending designations
- [ ] **D3.6-2**: Frontend designation mode (D key → select type → drag rectangle)
- [ ] **D3.6-3**: Write designations to Supabase, sim picks them up next tick
- [ ] **D3.6-4**: Visual overlay for designated tiles on canvas

---

## Deliverable 4: Frontend Game HUD

**Goal**: The three-panel HUD renders live game state from Supabase Realtime.

### D4.1 — Supabase Realtime Subscriptions
- [ ] **D4.1-1**: Subscribe to `dwarves` table changes (filtered by civ)
- [ ] **D4.1-2**: Subscribe to `world_events` for activity log
- [ ] **D4.1-3**: Subscribe to `civilizations` for toolbar stats
- [ ] **D4.1-4**: React state management for realtime data (useState or Zustand)

### D4.2 — Toolbar
- [ ] **D4.2-1**: Display year, civ name, population, wealth from realtime data
- [ ] **D4.2-2**: Alert system — show most urgent alert (siege, death, tantrum)

### D4.3 — Left Panel: Dwarf Roster
- [ ] **D4.3-1**: Scrollable list of dwarves with name, activity, stress bar
- [ ] **D4.3-2**: Color-coded stress bars (green → yellow → orange → red)
- [ ] **D4.3-3**: Sort by stress / name / activity
- [ ] **D4.3-4**: Click → Dwarf Detail overlay (needs, skills, memories)

### D4.4 — Left Panel: World Mode Tile Inspector
- [ ] **D4.4-1**: Show terrain, elevation, biome for hovered tile
- [ ] **D4.4-2**: Show settlement info if present
- [ ] **D4.4-3**: Show tile history from world_events

### D4.5 — Right Panel: Log & Legends
- [ ] **D4.5-1**: Log tab — reverse-chronological activity feed, color-coded bullets
- [ ] **D4.5-2**: Legends tab — world history timeline grouped by year

### D4.6 — Canvas Rendering Improvements
- [ ] **D4.6-1**: Render dwarf glyphs (`@`) at their positions from realtime data
- [ ] **D4.6-2**: Render monster glyphs at their positions
- [ ] **D4.6-3**: Render structure glyphs (workshops, beds, stockpiles)
- [ ] **D4.6-4**: Designation overlays (amber/green/blue rectangles)

### D4.7 — Bottom Bar
- [ ] **D4.7-1**: Show cursor coordinates and z-level
- [ ] **D4.7-2**: Show tile description under cursor
- [ ] **D4.7-3**: Context-sensitive keybind hints

---

## Deliverable 5: Monsters & Combat

**Goal**: Monsters spawn, move, and fight dwarves. Military squads can be formed.

### D5.1 — Monster Spawning
- [ ] **D5.1-1**: Trigger monster spawns based on fortress wealth/age (yearly rollup or random events)
- [ ] **D5.1-2**: Use `spawn_monster` stored procedure
- [ ] **D5.1-3**: Assign behavior, body parts, attacks based on type

### D5.2 — Phase 6: Monster Pathfinding
- 🔧 **D5.2-1**: Implement `monster-pathfinding.ts` — move monsters toward targets
- [ ] **D5.2-2**: Behavior-specific targeting (aggressive → nearest dwarf, sieging → entrance, etc.)

### D5.3 — Phase 7: Combat Resolution
- 🔧 **D5.3-1**: Implement `combat-resolution.ts` — tile overlap → attack/defense rolls
- [ ] **D5.3-2**: Damage calculation (attack power, armor, body part targeting)
- [ ] **D5.3-3**: Wound tracking on dwarves (injuries JSONB)
- [ ] **D5.3-4**: Monster death → event, XP, legendary deed
- [ ] **D5.3-5**: Dwarf death → stress on witnesses, tantrum cascade potential

### D5.4 — Military UI
- [ ] **D5.4-1**: Military screen (M key) — create squads, assign dwarves
- [ ] **D5.4-2**: Squad orders: patrol zone, station, attack target
- [ ] **D5.4-3**: Persist squads/orders to Supabase

---

## Deliverable 6: Graveyard & Ruins

**Goal**: Fallen fortresses become ruins. Players can browse and expedition into other players' ruins.

### D6.1 — Fortress Death
- [ ] **D6.1-1**: Detect fortress fall condition (all dwarves dead/fled)
- [ ] **D6.1-2**: Call `fossilize_civilization` stored procedure
- [ ] **D6.1-3**: Epitaph screen with stats and "Publish to Graveyard" button

### D6.2 — Graveyard Browser
- [ ] **D6.2-1**: Main menu "Browse Ruins" → list of published ruins
- [ ] **D6.2-2**: Sort/filter by danger, wealth, cause of death
- [ ] **D6.2-3**: Click ruin → read-only fortress view with history

### D6.3 — Expeditions
- [ ] **D6.3-1**: Select dwarves, launch expedition to a ruin
- [ ] **D6.3-2**: Expedition status progression (traveling → active → looting → retreating → complete)
- [ ] **D6.3-3**: Resolve dangers (traps, ghosts, monsters, contamination)
- [ ] **D6.3-4**: Return with loot or casualties

### D6.4 — Ruin Decay
- [ ] **D6.4-1**: Yearly rollup reduces `remaining_wealth` over time
- [ ] **D6.4-2**: Monsters can move into abandoned ruins (`resident_monster_id`)

---

## Deliverable 7: Menus & Polish

**Goal**: Complete screen flow from main menu through gameplay to death.

### D7.1 — Main Menu
- [ ] **D7.1-1**: ASCII art title screen with New Game / Load / Browse Ruins / Settings
- [ ] **D7.1-2**: Keyboard and mouse navigation

### D7.2 — Auth Integration
- [ ] **D7.2-1**: Supabase Auth (email/password or OAuth)
- [ ] **D7.2-2**: Player profile creation on first login
- [ ] **D7.2-3**: World generation trigger on new game

### D7.3 — Pause Menu
- [ ] **D7.3-1**: Esc → pause overlay (Resume, Save, Settings, Main Menu)
- [ ] **D7.3-2**: Sim pause/resume signaling

### D7.4 — Settings
- [ ] **D7.4-1**: Sim speed (slow/normal/fast — adjust tick interval)
- [ ] **D7.4-2**: Auto-pause on siege/death
- [ ] **D7.4-3**: Display options (tile size, font)
- [ ] **D7.4-4**: Persist settings to localStorage

---

## Recommended Build Order

```
D1 (Core Sim) → D2 (World Gen) → D4 (HUD) → D3 (Jobs & Behavior) → D5 (Monsters) → D6 (Graveyard) → D7 (Menus)
```

**Rationale:**
- D1 first because everything depends on the sim ticking
- D2 next so there's a world to play in
- D4 before D3 so you can see what the sim is doing while building job logic
- D3 is the core gameplay — dwarves doing things
- D5 adds conflict (requires D3 dwarves to fight)
- D6 is the multiplayer hook (requires D5 for danger in ruins)
- D7 is polish — menus wrap the experience but aren't needed for core dev
