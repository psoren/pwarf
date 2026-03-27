> **Status:** Implemented
> **Last verified:** 2026-03-26

# 14 — Sim Performance Optimizations

## Problem

The sim engine runs at 10 ticks/second (`STEPS_PER_SECOND = 10`). Profiling with 7 dwarves, stockpiles, and sustained mining + hauling showed:

- **34ms/tick** after 3000 ticks (should be <5ms)
- **7.4x degradation** over time
- `taskExecution` phase consumed **81% of CPU**

Root causes: uncached pathfinding through simplex noise, unbounded task array growth, and O(n) linear lookups by task ID.

## Fix 1: Tile Derivation Cache

### How it works

`FortressDeriver.deriveTile(x, y, z)` is a pure function — given the same coordinates and the same deriver instance, it always returns the same `{ tileType, material }`. The deriver uses simplex noise internally, which is expensive.

A permanent `Map<string, DerivedFortressTile>` cache lives inside the `createFortressDeriver()` closure in `shared/src/fortress-gen-helpers.ts`. The actual derivation logic is extracted into a local `deriveTileUncached()` function, and the public `deriveTile()` method checks the cache first:

```
deriveTile(x, y, z)
  └─ cache hit? → return cached result
  └─ cache miss? → deriveTileUncached(x, y, z) → store in cache → return
```

### Why this is safe

- `deriveTile` is pure: noise functions and cave grids are captured in the closure at creation time and never mutated.
- `buildTileLookup()` in `sim/src/tile-lookup.ts` always checks `fortressTileOverrides` (mutable Map of mined/built tiles) **before** calling `deriveTile`. So tile overrides created mid-tick (e.g., a mine completing) are always visible — the cache only stores the immutable "natural" tile, not the override.
- The cache is bounded by map size: 512x512 surface + up to 5 caves of 128x128 = ~344K max entries (~4MB). In practice, dwarves explore a small area — expect 5K-20K cached tiles.
- When the deriver object is garbage-collected (e.g., sim restart with a different world), the cache goes with it.

### Impact

Pathfinding visits up to 10,000 nodes (BFS, distance ≤50) or 20,000 nodes (A*, distance >50) per call. With 7 dwarves making ~2 pathfinding calls each per tick, that's up to ~140,000 `deriveTile` calls per tick. After the first search explores an area, subsequent searches in the same region hit the cache with >90% hit rate, eliminating almost all noise computation.

## Fix 2: Task ID Index

### How it works

`CachedState` in `sim/src/sim-context.ts` now includes a `taskById: Map<string, Task>` index alongside the existing `tasks: Task[]` array. The array is kept for iteration (filter, for-of), while the Map enables O(1) lookups by ID.

A `getTaskById(state, id)` helper function in `sim-context.ts` checks the Map first, then falls back to a linear array scan if the Map misses (auto-syncing on miss). This fallback handles cases where tasks are assigned directly to `state.tasks` without updating the index (common in tests).

### Sync points

The index is updated at these locations:

| Operation | Location | Mechanism |
|-----------|----------|-----------|
| Task creation | `task-helpers.ts:createTask()` | `state.taskById.set(task.id, task)` |
| Polling new tasks | `sim-runner.ts:pollNewTasks()` | `state.taskById.set(task.id, task)` |
| Initial load | `load-state.ts` | Built from loaded tasks array |
| Scenario setup | `run-scenario.ts`, `sim-context.ts:createTestContext()` | Rebuilt from tasks array |
| Post-prune | `flush-state.ts:pruneTerminalTasks()` | Full rebuild |

Since `Task` objects are shared by reference between the array and the Map, mutations to task properties (status, work_progress, etc.) are automatically visible in both.

### Migrated callers

These hot-path `state.tasks.find(t => t.id === ...)` calls now use `getTaskById()`:

- `phases/task-execution.ts` — per dwarf per tick (hottest path)
- `phases/need-satisfaction.ts` — per dwarf interrupt check
- `phases/deprivation.ts` — death check
- `phases/expedition-tick.ts` — expedition cleanup
- `phases/tantrum-check.ts` — tantrum start
- `phases/yearly-rollup.ts` — yearly death cleanup
- `state-serializer.ts` — snapshot serialization
- `step-mode.ts` — interactive command handling

