# Playtest Report: 2026-03-23 Post-All-Fixes

**Tester:** Automated headless playtest
**Build:** main @ 5447058 (after PRs #530, #553, #554, #555, #556)
**Date:** 2026-03-23

## Scenarios Tested

| Scenario | Ticks | Pop Start | Pop End (alive/dead) | Deaths | Key Observations |
|---|---|---|---|---|---|
| starvation | 500 | 7 | 7/0 | 0 | All alive, stress calm, foraging working |
| idle-fortress | 300 | 7 | 7/0 | 0 | All alive, stress calm, needs declining slowly |
| long-run-stability | 5000 | 7 | 0/7 | 7 (all monster attack) | TPK after peace period ends |
| overcrowding | 500 | 20 | 20/0 | 0 | All alive (JSON truncation issue in output) |

## Comparison to Baseline (2026-03-23)

| Metric | Baseline | Post-All-Fixes | Change |
|---|---|---|---|
| Starvation 500t deaths | 1 (monster) | 0 | **Fixed** |
| Idle-fortress 300t deaths | 0 | 0 | Same |
| Long-run 5000t deaths | 7 (4 monster, 3 dehydration) | 7 (all monster) | Dehydration deaths eliminated |
| Overcrowding 500t deaths | 2 (monster) | 0 | **Fixed** |
| Day counter at tick 5000 | 5001 (bug) | 103 (correct) | **Fixed** |
| Personality traits | All null | Randomized 0.1-0.9 | **Fixed** |
| Dwarf skills | None | All 7 skills | **Fixed** |
| Tantrum on dead dwarves | true | false | **Fixed** |
| Need lockstep | All identical | Randomized ±10-20 | **Fixed** |

## Balance Issues

### 1. Monster attacks are the sole cause of death (HIGH)

All 7 deaths in long-run-stability are from monster attacks. No dwarves die of starvation or dehydration — the food/drink pipeline (autoForage + eat/drink interrupts) is working. The peace period (1000 ticks) gives a safe early game, but once monsters start spawning at tick 1000, each spawn kills a dwarf since there's no military system.

**Suggestion:** Either increase `MONSTER_SPAWN_INTERVAL` further (750-1000), reduce monster health/damage, or implement basic military/guard behavior.

### 2. Purpose need still declines for idle dwarves (MEDIUM)

Purpose shows `low (32-49)` in short scenarios. The idle restore (0.02/tick) partially offsets decay (0.04/tick) but doesn't prevent decline. Working dwarves (those completing tasks) get purpose restored via `restorePurposeNeed`, but idle dwarves slowly lose it.

The net effect is manageable — no one hits critical purpose in 500 ticks.

### 3. Food need gets low but doesn't kill (MEDIUM)

In starvation scenario (3 food, 20 drink), food drops to `low (36-49)` but autoForage + drink availability keeps everyone alive. The system is working as designed — scarce food creates tension without immediate death.

## What's Working Well

1. **Need satisfaction pipeline** — Dwarves eat, drink, and sleep autonomously
2. **autoForage** — Kicks in when food is scarce, creates forage tasks targeting grass/bush/tree tiles
3. **Monster peace period** — First 1000 ticks are safe for establishment
4. **Randomized needs** — Dwarves no longer all hit thresholds simultaneously
5. **Skills** — Dwarves can claim all task types (mining, building, farming, etc.)
6. **Day counter** — Correct calculation using STEPS_PER_DAY

## Bugs

1. **Overcrowding JSON truncation** — The overcrowding scenario (20 dwarves) produces output too large for the JSON parser in `playtest-all.mjs`. The data is valid but gets cut off.
2. **events_count always 0** — No world events fire in any scenario across 5000 ticks. Strange moods, disease, relationships, etc. appear to not run in headless mode.

## Suggestions

### Critical
1. Improve monster combat balance — dwarves need a way to survive monster encounters (military, flee behavior, or weaker monsters)

### High
2. Wire event systems (strange moods, disease, relationships) into headless/scenario tick pipelines
3. Consider increasing `MONSTER_SPAWN_INTERVAL` to 750+ or scaling by population

### Medium
4. Fix overcrowding JSON output truncation
5. Add a "peaceful" scenario variant with no monster spawning for testing non-combat systems

## Raw Data

<details>
<summary>Batch results (click to expand)</summary>

- **starvation (500t):** 7/7 alive, 0 deaths, 14 tasks completed, stress calm
- **idle-fortress (300t):** 7/7 alive, 0 deaths, 0 tasks completed, stress calm
- **long-run-stability (5000t):** 0/7 alive, 7 deaths (all monster attack), 38 tasks completed
- **overcrowding (500t):** 20/20 alive, 0 deaths, 25 tasks completed (JSON truncated)

</details>
