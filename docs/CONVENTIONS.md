# Conventions

**These rules are not suggestions.** Agent PRs that violate them will be sent back.

---

## TypeScript

- **Strict mode always on.** `tsconfig.json` has `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- No `any` without an inline comment explaining why. `// any: pixi internals don't export this type` is acceptable. Bare `any` is not.
- `const` by default. `let` only when reassignment is required.
- Use `type` for data shapes and unions. Use `interface` only for things explicitly meant to be extended by another interface.
- **Named exports everywhere.** No default exports except React components in `src/ui/` (`.tsx` files only).
- All exported functions must have explicit return types. Internal helpers can omit them if the type is obvious.
- Prefer early returns over nested `if` blocks.

---

## File Naming

| Kind | Convention | Example |
|------|-----------|---------|
| ECS component | `camelCase.ts` | `src/core/components/hunger.ts` |
| System | `camelCaseSystem.ts` | `src/systems/pathfindingSystem.ts` |
| Prefab factory | `camelCase.ts` | `src/entities/dwarf.ts` |
| React component | `PascalCase.tsx` | `src/ui/StockScreen.tsx` |
| React hook | `useNoun.ts` | `src/ui/useGameState.ts` |
| Type definitions | `camelCase.types.ts` | `src/core/world.types.ts` |
| YAML data file | `camelCase.yaml` | `src/data/materials.yaml` |
| YAML loader | `camelCase.ts` (same name) | `src/data/loaders/materials.ts` |
| Test file | co-located or in `tests/`, same name | `tests/systems/pathfindingSystem.test.ts` |
| Integration test | `tests/integration/phaseN.test.ts` | `tests/integration/phase0.test.ts` |

---

## How to Add a New ECS Component

Follow this exact pattern every time.

**Step 1 — create the component file:**

```ts
// src/core/components/thirst.ts
import { MAX_ENTITIES } from '@core/constants'

export const Thirst = {
  current:   new Float32Array(MAX_ENTITIES),   // 0 = hydrated, 1 = dying of thirst
  decayRate: new Float32Array(MAX_ENTITIES),
}
```

**Step 2 — re-export from the barrel:**

```ts
// src/core/components/index.ts  (add one line)
export { Thirst } from './thirst'
```

**Step 3 — use in a system via the path alias:**

```ts
import { Thirst } from '@core/components/thirst'
// or
import { Thirst } from '@core/components'
```

**Rules:**
- One component per file. No exceptions.
- Component names are `PascalCase` nouns: `Position`, `Hunger`, `JobAssignment`, `CombatTarget`.
- Field names are `camelCase`: `decayRate`, `currentHealth`, `targetEid`.
- Only numeric types (`f32`, `f64`, `i32`, `i16`, `u8`, etc.). Strings/arrays → side store.
- Do not add logic to component files. They are pure data definitions.

---

## How to Add a New System

**Step 1 — create the system file:**

```ts
// src/systems/thirstSystem.ts
import { query } from 'bitecs'
import { GameWorld } from '@core/world'
import { Thirst } from '@core/components/thirst'

export function thirstSystem(world: GameWorld, dt: number): void {
  const entities = query(world, [Thirst])
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]!
    Thirst.current[eid] = Math.min(1, Thirst.current[eid] + Thirst.decayRate[eid] * dt)
  }
}
```

**Step 2 — register in the tick loop** (`src/core/tickLoop.ts` or `HeadlessGame`):

```ts
import { thirstSystem } from '@systems/thirstSystem'
// add to the systems array in the correct tick order
```

**Rules:**
- One system function per file. The file name matches the function name.
- Systems are pure: `(world: GameWorld, dt: number) => void`. No return value. No stored state.
- Queries are defined at **module level**, not inside the function (bitecs reuses the same object).
- Systems never import other systems. Order is controlled by the tick loop registration.
- No browser APIs (`window`, `document`, `canvas`, `requestAnimationFrame`) in any system file.
- No `console.log` in systems. Use a dedicated debug flag component if you need logging.

---

## Side Stores

Non-numeric entity data lives in `src/core/stores.ts`:

```ts
// src/core/stores.ts
export const nameStore      = new Map<number, string>()
export const inventoryStore = new Map<number, number[]>()   // eid → [item eids]
export const pathStore      = new Map<number, number[]>()   // eid → [tile indices]
export const jobDataStore   = new Map<number, JobData>()    // eid → current job details
```

- Keys are always entity IDs (numbers).
- Add to store in the prefab factory or an `enterQuery` callback.
- **Always clean up** in an `exitQuery` callback. Memory leaks from orphaned store entries are bugs.

---

## Prefab Factories

Entity creation logic lives in `src/entities/`. One file per entity type.

```ts
// src/entities/dwarf.ts
import { addEntity, addComponent } from 'bitecs'
import { GameWorld } from '@core/world'
import { Position } from '@core/components/position'
import { Hunger } from '@core/components/hunger'
import { nameStore } from '@core/stores'

export function createDwarf(world: GameWorld, x: number, y: number, z: number, name: string): number {
  const eid = addEntity(world)

  // v0.4: addComponent(world, eid, component) — eid before component
  addComponent(world, eid, Position)
  Position.x[eid] = x
  Position.y[eid] = y
  Position.z[eid] = z

  addComponent(world, eid, Hunger)
  Hunger.current[eid] = 0
  Hunger.decayRate[eid] = 0.001

  nameStore.set(eid, name)

  return eid  // always return the entity ID
}
```

