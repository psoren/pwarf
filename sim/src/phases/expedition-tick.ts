import type { ItemCategory, ItemQuality } from "@pwarf/shared";
import { calculateTravelTicks } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { resolveExpedition } from "../expedition-resolution.js";

/**
 * Expedition Tick Phase
 *
 * Processes active expeditions each tick:
 * 1. Traveling → decrement travel_ticks_remaining, resolve on arrival
 * 2. Retreating (returning) → decrement return_ticks_remaining, return dwarves on arrival
 */
export function expeditionTick(ctx: SimContext): void {
  const { state, rng } = ctx;

  for (const expedition of state.expeditions) {
    if (expedition.status === 'traveling') {
      expedition.travel_ticks_remaining--;
      state.dirtyExpeditionIds.add(expedition.id);

      if (expedition.travel_ticks_remaining <= 0) {
        // --- Arrival: resolve the expedition ---
        const ruin = state.ruins.find(r => r.id === expedition.ruin_id);
        if (!ruin) continue;

        const partyDwarves = state.dwarves.filter(d => expedition.dwarf_ids.includes(d.id));
        const partySkills = state.dwarfSkills.filter(s => partyDwarves.some(d => d.id === s.dwarf_id));

        const outcome = resolveExpedition({
          expedition,
          ruin,
          dwarves: partyDwarves,
          dwarfSkills: partySkills,
          rng,
        });

        // Update ruin wealth
        ruin.remaining_wealth = Math.max(0, ruin.remaining_wealth - outcome.wealthExtracted);
        state.dirtyRuinIds.add(ruin.id);

        // Mark dead dwarves
        for (const dwarfId of outcome.lostDwarfIds) {
          const dwarf = state.dwarves.find(d => d.id === dwarfId);
          if (dwarf) {
            dwarf.status = 'dead';
            dwarf.died_year = ctx.year;
            dwarf.cause_of_death = 'expedition';
            state.dirtyDwarfIds.add(dwarf.id);
          }
        }

        // Store outcome on expedition
        expedition.dwarves_lost = outcome.lostDwarfIds.length;
        expedition.expedition_log = outcome.log;
        expedition.items_looted = outcome.lootedItems.map(l => `${l.quality} ${l.material} ${l.category}`);

        // Transition to returning (use 'retreating' from the enum)
        expedition.status = 'retreating';

        // Calculate return trip — same distance, use plains as baseline for return
        const distance = Math.abs(expedition.destination_tile_x - ctx.civTileX)
          + Math.abs(expedition.destination_tile_y - ctx.civTileY);
        expedition.return_ticks_remaining = calculateTravelTicks(distance, 'plains');

        // Store loot details for creating items on return
        state._pendingExpeditionLoot.set(expedition.id, outcome.lootedItems.map(l => ({
          category: l.category,
          material: l.material,
          quality: l.quality,
        })));
      }
    } else if (expedition.status === 'retreating') {
      expedition.return_ticks_remaining--;
      state.dirtyExpeditionIds.add(expedition.id);

      if (expedition.return_ticks_remaining <= 0) {
        // --- Return: dwarves arrive back at fortress ---
        const survivingDwarfIds = expedition.dwarf_ids.filter(id => {
          const dwarf = state.dwarves.find(d => d.id === id);
          return dwarf && dwarf.status !== 'dead';
        });

        // Return surviving dwarves to fortress center
        for (const dwarfId of survivingDwarfIds) {
          const dwarf = state.dwarves.find(d => d.id === dwarfId);
          if (dwarf) {
            dwarf.status = 'alive';
            dwarf.position_x = 256;
            dwarf.position_y = 256;
            dwarf.position_z = 0;
            state.dirtyDwarfIds.add(dwarf.id);
          }
        }

        // Create loot items at fortress
        const pendingLoot = state._pendingExpeditionLoot.get(expedition.id);

        if (pendingLoot && survivingDwarfIds.length > 0) {
          for (const loot of pendingLoot) {
            const item = {
              id: rng.uuid(),
              name: `${loot.quality} ${loot.material} ${loot.category}`,
              category: loot.category as ItemCategory,
              quality: loot.quality as ItemQuality,
              material: loot.material,
              weight: 1,
              value: Math.floor(50 + rng.random() * 200),
              is_artifact: false,
              created_by_dwarf_id: null,
              created_in_civ_id: ctx.civilizationId,
              created_year: ctx.year,
              held_by_dwarf_id: null,
              located_in_civ_id: ctx.civilizationId,
              located_in_ruin_id: null,
              position_x: 256,
              position_y: 256,
              position_z: 0,
              lore: 'Recovered from an expedition to ancient ruins',
              properties: {},
              created_at: new Date().toISOString(),
            };
            state.items.push(item);
            state.dirtyItemIds.add(item.id);
          }
        }

        // Clean up pending loot
        state._pendingExpeditionLoot.delete(expedition.id);

        // Mark expedition complete
        expedition.status = 'complete';
        expedition.completed_at = new Date().toISOString();

        // Fire world event
        state.pendingEvents.push({
          id: rng.uuid(),
          world_id: '',
          year: ctx.year,
          category: 'discovery',
          civilization_id: ctx.civilizationId,
          ruin_id: expedition.ruin_id,
          dwarf_id: null,
          item_id: null,
          faction_id: null,
          monster_id: null,
          description: `An expedition has returned! ${expedition.expedition_log ?? ''}`,
          event_data: {
            expedition_id: expedition.id,
            survivors: survivingDwarfIds.length,
            lost: expedition.dwarves_lost,
          },
          created_at: new Date().toISOString(),
        });
      }
    }
  }
}