## Fix 3: Task Pruning

### How it works

Terminal tasks (`completed`, `cancelled`, `failed`) accumulate in `state.tasks` because the sim never removes them. Over a long session, this array grows into hundreds of entries, making every `.find()`, `.filter()`, and loop iteration slower.

`pruneTerminalTasks()` in `flush-state.ts` removes terminal tasks that:

1. Are in a terminal status (completed, cancelled, failed)
2. Are **not** referenced by any live dwarf's `current_task_id`
3. Are **not** dirty (not modified this tick — already flushed to DB in a previous cycle)
4. Are **not** in `newTasks` (not yet flushed at all)

### When it runs

Pruning runs at the **start** of `doFlush()`, before collecting dirty entities. This ensures:

- Tasks that just completed this tick are flushed to DB first (they're dirty), then pruned on the next flush cycle.
- The DB always has the complete history. Pruning only affects the in-memory array.

### Impact

Without pruning, `state.tasks` grows unboundedly (~3 autonomous tasks per dwarf per ~30 ticks). With 7 dwarves over 3000 ticks, that's ~700+ accumulated tasks. After pruning, the array stays near the count of active tasks (~10-30).

## Fix 4 — Cave mining performance (path caching + numeric keys)

Underground mining was extremely slow (~83ms/tick vs ~1ms/tick for surface mining) because:

1. **Pathfinding recomputed from scratch every tick.** A* with 20k node limit × 5 dwarves × ~6 tile lookups per node = ~600k Map lookups per tick.
2. **String key allocation.** `posKey()` created a template string `${x},${y},${z}` per node, and the tile derivation cache used string keys. Hundreds of thousands of string allocations per tick.
3. **Snapshot array rebuilt every tick.** `SimRunner.tick()` spread `fortressTileOverrides.values()` into a new array every tick, even when tiles hadn't changed.

### Fixes

- **Path caching** (`pathCache` on `CachedState`): When a dwarf pathfinds to a task target, the full path is cached keyed by dwarf ID. Subsequent ticks pop the next step from the cache instead of recomputing A*. The cache is invalidated when tiles change, the next step is occupied, or the task changes.
- **Numeric position keys** (`posKey` returns `(z+20)*262144 + y*512 + x`): Replaces string template keys in BFS/A* visited sets, parent maps, and the fortress deriver's tile cache. ~40% faster Map operations.
- **Cave pre-warming** (`warmCaveCache(z)`): Called during `completeScoutCave` so the expensive cellular automata + noise generation happens at scout completion, not during the first pathfinding tick.
- **Stable snapshot array** (`fortressTileOverridesVersion`): The tile override array is only rebuilt when tiles actually change, preventing unnecessary React re-renders on the app side.
- **Selective DB cache eviction**: App-side tile cache uses targeted eviction (only changed tiles) instead of clearing all 20k entries on every DB poll.

### Impact

Cave mining dropped from **83ms/tick** to **~1ms/tick** (warm) with 5 dwarves and 15 mine tasks. 60/62 tasks complete within 1000 ticks (vs 0 before).

## Key files

| File | Change |
|------|--------|
| `shared/src/fortress-gen-helpers.ts` | Tile derivation cache in `createFortressDeriver()` |
| `sim/src/sim-context.ts` | `taskById` on `CachedState`, `getTaskById()` helper |
| `sim/src/flush-state.ts` | `pruneTerminalTasks()` |
| `sim/src/task-helpers.ts` | Index sync in `createTask()` |
| `sim/src/phases/task-execution.ts` | Uses `getTaskById()` |
| `sim/src/phases/need-satisfaction.ts` | Uses `getTaskById()` |
| `sim/src/tile-lookup.ts` | Unchanged — benefits from cache transparently |
| `sim/src/pathfinding.ts` | Numeric `posKey()`, `findFullPath()` for path caching |
| `sim/src/phases/task-execution.ts` | Path cache integration in `moveTowardTarget()` |
| `sim/src/sim-runner.ts` | Stable tile override snapshot (version tracking) |
| `app/src/hooks/useFortressTiles.ts` | Selective DB override eviction |
