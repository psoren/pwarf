# Dwarf Needs & Stress System

> **Status:** Implemented
> **Last verified:** 2026-03-25

## Overview

Every dwarf has six need meters and a stress level. Needs decay over time, stress rises when needs are unmet, and tantrums trigger when stress exceeds a threshold. This is the core behavioral driver — everything a dwarf does flows from their needs.

## Need Meters

Each need is an integer from 0 (critical) to 100 (fully satisfied):

| Need       | Default | Decay Rate | Satisfied By                        |
|------------|---------|-----------|--------------------------------------|
| `food`     | 80      | Slow      | Eating at a food stockpile           |
| `drink`    | 80      | Medium    | Drinking at a drink stockpile/well   |
| `sleep`    | 80      | Medium    | Sleeping in a bed or on the floor    |
| `social`   | 50      | Very slow | Being near other dwarves, meeting hall |
| `purpose`  | 50      | Very slow | Completing jobs, creating artifacts   |
| `beauty`   | 50      | Very slow | Being near engravings, fine furniture  |

### Decay Mechanics

Needs decay every sim tick (Phase 1: `needs-decay`). Decay rates per tick:
- **Drink**: 0.0033/tick (runs out from 80 in ~24,242 ticks, ~40 real min)
- **Food**: 0.0022/tick (runs out from 80 in ~36,364 ticks, ~60 real min)
- **Sleep**: 0.0022/tick
- **Social**: 0.0014/tick
- **Purpose**: 0.0011/tick
- **Beauty**: 0.0008/tick (slowest — takes ~100,000 ticks to fully deplete from 80)

These rates are tunable and should be constants, not hardcoded.

### Satisfaction Mechanics

In Phase 3 (`need-satisfaction`), dwarves near appropriate sources consume resources:
- Must be on or adjacent to the source tile
- Consuming food/drink depletes the stockpile item
- Sleeping requires an unoccupied bed (or they sleep on the floor for reduced benefit)
- Social satisfaction comes from proximity to other dwarves
- Purpose comes from completing work (handled in `task-execution`)
- Beauty comes from being near high-quality engravings or furniture

## Stress

Stress is an integer from 0 (calm) to 100 (breaking point). Stored in `dwarves.stress_level`.

### Stress Inputs (Phase 4: `stress-update`)

**Stress increases from:**
- Any need below 30: +0.1 stress/tick per critically low need
- Any need at 0: +0.3 stress/tick
- Negative memories: witnessing death (+15 immediate), sleeping outside (+5), being attacked (+10)
- Personality: high `trait_neuroticism` amplifies all stress gains
- Grief: death of a spouse/friend/child adds large one-time stress

**Stress decreases from:**
- All needs above 50: -0.05 stress/tick
- Positive memories: completing a masterwork (-10), attending a party (-5)
- Personality: high `trait_agreeableness` provides passive stress reduction
- Socializing: being in a meeting hall with friends reduces stress

### Tantrum Threshold

When `stress_level >= 80` (the `STRESS_TANTRUM_THRESHOLD` constant), the dwarf may enter a tantrum during Phase 5.

### Tantrum Effects

Tantrums are not instant — they play out over multiple ticks:
- **Mild (stress 80–89)**: Dwarf throws items, refuses to work for ~1800 ticks (~1 in-game day)
- **Moderate (stress 90–95)**: Dwarf destroys nearby items, may punch another dwarf. Lasts ~3600 ticks (~2 in-game days)
- **Severe (stress 96–100)**: Dwarf goes berserk — attacks others indiscriminately until subdued or killed. Lasts ~7200 ticks (~4 in-game days)

### Tantrum Spirals

The classic DF failure mode. When a dwarf dies in a tantrum, other dwarves who witness it gain stress from the death memory, potentially pushing them over the threshold → more tantrums → more deaths → fortress collapse. This cascade is intentional and emergent from the system.

## Personality Traits (OCEAN Model)

Each dwarf has five personality traits stored as smallints:

| Trait                | Column                     | Effect on Behavior                    |
|---------------------|---------------------------|---------------------------------------|
| Openness            | `trait_openness`           | Tolerance for change, interest in art |
| Conscientiousness   | `trait_conscientiousness`  | Work speed, job reliability           |
| Extraversion        | `trait_extraversion`       | Social need decay rate, party benefit |
| Agreeableness       | `trait_agreeableness`      | Passive stress reduction, conflict avoidance |
| Neuroticism         | `trait_neuroticism`        | Stress gain multiplier, tantrum severity |

Traits are assigned at dwarf creation (birth or immigration) and never change. They modify the rates in the needs/stress system but don't override them — a dwarf with low neuroticism can still have a tantrum if conditions are bad enough.

## Memories

Stored as a JSONB array in `dwarves.memories`. Each memory has:
- `type`: what happened (e.g., "witnessed_death", "created_masterwork")
- `year` / `day`: when it happened
- `intensity`: emotional weight (-100 to +100)
- `subject_id`: reference to involved entity (dwarf, item, etc.)
- `decay`: how many ticks until the memory fades (old memories stop affecting stress)

Memories are the bridge between events and stress. When something happens (a death, a siege, a beautiful engraving), a memory is created on affected dwarves. The stress-update phase reads active memories and factors them into stress calculation.
