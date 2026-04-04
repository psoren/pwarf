> **Status:** Partial
> **Last verified:** 2026-04-04

# 18. Terrain Effects

## Overview

Terrain types have distinct gameplay effects beyond cosmetics. Dwarves standing on different tile types receive morale bonuses or penalties each tick, making terrain choice strategically meaningful.

## Tile Beauty (Implemented)

Each tick, `restoreMorale()` checks the tile type under a dwarf and applies a per-tick morale (need_social) modifier. The openness personality trait scales this effect.

### Beauty Values

| Tile Type | Per-tick Modifier | Notes |
|---|---|---|
| `mushroom_garden` | +0.08 | Cultivated beauty (stacks with structure bonus) |
| `tree` | +0.06 | Natural beauty |
| `bush` | +0.05 | Natural growth |
| `grass` | +0.04 | Pleasant natural ground |
| `cave_mushroom` | +0.03 | Underground charm |
| `constructed_floor` | +0.01 | Clean, orderly |
| `sand` | -0.01 | Barren |
| `ice` | -0.02 | Cold and unwelcoming |
| `cavern_floor` | -0.02 | Dark underground |
| `mud` | -0.03 | Ugly, depressing |

Tiles not listed (e.g. `soil`, `rock`, `open_air`) have zero beauty effect.

### Personality Interaction

The openness trait scales tile beauty the same way it scales structure beauty:

```
effective_beauty = tile_beauty * (1 + (openness - 0.5) * OPENNESS_BEAUTY_MULTIPLIER)
```

- Openness 1.0: 1.5x beauty effect (appreciates surroundings more)
- Openness 0.5: 1.0x (no modification)
- Openness 0.0: 0.5x (unmoved by surroundings)

### Negative Morale

Tile beauty can push `totalRestore` negative (e.g. standing on mud with no nearby dwarves or structures). In this case, `need_social` decreases but never drops below 0.

## Movement Cost (Planned)

Movement speed modifiers for different terrain types are planned but not yet implemented. This would make pathfinding terrain-aware, adding strategic depth to fortress layout.

## Key Files

- `shared/src/constants.ts` -- `TILE_BEAUTY` constant
- `sim/src/phases/need-satisfaction.ts` -- `restoreMorale()` applies tile beauty
- `sim/src/__tests__/needs-restoration.test.ts` -- unit tests
- `sim/src/__tests__/terrain-beauty-scenario.test.ts` -- scenario test
