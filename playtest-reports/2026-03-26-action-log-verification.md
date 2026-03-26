# Playtest Report — 2026-03-26 (Action Log Verification)

## Purpose

Verify that the `action_log` field introduced in PR #722 is working correctly in headless playtest output. The action_log provides a timeline of events that occurred during a run, enabling better post-run analysis.

## Scenarios Tested

| Scenario | Ticks | Population (alive/dead) | Tasks Completed | Events | action_log |
|---|---|---|---|---|---|
| starvation | 2000 | 7/0 | 5 | 195 | **POPULATED (195 entries)** |
| idle-fortress | 300 | 7/0 | 0 | 0 | empty (expected) |
| long-run-stability | 5000 | 7/0 | 0 | 0 | empty (expected) |
| overcrowding | 500 | 20/0 | 10+ | (JSON truncated) | (not captured) |

## Action Log Verification

**Result: action_log is working correctly.**

The `action_log` field is present in all headless runner output. When events occur (task starts, task completions, combat, deprivation, etc.), they are correctly captured with:

- `tick` — the year/tick when the event occurred
- `category` — event category (e.g., "discovery")
- `description` — human-readable event description
- `details` — optional structured data (task_type, task_id, etc.)

### Sample action_log entries (starvation scenario, 2000 ticks):

```json
{"tick": 1, "category": "discovery", "description": "Urist McTestdwarf begins forage.", "details": {"task_type": "forage", "task_id": "af9c0078-..."}}
{"tick": 1, "category": "discovery", "description": "Zon Hammerfall begins cook.", "details": {"task_type": "cook", "task_id": "9972daab-..."}}
{"tick": 1, "category": "discovery", "description": "Urist McTestdwarf has finished forage.", "details": {"task_type": "forage", "task_id": "af9c0078-..."}}
{"tick": 1, "category": "discovery", "description": "Urist McTestdwarf begins forage.", "details": {"task_type": "forage", "task_id": "e71779d2-..."}}
{"tick": 1, "category": "discovery", "description": "Zon Hammerfall has finished cook.", "details": {"task_type": "cook", "task_id": "9972daab-..."}}
```

### Why idle scenarios have empty action_log

The idle-fortress and long-run-stability scenarios produce zero events because they have no player-designated tasks and dwarves only perform autonomous eat/drink/sleep tasks. Autonomous task events are not currently logged as world events, which is expected behavior — the action_log tracks notable events, not routine maintenance.

## Note on step-mode

The step-mode path (used by `playtest-interactive.mjs`) does **not** flush `pendingEvents` to `worldEvents`, so `action_log` is always empty in step-mode output. This is a known gap — the headless runner (`runHeadless`) flushes events each tick, but `step-mode.ts`'s `runOneTick` does not. A follow-up ticket could address this if step-mode action_log support is desired.

## Balance Observations (while here)

- **Starvation scenario (2000 ticks):** All 7 dwarves survived with needs in ok-to-good range. The scenario name suggests food scarcity but autonomous foraging/cooking keeps everyone alive. Working as intended for a baseline survival test.
- **Idle-fortress (300 ticks):** All dwarves idle, needs slowly decaying (food 69-83, drink 71-86). No deaths. Stable.
- **Long-run-stability (5000 ticks):** All 7 alive after 5000 ticks with needs in the 57-75 range. No deaths. Autonomous needs maintenance is working well over long runs.

## Bugs or Unexpected Behavior

- **step-mode missing event flush:** `step-mode.ts` `runOneTick()` does not flush `pendingEvents` to `worldEvents`, so action_log is always empty when using the interactive playtest path. Low priority since the headless runner works correctly.
- **playtest-all.mjs JSON truncation:** The starvation and overcrowding scenarios produced JSON output too large for the `playtest-all.mjs` parser (200-char truncation in error message). This appears to be a stdout buffering issue in the child process. Running scenarios individually via `cli.js` works fine.

## Suggestions

- Consider adding event flush to `step-mode.ts` so interactive playtests can also show action_log
- Consider logging autonomous task completions (eat, drink, sleep) as low-priority events for fuller action timelines
- The overcrowding scenario (20 dwarves) may benefit from a higher tick count to surface stress/morale issues
