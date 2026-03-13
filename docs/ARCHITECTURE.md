# Architecture

**Read this before writing any code.**

## Overview

pwarf is a browser-based Dwarf Fortress clone. A colony simulation where the player manages autonomous dwarves in a procedurally generated, tile-based 3D world (z-levels). The player never directly controls dwarves — they designate zones and buildings; dwarves act autonomously.

## Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict) |
| ECS | bitecs |
| Renderer | PixiJS v8 |
| UI overlays | React |
| Build | Vite |
| Tests | Vitest |
| Data | YAML + Zod |

---

## Module Boundaries

Each module has a single owner. When in doubt about where something lives, this table is authoritative.

```
src/
├─ core/        ← ECS world, component definitions, tick loop, HeadlessGame, shared types/constants
├─ map/         ← Tile types, World3D data structure, terrain generation, z-level utilities
├─ entities/    ← Prefab factories: createDwarf(), createItem(), createCreature()
├─ systems/     ← All game logic that runs every tick
├─ ui/          ← PixiJS renderer, React components, input handling
└─ data/        ← YAML files + Zod loaders, GameData object
```

### Import direction — strictly one way

```
ui  →  systems  →  entities  →  core
                →  map       →  core
                              data  →  core
```

- `core` imports **nothing** from any other game module
- `systems` imports from `entities`, `map`, `core`, `data` — never from `ui`
- `ui` imports from `systems`, `entities`, `map`, `core` — never from `data` directly
- If you need to import across this chain in the other direction, the thing belongs in `core` instead

### What lives where — resolved examples

| Thing | Lives in | Reason |
|-------|---------|--------|
| `Position`, `Hunger`, `JobAssignment` components | `core/components/` | Components are shared by all modules |
| `createWorld()`, `GameWorld` type | `core/world.ts` | ECS world is the foundation |
| `WORLD_WIDTH`, `TILE_SIZE` constants | `core/constants.ts` | Used by map, systems, and ui |
| `SystemFn` type, `GameCommand` union | `core/types.ts` | Cross-cutting types |
| Side stores (`nameStore`, `inventoryStore`) | `core/stores.ts` | Shared non-numeric ECS data |
| `TileType` enum, `World3D` struct | `map/` | Map-specific data types |
| Terrain generation (Perlin, biomes) | `map/` | Pure world generation logic |
| `tileIndex(x,y,z)`, `getTile()`, `setTile()` | `map/world3d.ts` | Tile access helpers live with the data structure |
| A* pathfinding algorithm | `systems/pathfindingSystem.ts` | Pathfinding is a game system; it reads World3D but lives in systems |
| Job queue, job assignment | `systems/jobSystem.ts` | Game logic, runs each tick |
| Dwarf AI decision making | `systems/aiSystem.ts` | Game logic, runs each tick |
| `createDwarf(world)` factory | `entities/dwarf.ts` | Creates and wires up a dwarf entity |
| PixiJS renderer | `ui/renderer.ts` | Browser-only; never imported by systems |
| React components | `ui/` | `.tsx` files, browser-only |
| Input handling | `ui/input.ts` | Browser events, dispatches `GameCommand` |
| `materials.yaml` | `data/` | Source data file |
| Zod schema + loader for materials | `data/loaders/materials.ts` | Loader lives next to data |
| `GameData` frozen object | `data/index.ts` | Single export point for all loaded data |

---

## ECS Pattern (bitecs v0.4)

bitecs uses **structure-of-arrays**. Components are plain typed arrays; entities are integer IDs.

**v0.4 API — key differences from v0.3:**
- No `defineComponent` or `Types` — components are plain objects with typed arrays
- `addComponent(world, eid, component)` — eid comes **before** component
- No `defineQuery` — call `query(world, [Comp])` directly each tick
- No `enterQuery`/`exitQuery` — use `observe(world, onAdd/onRemove(...), cb)` instead

### Defining a component

One component per file in `src/core/components/`. Arrays are sized to `MAX_ENTITIES`.

```ts
// src/core/components/hunger.ts
import { MAX_ENTITIES } from '@core/constants'

export const Hunger = {
  current:   new Float32Array(MAX_ENTITIES),  // 0 = full, 1 = starving
  decayRate: new Float32Array(MAX_ENTITIES),  // hunger increase per second
}
```

### Using a component in a system

```ts
// src/systems/needsSystem.ts
import { query } from 'bitecs'
import { GameWorld } from '@core/world'
import { Hunger } from '@core/components/hunger'

export function needsSystem(world: GameWorld, dt: number): void {
  const entities = query(world, [Hunger])
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]!
    Hunger.current[eid] = Math.min(1, Hunger.current[eid] + Hunger.decayRate[eid] * dt)
  }
}
```

### Creating an entity (in a prefab factory)

