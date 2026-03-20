import {
  FRIENDSHIP_FORMATION_CHANCE,
  FRIEND_UPGRADE_YEARS,
  MARRIAGE_CHANCE,
  MARRIAGE_FRIEND_MIN_YEARS,
} from "@pwarf/shared";
import type { DwarfRelationship } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { createMarriageMemories } from "../dwarf-memory.js";

/**
 * Relationship Formation Phase (yearly)
 *
 * For each pair of alive dwarves:
 * - If no relationship exists, roll FRIENDSHIP_FORMATION_CHANCE to form 'acquaintance'
 * - If 'acquaintance' exists and formed_year <= year - FRIEND_UPGRADE_YEARS, upgrade to 'friend'
 * - If 'friend' exists for >= MARRIAGE_FRIEND_MIN_YEARS, roll MARRIAGE_CHANCE to upgrade to 'spouse'
 *
 * Relationships are stored canonically with dwarf_a_id < dwarf_b_id (lexicographic)
 * to prevent duplicates.
 */
export function relationshipFormationPhase(ctx: SimContext): void {
  const { state, rng, year, civilizationId } = ctx;

  const aliveDwarves = state.dwarves.filter((d) => d.status === "alive");

  // Build a lookup: "dwarfAId,dwarfBId" → relationship (canonical order)
  const relMap = new Map<string, DwarfRelationship>();
  for (const rel of state.dwarfRelationships) {
    const key = canonicalKey(rel.dwarf_a_id, rel.dwarf_b_id);
    relMap.set(key, rel);
  }

  for (let i = 0; i < aliveDwarves.length; i++) {
    for (let j = i + 1; j < aliveDwarves.length; j++) {
      const dA = aliveDwarves[i];
      const dB = aliveDwarves[j];
      const key = canonicalKey(dA.id, dB.id);
      const existing = relMap.get(key);

      if (!existing) {
        // Roll for new acquaintance
        if (rng.random() < FRIENDSHIP_FORMATION_CHANCE) {
          const [aId, bId] = sortedIds(dA.id, dB.id);
          const rel: DwarfRelationship = {
            id: rng.uuid(),
            dwarf_a_id: aId,
            dwarf_b_id: bId,
            type: "acquaintance",
            strength: 1,
            shared_events: [],
            formed_year: year,
          };
          state.dwarfRelationships.push(rel);
          state.newDwarfRelationships.push(rel);
          relMap.set(key, rel);
        }
      } else if (
        existing.type === "acquaintance" &&
        existing.formed_year !== null &&
        year - existing.formed_year >= FRIEND_UPGRADE_YEARS
      ) {
        // Upgrade acquaintance to friend; reset formed_year so marriage timer
        // counts from when they became friends, not when they met.
        existing.type = "friend";
        existing.formed_year = year;
        existing.strength = Math.min(existing.strength + 1, 10);
        state.dirtyDwarfRelationshipIds.add(existing.id);
      } else if (
        existing.type === "friend" &&
        existing.formed_year !== null &&
        year - existing.formed_year >= MARRIAGE_FRIEND_MIN_YEARS &&
        rng.random() < MARRIAGE_CHANCE
      ) {
        // Upgrade friend to spouse — marriage!
        existing.type = "spouse";
        existing.strength = Math.min(existing.strength + 2, 10);
        state.dirtyDwarfRelationshipIds.add(existing.id);

        // Give joy memories to both spouses
        createMarriageMemories(dA, dB, state, year);

        // Fire marriage world event
        state.pendingEvents.push({
          id: rng.uuid(),
          world_id: "",
          year,
          category: "marriage",
          civilization_id: civilizationId,
          ruin_id: null,
          dwarf_id: dA.id,
          item_id: null,
          faction_id: null,
          monster_id: null,
          description: `${dA.name} and ${dB.name} have been married.`,
          event_data: { dwarf_a_id: dA.id, dwarf_b_id: dB.id },
          created_at: new Date().toISOString(),
        });
      }
    }
  }
}

function sortedIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function canonicalKey(a: string, b: string): string {
  const [aId, bId] = sortedIds(a, b);
  return `${aId},${bId}`;
}
