import {
  MONSTER_ATTACK_BASE,
  DWARF_ATTACK_BASE,
  COMBAT_DAMAGE_SPREAD,
  XP_MONSTER_KILL,
} from "@pwarf/shared";
import type { Dwarf, Monster } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import type { Rng } from "../rng.js";
import { killDwarf } from "./deprivation.js";

/**
 * Combat Resolution Phase
 *
 * When a monster and a dwarf occupy the same tile, both attack each other.
 * Each combatant deals (base ± spread) damage per tick, scaled by threat level
 * for monsters and XP-level for dwarves.
 *
 * Death handling:
 * - Dwarf reaches 0 health → killDwarf (cause: "monster attack")
 * - Monster reaches 0 health → status "slain", XP to killer, world event
 */
export async function combatResolution(ctx: SimContext): Promise<void> {
  const { state, rng } = ctx;

  const activeMonsters = state.monsters.filter(m => m.status === 'active');
  if (activeMonsters.length === 0) return;

  const aliveDwarves = state.dwarves.filter(d => d.status === 'alive');
  if (aliveDwarves.length === 0) return;

  for (const monster of activeMonsters) {
    if (monster.current_tile_x === null || monster.current_tile_y === null) continue;

    // Find all dwarves sharing this tile
    const combatants = aliveDwarves.filter(
      d => d.position_x === monster.current_tile_x && d.position_y === monster.current_tile_y,
    );
    if (combatants.length === 0) continue;

    // Pick one dwarf at random to be the primary target this tick
    const target = combatants[rng.int(0, combatants.length - 1)]!;

    // Fire a battle event the first time this monster/dwarf pair engage
    const combatPairKey = `${monster.id}:${target.id}`;
    if (!state.activeCombatPairs.has(combatPairKey)) {
      state.activeCombatPairs.add(combatPairKey);
      state.pendingEvents.push({
        id: rng.uuid(),
        world_id: ctx.worldId,
        year: ctx.year,
        category: 'battle',
        civilization_id: ctx.civilizationId,
        ruin_id: null,
        dwarf_id: target.id,
        item_id: null,
        faction_id: null,
        monster_id: monster.id,
        description: `${target.name} fought the ${monster.name}!`,
        event_data: {
          monster_type: monster.type,
          dwarf_id: target.id,
          tile_x: monster.current_tile_x,
          tile_y: monster.current_tile_y,
        },
        created_at: new Date().toISOString(),
      });
    }

    // Monster attacks dwarf
    const monsterDmg = rollDamage(
      rng,
      MONSTER_ATTACK_BASE + Math.floor(monster.threat_level / 10),
      COMBAT_DAMAGE_SPREAD,
    );
    target.health = Math.max(0, target.health - monsterDmg);
    state.dirtyDwarfIds.add(target.id);

    if (target.health <= 0) {
      killDwarf(target, 'monster attack', ctx);
      // When all combatants on this tile die, monster can keep moving next tick
      continue;
    }

    // Dwarf attacks monster — damage scales slightly with a fighting skill if present
    const fightingSkill = state.dwarfSkills.find(
      s => s.dwarf_id === target.id && s.skill_name === 'fighting',
    );
    const skillBonus = fightingSkill ? Math.floor(fightingSkill.level / 2) : 0;
    const dwarfDmg = rollDamage(rng, DWARF_ATTACK_BASE + skillBonus, COMBAT_DAMAGE_SPREAD);
    monster.health = Math.max(0, monster.health - dwarfDmg);

    if (monster.health <= 0) {
      slayMonster(monster, target, ctx);
    }
  }
}

/**
 * Roll damage: base ± spread.
 * Exported for unit testing.
 */
export function rollDamage(rng: Rng, base: number, spread: number): number {
  return Math.max(1, base + rng.int(-spread, spread));
}

function slayMonster(monster: Monster, killer: Dwarf, ctx: SimContext): void {
  const { state, rng } = ctx;

  // Clear all combat pairs for this monster
  for (const key of state.activeCombatPairs) {
    if (key.startsWith(`${monster.id}:`)) {
      state.activeCombatPairs.delete(key);
    }
  }

  monster.status = 'slain';
  monster.slain_year = ctx.year;
  monster.slain_by_dwarf_id = killer.id;
  monster.slain_in_civ_id = ctx.civilizationId;

  // Award XP to the killer — create/update fighting skill record
  const existing = state.dwarfSkills.find(
    s => s.dwarf_id === killer.id && s.skill_name === 'fighting',
  );
  if (existing) {
    existing.xp += XP_MONSTER_KILL;
    const newLevel = Math.floor(existing.xp / 100);
    if (newLevel > existing.level && newLevel <= 20) {
      existing.level = newLevel;
    }
  } else {
    state.dwarfSkills.push({
      id: rng.uuid(),
      dwarf_id: killer.id,
      skill_name: 'fighting',
      level: 0,
      xp: XP_MONSTER_KILL,
      last_used_year: ctx.year,
    });
  }

  state.pendingEvents.push({
    id: rng.uuid(),
    world_id: ctx.worldId,
    year: ctx.year,
    category: 'monster_slain',
    civilization_id: ctx.civilizationId,
    ruin_id: null,
    dwarf_id: killer.id,
    item_id: null,
    faction_id: null,
    monster_id: monster.id,
    description: `${killer.name} ${killer.surname} slew the ${monster.name}!`,
    event_data: {
      monster_type: monster.type,
      killer_id: killer.id,
      xp_awarded: XP_MONSTER_KILL,
    },
    created_at: new Date().toISOString(),
  });
}
