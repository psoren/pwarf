import {
  DISEASE_OUTBREAK_CHANCE,
  DISEASE_SPREAD_CHANCE,
  DISEASE_SPREAD_CHANCE_WITH_WELL,
  DISEASE_HEALTH_DAMAGE_PER_YEAR,
  DISEASE_RECOVERY_CHANCE,
  DISEASE_SPREAD_RADIUS,
} from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { dwarfName } from "../dwarf-utils.js";
import { applyWitnessStress } from "./deprivation.js";
import { createGriefFriendMemories, createWitnessDeathMemories } from "../dwarf-memory.js";

/**
 * Returns true if the fortress has at least one completed well structure.
 * Wells reduce disease spread by providing clean water access.
 */
export function hasWell(ctx: SimContext): boolean {
  return ctx.state.structures.some(s => s.type === 'well' && s.completion_pct >= 100);
}

/**
 * Disease Phase (called from yearlyRollup)
 *
 * Each year:
 * 1. Roll for a new outbreak (if no current infections)
 * 2. Spread disease to adjacent dwarves
 * 3. Deal health damage to infected dwarves (and kill on 0 hp)
 * 4. Roll for natural recovery
 */
export function diseasePhase(ctx: SimContext): void {
  const { state, rng, year, civilizationId } = ctx;
  const aliveDwarves = state.dwarves.filter(d => d.status === 'alive');

  // Outbreak: if no current infections, chance to start one
  if (state.infectedDwarfIds.size === 0 && rng.random() < DISEASE_OUTBREAK_CHANCE) {
    const patient0 = aliveDwarves[rng.int(0, aliveDwarves.length - 1)];
    if (patient0) {
      state.infectedDwarfIds.add(patient0.id);
      state.pendingEvents.push({
        id: rng.uuid(),
        world_id: '',
        year,
        category: 'discovery',
        civilization_id: civilizationId,
        ruin_id: null,
        dwarf_id: patient0.id,
        item_id: null,
        faction_id: null,
        monster_id: null,
        description: `A disease outbreak has begun! ${dwarfName(patient0)} is the first to fall ill.`,
        event_data: { type: 'disease_outbreak' },
        created_at: new Date().toISOString(),
      });
    }
  }

  if (state.infectedDwarfIds.size === 0) return;

  const spreadChance = hasWell(ctx) ? DISEASE_SPREAD_CHANCE_WITH_WELL : DISEASE_SPREAD_CHANCE;

  // Spread: each infected dwarf may infect nearby healthy dwarves
  const currentlyInfected = new Set(state.infectedDwarfIds);
  for (const infectedId of currentlyInfected) {
    const infectedDwarf = aliveDwarves.find(d => d.id === infectedId);
    if (!infectedDwarf) continue;

    for (const candidate of aliveDwarves) {
      if (candidate.id === infectedId) continue;
      if (state.infectedDwarfIds.has(candidate.id)) continue;
      const dist =
        Math.abs(candidate.position_x - infectedDwarf.position_x) +
        Math.abs(candidate.position_y - infectedDwarf.position_y);
      if (dist <= DISEASE_SPREAD_RADIUS && rng.random() < spreadChance) {
        state.infectedDwarfIds.add(candidate.id);
        state.pendingEvents.push({
          id: rng.uuid(),
          world_id: '',
          year,
          category: 'discovery',
          civilization_id: civilizationId,
          ruin_id: null,
          dwarf_id: candidate.id,
          item_id: null,
          faction_id: null,
          monster_id: null,
          description: `${dwarfName(candidate)} has caught the disease.`,
          event_data: { type: 'disease_spread' },
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  // Damage and recovery for all infected dwarves
  for (const infectedId of [...state.infectedDwarfIds]) {
    const dwarf = aliveDwarves.find(d => d.id === infectedId);
    if (!dwarf) {
      // Dwarf died or is no longer alive — remove from infected set
      state.infectedDwarfIds.delete(infectedId);
      continue;
    }

    // Deal health damage
    dwarf.health = Math.max(0, dwarf.health - DISEASE_HEALTH_DAMAGE_PER_YEAR);
    state.dirtyDwarfIds.add(dwarf.id);

    if (dwarf.health <= 0) {
      dwarf.status = 'dead';
      dwarf.died_year = year;
      dwarf.cause_of_death = 'disease';
      state.infectedDwarfIds.delete(dwarf.id);
      state.ghostDwarfIds.add(dwarf.id);
      applyWitnessStress(dwarf, state);
      createWitnessDeathMemories(dwarf, state, year);
      createGriefFriendMemories(dwarf, state, year);
      state.pendingEvents.push({
        id: rng.uuid(),
        world_id: '',
        year,
        category: 'death',
        civilization_id: civilizationId,
        ruin_id: null,
        dwarf_id: dwarf.id,
        item_id: null,
        faction_id: null,
        monster_id: null,
        description: `${dwarfName(dwarf)} has died of disease.`,
        event_data: { type: 'disease_death' },
        created_at: new Date().toISOString(),
      });
      continue;
    }

    // Natural recovery
    if (rng.random() < DISEASE_RECOVERY_CHANCE) {
      state.infectedDwarfIds.delete(dwarf.id);
      state.pendingEvents.push({
        id: rng.uuid(),
        world_id: '',
        year,
        category: 'discovery',
        civilization_id: civilizationId,
        ruin_id: null,
        dwarf_id: dwarf.id,
        item_id: null,
        faction_id: null,
        monster_id: null,
        description: `${dwarfName(dwarf)} has recovered from the disease.`,
        event_data: { type: 'disease_recovery' },
        created_at: new Date().toISOString(),
      });
    }
  }
}
