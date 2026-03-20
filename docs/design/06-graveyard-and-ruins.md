# Graveyard & Ruins System

## Overview

When a fortress falls, it becomes a ruin. Ruins can be published to a global graveyard that all players can browse, explore, and loot. This is the only multiplayer interaction — through the ruins left behind by real people.

## Fortress Death → Ruin Conversion

When a civilization falls (via the `fossilize_civilization` stored procedure):

1. A `ruins` row is created with:
   - Snapshot of the fortress at death (layout, items, structures)
   - Cause of death (siege, flood, magma, starvation, tantrum spiral, etc.)
   - Peak population, original wealth, ghost count
   - Danger level (0–100, based on cause + remaining monsters)
2. The civilization status is set to `fallen`
3. A `fortress_fallen` world event is recorded
4. Player sees their epitaph and is offered the option to **publish**

## Publishing

Publishing a ruin sets `is_published = true` on the ruins row. Published ruins enter the global graveyard — visible to all players.

**Key rule**: A player cannot loot their own published ruins. Enforced at the RLS level:

```sql
create policy "players cannot expedition own ruins"
  on expeditions for insert with check (
    ruin_id not in (
      select r.id from ruins r
      join civilizations c on c.id = r.civilization_id
      where c.player_id = auth.uid()
    )
  );
```

This prevents farming deaths for easy loot and keeps the graveyard meaningful.

## Ruin Properties

| Column              | Type    | Description                                    |
|--------------------|---------|------------------------------------------------|
| `danger_level`     | 0–100   | How dangerous the ruin is to explore           |
| `is_contaminated`  | boolean | Plague/corruption still active                 |
| `contamination_type`| text   | What kind of contamination                     |
| `ghost_count`      | int     | Dead dwarves haunting the ruin                 |
| `is_trapped`       | boolean | Mechanical traps still active                  |
| `resident_monster_id` | uuid | A monster has moved in after the fortress fell |
| `remaining_wealth` | bigint  | Lootable value left (decreases as looted)      |

Ruins decay over time — `remaining_wealth` decreases, structures crumble, but danger may increase as monsters move in.

## Expeditions

Any player can launch an expedition into a published ruin (except their own):

1. Select dwarves to send (from their active civilization)
2. Expedition status progresses: `traveling → active → looting → retreating → complete`
3. During the expedition, dwarves face the ruin's dangers (traps, ghosts, monsters, contamination)
4. Survivors return with looted items
5. `dwarves_lost` tracks casualties; `items_looted` tracks gains

Expeditions are tracked in the `expeditions` table with a unique constraint on `(player_id, ruin_id)` — one expedition per player per ruin.

## Graveyard UI

The graveyard is accessed from the World Map mode's right panel (Legends tab):
- Browse all published ruins sorted by danger, wealth, age, or cause of death
- Read the history of each ruin — its founding, notable events, how it fell
- View the roster of dead dwarves and their stories
- Launch an expedition from the graveyard browser

## Ruin on the World Map

After a fortress falls:
- The player's own past ruins appear on their world map as `†` glyphs
- Published ruins from other players are visible in the graveyard browser but not on the player's world map (each world is private)
- The ruin tile retains its position (`tile_x`, `tile_y`) in the original world
