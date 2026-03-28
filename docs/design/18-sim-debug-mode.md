> **Status:** Implemented
> **Last verified:** 2026-03-26

# 18 — Sim Debug Mode

Optional debug logging for the sim engine. When enabled, collects structured log entries that surface pathfinding failures, stuck tasks, and per-tick timing.

## Enabling

**In the browser:**
```js
window.simDebug(true)   // enable — entries appear as console.warn
window.simDebug(false)  // disable
```

**In scenarios:**
```ts
const result = await runScenario({ ..., debug: true });
result.debugEntries; // DebugEntry[]
```

**In SimRunner:**
```ts
runner.setDebug(true);
// or set runner.debugEnabled = true before start()
```

## Log categories

| Category | When it fires | Data |
|---|---|---|
| `pathfinding` | BFS/A* returns null for a dwarf's task | dwarf name, start/goal positions, distance, task type |
| `task_failure` | A task is abandoned (failTask) | dwarf name, task ID/type, reason string |
| `task_cycle` | Same task fails ≥ 3 times | task ID/type, failure count, last failure reason |
| `tick_timing` | Every tick (when debug on) | total ms, per-phase breakdown |

## Architecture

- `sim/src/debug.ts` — `DebugLogger` class and convenience helpers
- `SimContext.debug` — optional field, phases check before logging
- Zero overhead when disabled — all debug calls check `ctx.debug` and no-op
- `SimSnapshot.debugEntries` — drained per-tick for live UI consumption
- `ScenarioResult.debugEntries` — accumulated across the full run for test assertions
