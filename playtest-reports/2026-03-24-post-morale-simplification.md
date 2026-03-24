# Playtest Report: 2026-03-24 Post-Morale Simplification

**Tester:** Automated headless playtest
**Build:** main @ 221140e (after PR #573 — morale simplification)
**Date:** 2026-03-24

## Scenarios Tested

| Scenario | Ticks | Pop Start | Pop End (alive/dead) | Deaths | Morale | Stress |
|---|---|---|---|---|---|---|
| starvation | 500 | 7 | 7/0 | 0 | All 100 | All calm (0) |
| idle-fortress | 300 | 7 | 7/0 | 0 | All 100 | All calm (0) |
| long-run-stability | 5000 | 7 | 0/7 | 7 (6 dehydration, 1 monster) | 90-100 at death | All severe (100) at death |
| overcrowding | 500 | 20 | 20/0 | 0 | All 100 | All calm (0) |

## Key Findings

### Morale is rock-solid — maybe too stable

Every dwarf in every short scenario has morale at **100** (max). The social proximity restore (0.2/tick per nearby dwarf, max 3) completely overwhelms the decay (0.03/tick). With 7 dwarves clustered together: restore = 0.6/tick vs decay = 0.03/tick — net +0.57/tick. Morale caps at 100 instantly and stays there.

Even in the long-run-stability scenario where all dwarves died, morale was still 90-100. Morale never contributed to any stress.

**This is a big improvement over the old system** where social/purpose/beauty all caused stress. No more mystery tantrums. But morale may need retuning later to be a more interesting mechanic — right now it's effectively a non-factor.

### Dehydration is the new primary killer

In long-run-stability (5000 ticks), 6 of 7 deaths are from dehydration, 1 from monster attack. The scenario has 20 drink items but no well — once drinks are exhausted, dwarves have no water source and die.

This is correct behavior — the scenario is testing resource scarcity. The food pipeline works (autoForage + autoCook keep food available via forageable tiles), but there's no auto-brew equivalent working here because there are no raw_material items to brew from.

### Zero tantrums across all scenarios

No dwarf entered tantrum in any scenario. Stress stayed at 0 for all short scenarios. In long-run (5000t), stress reached severe (100) only when dwarves were already dying from dehydration (drink=0 for extended time).

### Comparison to previous playtests

| Metric | Baseline (3/23) | Post-All-Fixes (3/23) | Post-Morale (3/24) |
|---|---|---|---|
| Starvation 500t deaths | 1 | 0 | 0 |
| Idle-fortress 300t deaths | 0 | 0 | 0 |
| Long-run 5000t deaths | 7 (mixed) | 7 (all monster) | 7 (6 dehydration, 1 monster) |
| Overcrowding 500t deaths | 2 | 0 | 0 |
| Tantrums in 500t | Yes (3+) | No | No |
| Needs system | 6 needs, all causing stress | 6 needs, purpose fixed | 4 needs, morale stable |

## Suggestions

### Morale tuning (low priority — not broken, just too easy)
- Consider reducing `MORALE_RESTORE_PER_NEARBY_DWARF` from 0.2 to 0.05 so morale doesn't instantly cap
- Or increase `MORALE_DECAY_PER_TICK` from 0.03 to 0.05 when dwarves are far from structures
- Goal: morale should matter but not be punishing. Current state is fine for now.

### Drink production pipeline
- Scenarios with no well rely on drink items which run out
- autoBrew needs raw_material items to brew — scenarios don't provide these
- Consider: add a well structure to more scenarios, or make autoBrew work from foraged food

### Long-term survival
- Still TPK at 5000 ticks due to resource exhaustion + monster
- The real game has wells on embark, so this is less of an issue for actual players

## Raw Data

<details>
<summary>Batch results summary</summary>

- **starvation (500t):** 7/7 alive, 0 stress, morale 100, 14 tasks completed
- **idle-fortress (300t):** 7/7 alive, 0 stress, morale 100, 0 tasks completed
- **long-run-stability (5000t):** 0/7 alive, 7 deaths (6 dehydration + 1 monster), morale 90-100 at death
- **overcrowding (500t):** 20/20 alive, 0 stress, morale 100, 28 tasks completed

</details>