```ts
// src/entities/dwarf.ts
import { addEntity, addComponent } from 'bitecs'
import { GameWorld } from '@core/world'
import { Position } from '@core/components/position'
import { Hunger } from '@core/components/hunger'
import { nameStore } from '@core/stores'

export function createDwarf(world: GameWorld, x: number, y: number, z: number, name: string): number {
  const eid = addEntity(world)

  addComponent(world, eid, Position)   // eid before component in v0.4
  Position.x[eid] = x
  Position.y[eid] = y
  Position.z[eid] = z

  addComponent(world, eid, Hunger)
  Hunger.current[eid] = 0
  Hunger.decayRate[eid] = 0.001

  nameStore.set(eid, name)

  return eid
}
```

### Non-numeric data → side stores

Components hold numbers only. Strings, arrays, and object references live in side stores in `src/core/stores.ts`, keyed by entity ID.

```ts
// src/core/stores.ts
export const nameStore = new Map<number, string>()
export const inventoryStore = new Map<number, number[]>()  // eid → [item eids]
export const pathStore = new Map<number, number[]>()       // eid → [tile indices]
```

Always clean up side stores when entities are removed using `observe`:

```ts
import { observe, onRemove } from 'bitecs'
import { nameStore, inventoryStore } from '@core/stores'

// Register once at world setup
observe(world, onRemove(Hunger), (eid: number) => {
  nameStore.delete(eid)
  inventoryStore.delete(eid)
})
```

### Query patterns

```ts
import { query, Not, observe, onAdd, onRemove } from 'bitecs'

// Query every tick — call directly, no pre-registration
const moving = query(world, [Position, Velocity])
const stationary = query(world, [Position, Not(Velocity)])

// Lifecycle callbacks
observe(world, onAdd(Hunger), (eid) => { /* entity gained Hunger */ })
observe(world, onRemove(Hunger), (eid) => { /* entity lost Hunger — clean up stores */ })
```

---

## Tick Loop

Fixed timestep, default 20 ticks/sec. Systems run in this order every tick:

1. `needsSystem` — decay hunger, thirst, sleep, happiness
2. `aiSystem` — dwarves pick jobs or respond to critical needs
3. `pathfindingSystem` — compute or advance paths
4. `jobSystem` — execute current jobs (mine tile, haul item, craft reaction)
5. `combatSystem` — resolve attacks, apply injuries
6. `cleanupSystem` — remove dead entities, clean side stores
7. `renderSystem` — sync ECS state → PixiJS sprites (**skipped in headless mode**)

**Systems are pure functions.** Signature: `(world: GameWorld, dt: number) => void`. No internal state. No singletons. No globals.

The tick loop is defined in `src/core/tickLoop.ts` and wired up in `src/main.ts` (browser) or `HeadlessGame` (headless).

---

## World / Z-levels

```ts
// Flat typed arrays — no object-per-tile
interface World3D {
  tiles:     Uint8Array   // TileType per cell
  materials: Uint8Array   // material ID per cell
  flags:     Uint8Array   // bitmask: 0x01=revealed, 0x02=passable, 0x04=designated
  width:     number
  height:    number
  depth:     number
}

// Index formula — used everywhere
function tileIndex(x: number, y: number, z: number, w: World3D): number {
  return z * w.width * w.height + y * w.width + x
}
```

Z-level 0 is the surface. Negative z goes underground. Positive z is sky (not used in base game).

---

## Data-Driven Design

Game content is defined in YAML under `src/data/`. Each file has a co-located Zod schema and loader.

```
src/data/
├─ materials.yaml          ← stone, metals, wood, food
├─ buildings.yaml          ← workshops, furniture, constructions
├─ reactions.yaml          ← production chains (smelt ore → bar)
├─ creatures.yaml          ← species stats, behavior flags
├─ jobs.yaml               ← job types, skill mappings, labor categories
└─ loaders/
   ├─ materials.ts         ← Zod schema + loadMaterials()
   ├─ buildings.ts
   └─ ...
```

`src/data/index.ts` loads everything once at startup, validates it, and exports a single frozen `GameData` object. All systems receive `GameData` at initialization; they never call loaders directly.

---

## HeadlessGame

All game logic must run without a DOM. `HeadlessGame` wraps the ECS world and tick loop behind a programmatic API used by tests and the automated playtest pipeline.

```ts
export class HeadlessGame {
  constructor(opts: { seed: number; width?: number; height?: number; depth?: number })
  embark(): void
  tick(): GameState
  runFor(ticks: number): GameState
  designateMine(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): void
  buildWorkshop(type: string, x: number, y: number, z: number): void
  getStocks(): ItemCount[]
  getDwarves(): DwarfStatus[]
}
```

The visual renderer is an optional layer on top. Never import PixiJS or React from `HeadlessGame` or anything it imports.

---

## Data Flow

```
Player input (mouse/keyboard)
        │
        ▼
  GameCommand dispatched
        │
        ▼
  Command handler → mutates designation/order queues in ECS components
        │
        ▼ (each tick)
  needsSystem → aiSystem → pathfindingSystem → jobSystem → combatSystem → cleanupSystem
        │
        ▼
  World3D tiles mutated, items created/moved, entity states updated
        │
        ├──▶ renderSystem → PixiJS sprites updated
        │
        └──▶ React reads ECS state via game-state hook → UI overlays re-render
```
