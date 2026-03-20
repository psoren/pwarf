import {
  STRESS_TANTRUM_MODERATE,
  STRESS_TANTRUM_SEVERE,
  TANTRUM_DESTROY_CHANCE_MILD,
  TANTRUM_DESTROY_CHANCE_MODERATE,
  TANTRUM_DESTROY_CHANCE_SEVERE,
  TANTRUM_ATTACK_CHANCE,
  TANTRUM_ATTACK_DAMAGE,
  TANTRUM_WITNESS_STRESS,
  TANTRUM_PROXIMITY_RADIUS,
} from "@pwarf/shared";
import type { Dwarf } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { dwarfName } from "../dwarf-utils.js";

/**
 * Tantrum Actions Phase
 *
 * Runs after tantrum-check. For each dwarf currently in a tantrum:
 * - Mild (80–89):    chance to destroy a nearby item
 * - Moderate (90–95): higher destroy chance + chance to attack a nearby dwarf
 * - Severe (96+):     highest destroy chance + higher attack chance
 *
 * Witnesses of attacks receive a stress penalty.
 */
export async function tantrumActions(ctx: SimContext): Promise<void> {
  const { state, rng, year, civilizationId } = ctx;

  for (const dwarf of state.dwarves) {
    if (dwarf.status !== 'alive' || !dwarf.is_in_tantrum) continue;

    const stress = dwarf.stress_level;
    const isSevere = stress >= STRESS_TANTRUM_SEVERE;
    const isModerate = stress >= STRESS_TANTRUM_MODERATE;

    // Determine destroy probability based on tier
    const destroyChance = isSevere
      ? TANTRUM_DESTROY_CHANCE_SEVERE
      : isModerate
        ? TANTRUM_DESTROY_CHANCE_MODERATE
        : TANTRUM_DESTROY_CHANCE_MILD;

    // Attempt to destroy a nearby item
    if (rng.random() < destroyChance) {
      const nearbyItem = state.items.find(
        item =>
          item.position_x !== null &&
          item.position_y !== null &&
          item.position_z !== null &&
          item.held_by_dwarf_id === null &&
          Math.abs((item.position_x ?? 0) - dwarf.position_x) +
            Math.abs((item.position_y ?? 0) - dwarf.position_y) <=
            TANTRUM_PROXIMITY_RADIUS &&
          item.position_z === dwarf.position_z,
      );

      if (nearbyItem) {
        const idx = state.items.findIndex(i => i.id === nearbyItem.id);
        if (idx !== -1) {
          state.items.splice(idx, 1);
          state.dirtyItemIds.add(nearbyItem.id);

          state.pendingEvents.push({
            id: rng.uuid(),
            world_id: '',
            year,
            category: 'discovery',
            civilization_id: civilizationId,
            ruin_id: null,
            dwarf_id: dwarf.id,
            item_id: nearbyItem.id,
            faction_id: null,
            monster_id: null,
            description: `${dwarfName(dwarf)} destroys a ${nearbyItem.name} in a fit of rage!`,
            event_data: { action: 'destroy_item', item_name: nearbyItem.name, item_id: nearbyItem.id },
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    // Moderate and severe: chance to attack a nearby dwarf
    if ((isModerate || isSevere) && rng.random() < TANTRUM_ATTACK_CHANCE) {
      const target = findNearbyLivingDwarf(dwarf, state.dwarves, rng);
      if (target) {
        target.health = Math.max(0, target.health - TANTRUM_ATTACK_DAMAGE);
        state.dirtyDwarfIds.add(target.id);

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
          description: `${dwarfName(dwarf)} attacks ${dwarfName(target)} during a tantrum!`,
          event_data: { action: 'attack_dwarf', attacker_id: dwarf.id, victim_id: target.id, damage: TANTRUM_ATTACK_DAMAGE },
          created_at: new Date().toISOString(),
        });

        // Witnesses (other nearby dwarves) receive stress
        for (const witness of state.dwarves) {
          if (witness.id === dwarf.id || witness.id === target.id) continue;
          if (witness.status !== 'alive') continue;
          if (
            Math.abs(witness.position_x - dwarf.position_x) +
              Math.abs(witness.position_y - dwarf.position_y) >
            TANTRUM_PROXIMITY_RADIUS
          ) continue;
          if (witness.position_z !== dwarf.position_z) continue;

          witness.stress_level = Math.min(100, witness.stress_level + TANTRUM_WITNESS_STRESS);
          state.dirtyDwarfIds.add(witness.id);
        }
      }
    }
  }
}

/** Finds a random alive dwarf within TANTRUM_PROXIMITY_RADIUS of the raging dwarf. */
function findNearbyLivingDwarf(rager: Dwarf, dwarves: Dwarf[], rng: SimContext['rng']): Dwarf | undefined {
  const candidates = dwarves.filter(
    d =>
      d.id !== rager.id &&
      d.status === 'alive' &&
      d.position_z === rager.position_z &&
      Math.abs(d.position_x - rager.position_x) + Math.abs(d.position_y - rager.position_y) <=
        TANTRUM_PROXIMITY_RADIUS,
  );
  if (candidates.length === 0) return undefined;
  return candidates[rng.int(0, candidates.length - 1)];
}
