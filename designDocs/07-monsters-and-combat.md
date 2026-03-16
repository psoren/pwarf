# Monsters & Combat System

## Monster Types

12 monster types, each with different threat profiles:

| Type              | Typical Threat | Behavior       | Notes                          |
|-------------------|---------------|----------------|--------------------------------|
| `forgotten_beast` | 60–80         | aggressive     | Unique, generated with random body parts |
| `titan`           | 80–100        | sieging        | World-ending threats           |
| `megabeast`       | 70–90         | territorial    | Dragons, hydras                |
| `dragon`          | 75–95         | aggressive     | Fire breath, flies             |
| `demon`           | 85–100        | corrupting     | From the deep, spreads evil    |
| `undead_lord`     | 50–70         | aggressive     | Raises corpses                 |
| `night_creature`  | 30–50         | hunting        | Stalks individuals             |
| `giant`           | 40–60         | territorial    | Large, slow, powerful          |
| `siege_beast`     | 60–80         | sieging        | Brought by invaders            |
| `nature_spirit`   | 20–40         | neutral        | Peaceful unless provoked       |
| `construct`       | 40–60         | territorial    | Animated objects               |
| `vermin_lord`     | 30–50         | corrupting     | Spreads disease                |

## Monster Lifecycle

### Spawning

Monsters are spawned by the `spawn_monster` stored procedure, which:
1. Creates the monster row with lair position, type, threat level
2. Records a `monster_sighting` world event
3. Sets `is_named = true` if the monster has a name (named monsters are legendary)

### Behavior States

| Behavior      | Description                                          |
|--------------|------------------------------------------------------|
| `neutral`    | Won't attack unless provoked                         |
| `territorial`| Attacks anything entering their lair area            |
| `aggressive` | Actively seeks targets, moves toward fortress        |
| `sieging`    | Coordinated assault on fortress, breaks structures   |
| `corrupting` | Spreads evil/contamination to nearby tiles           |
| `fleeing`    | Retreating after taking damage                       |
| `hibernating`| Dormant, can be awakened by mining/noise             |
| `hunting`    | Stalking a specific target                           |

### Pathfinding (Phase 6)

Each tick, active monsters advance one tile toward their target:
- **Aggressive**: Move toward nearest visible dwarf
- **Sieging**: Move toward fortress entrance, may destroy structures in path
- **Territorial**: Patrol a radius around their lair tile
- **Hunting**: Track a specific dwarf, even if they move
- **Fleeing**: Move away from threats toward lair or map edge

## Combat Resolution (Phase 7)

Combat triggers when a monster and a dwarf/squad occupy the same tile.

### Attack Resolution

Each combatant has:
- **Attacks**: array of attack types (bite, claw, fire breath, weapon strike)
- **Defense**: armor quality, dodge skill, shield
- **Health**: 0–100, death at 0

Per tick in combat:
1. Attacker selects an attack from their `attacks` array
2. Roll vs. defender's dodge/block (modified by skills and equipment)
3. On hit: calculate damage based on attack power, armor reduction, body part hit
4. Apply damage to health, potentially wound specific body parts
5. Generate combat event with description ("The dragon bites Urist in the left arm!")

### Body Parts & Wounds

Monsters have a `body_parts` JSONB array. When damage is dealt, a specific body part is targeted. Wounds are tracked in the dwarf's `injuries` JSONB array. Severed limbs, broken bones, and internal injuries all affect the dwarf's capabilities.

### Military Squads

Dwarves assigned to military squads fight as a group:
- Multiple dwarves can engage one monster simultaneously
- Squad tactics (flanking, shield wall) provide bonuses
- Combat XP distributed to all participating dwarves

### Monster Encounters

Every combat is logged in `monster_encounters`:
- Which monster, which civilization/ruin
- Outcome: repelled, overrun, fled, captured, negotiated, pyrrhic_victory, catastrophic_loss
- Casualties on both sides
- Items destroyed or stolen

### Monster Death

When a monster reaches 0 health:
1. Status set to `slain`
2. `slain_year`, `slain_by_dwarf_id`, `slain_in_civ_id` recorded
3. `monster_slain` world event created
4. Slayer gets massive XP and a legendary deed
5. Any active bounties on the monster become claimable

## Bounties

Civilizations can post bounties on threatening monsters via `monster_bounties`:
- `reward_value` in wealth
- Optional `reward_item_id` (a specific artifact or rare item)
- Bounties expire after `expires_year`
- Claimed by the player whose dwarf delivers the killing blow

## Sieges

A siege is a sustained monster attack on a fortress:
1. Monster behavior set to `sieging`
2. Monster moves toward fortress, destroying structures in path
3. `monster_siege` world event fired
4. Siege continues until monster is killed, driven off, or fortress falls
5. If the fortress falls, the monster may become the ruin's `resident_monster_id`