- Factory functions are named `createNoun()` and always return the entity ID (`number`).
- Set **all** component fields immediately after `addComponent`. Never leave fields at default 0 unless 0 is intentionally correct.

---

## Map / World

- Tile data uses typed arrays (`Uint8Array`). **No object-per-tile.** Ever.
- World dimensions come from `src/core/constants.ts`. Never hardcode numbers in systems or map code.
- Z-level indexing formula: `z * WORLD_WIDTH * WORLD_HEIGHT + y * WORLD_WIDTH + x`
- All tile access goes through `getTile()` / `setTile()` in `src/map/world3d.ts`. Don't index the array directly outside that file.
- Z=0 is the surface. Underground is negative z.

---

## YAML Data

- YAML files live in `src/data/`. One file per category (`materials.yaml`, `buildings.yaml`, etc.).
- Each YAML file has a co-located Zod schema and loader in `src/data/loaders/`.
- The Zod schema is the source of truth for the TypeScript type (use `z.infer<typeof schema>`).
- Use string IDs for cross-references between YAML files: `inputMaterial: "iron_ore"` not `inputMaterialId: 3`.
- No computed values in YAML. If a value can be derived, derive it in code.
- `GameData` (exported from `src/data/index.ts`) is frozen (`Object.freeze`). Never mutate it.

```ts
// src/data/loaders/materials.ts
import { z } from 'zod'
import yaml from 'js-yaml'
import { readFileSync } from 'fs'

const MaterialSchema = z.object({
  id:       z.string(),
  name:     z.string(),
  category: z.enum(['stone', 'metal', 'soil', 'organic']),
  color:    z.string().regex(/^#[0-9a-f]{6}$/i),
  hardness: z.number().min(0).max(10),
})

export type Material = z.infer<typeof MaterialSchema>

export function loadMaterials(): Material[] {
  const raw = yaml.load(readFileSync('src/data/materials.yaml', 'utf8'))
  return z.array(MaterialSchema).parse(raw)
}
```

---

## Testing

- Every exported function or system gets tests.
- Test file location: mirror the source path under `tests/`. `src/systems/pathfindingSystem.ts` → `tests/systems/pathfindingSystem.test.ts`.
- Use Vitest globals (`describe`, `it`, `expect`). They are configured in `vite.config.ts`.
- Game logic tests run in Node — no browser, no canvas.
- Use `createWorld()` from bitecs to get an isolated ECS world per test. Never share world state between tests.
- Minimum coverage per exported item: **happy path + at least one edge/error case**.

```ts
// tests/systems/thirstSystem.test.ts
import { describe, it, expect } from 'vitest'
import { createWorld, addEntity, addComponent } from 'bitecs'
import { Thirst } from '@core/components/thirst'
import { thirstSystem } from '@systems/thirstSystem'

describe('thirstSystem', () => {
  it('increases thirst each tick', () => {
    const world = createWorld()
    const eid = addEntity(world)
    addComponent(world, eid, Thirst)   // v0.4: eid before component
    Thirst.current[eid] = 0
    Thirst.decayRate[eid] = 0.1

    thirstSystem(world, 1)   // dt = 1 second

    expect(Thirst.current[eid]).toBeCloseTo(0.1)
  })

  it('clamps at 1 (does not exceed max)', () => {
    const world = createWorld()
    const eid = addEntity(world)
    addComponent(world, eid, Thirst)
    Thirst.current[eid] = 0.95
    Thirst.decayRate[eid] = 0.1

    thirstSystem(world, 1)

    expect(Thirst.current[eid]).toBe(1)
  })
})
```

Test helpers and shared fixtures live in `tests/helpers/`.

---

## Naming Reference

| Thing | Convention | Example |
|-------|-----------|---------|
| Entity IDs (variables) | `eid`, `dwarfEid`, `itemEid` | `const dwarfEid = createDwarf(...)` |
| ECS world instance | `world` | `function fooSystem(world: GameWorld, dt: number)` |
| Tick delta | `dt` | always `dt`, never `delta` or `deltaTime` |
| Component field access | direct array access | `Position.x[eid]` |
| Constants | `SCREAMING_SNAKE_CASE` | `WORLD_WIDTH`, `TILE_SIZE`, `MAX_DWARVES` |
| YAML keys | `camelCase` | `decayRate`, `inputMaterial` |
| Enum values | `PascalCase` | `TileType.Stone`, `JobType.Mining` |

---

## Git / PRs

- Branch names: `feat/issue-NNN-short-description` or `fix/issue-NNN-short-description`
- Commit messages: imperative present tense. "Add thirst system" not "Added thirst system" or "Adding thirst system"
- One PR per issue. Body must contain `Closes #NNN`.
- PRs must pass CI (`lint` + `typecheck` + `test` + `build`) before merge.
- Squash-merge to main.
