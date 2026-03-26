import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeItem, makeSkill, makeStructure, makeMapTile } from "./test-helpers.js";
import { STEPS_PER_YEAR, SKILL_NAMES } from "@pwarf/shared";

/**
 * Relationship Formation scenario tests.
 *
 * The yearly rollup phase calls relationshipFormationPhase, which rolls
 * FRIENDSHIP_FORMATION_CHANCE (0.3) for each pair of alive dwarves to
 * form acquaintances.
 *
 * Uses a small area with tile overrides (no fortressDeriver) to keep
 * 36001 ticks fast. Dwarves walk on grass tiles and access nearby
 * food, drink, and beds to survive the full year.
 */

function makeYearLongConfig(dwarfCount: number, seed = 42) {
  const dwarves = [];
  const dwarfSkills = [];
  for (let i = 0; i < dwarfCount; i++) {
    const dwarf = makeDwarf({
      civilization_id: "test-civ",
      position_x: 256 + (i % 3),
      position_y: 256 + Math.floor(i / 3),
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
      need_social: 80,
    });
    dwarves.push(dwarf);
    for (const skill of SKILL_NAMES) {
      dwarfSkills.push(makeSkill(dwarf.id, skill, 2));
    }
  }

  // Abundant food and drink
  const items = [];
  for (let i = 0; i < 200; i++) {
    items.push(makeItem({
      name: "Plump helmet",
      category: "food",
      material: "plant",
      located_in_civ_id: "test-civ",
      position_x: 258,
      position_y: 258,
      position_z: 0,
    }));
    items.push(makeItem({
      name: "Dwarven ale",
      category: "drink",
      material: "plant",
      located_in_civ_id: "test-civ",
      position_x: 258,
      position_y: 258,
      position_z: 0,
    }));
  }

  // Beds and well
  const structures = [];
  for (let i = 0; i < dwarfCount + 1; i++) {
    structures.push(makeStructure({
      civilization_id: "test-civ",
      type: "bed",
      completion_pct: 100,
      position_x: 254 + i,
      position_y: 260,
      position_z: 0,
    }));
  }
  structures.push(makeStructure({
    civilization_id: "test-civ",
    type: "well",
    completion_pct: 100,
    position_x: 260,
    position_y: 258,
    position_z: 0,
  }));

  // Lay grass tiles over the area dwarves use — this means buildTileLookup
  // returns grass (walkable) from overrides without calling the deriver.
  const tileOverrides = [];
  for (let x = 250; x <= 265; x++) {
    for (let y = 250; y <= 265; y++) {
      tileOverrides.push(makeMapTile(x, y, 0, "grass"));
    }
  }

  return {
    dwarves,
    dwarfSkills,
    items,
    structures,
    fortressTileOverrides: tileOverrides,
    // No fortressDeriver — overrides + open_air fallback handle pathfinding
    ticks: STEPS_PER_YEAR + 1,
    seed,
  };
}

describe("relationship formation", () => {
  it("forms acquaintances after the first yearly rollup", async () => {
    // 5 dwarves = 10 pairs, 30% chance each → P(zero) = 0.7^10 ≈ 2.8%
    const config = makeYearLongConfig(5);

    const result = await runScenario(config);

    // Year should have advanced (rollup fired)
    expect(result.year).toBeGreaterThanOrEqual(2);

    // At least some dwarves should still be alive (monsters may kill some)
    const aliveDwarves = result.dwarves.filter(d => d.status === "alive");
    expect(aliveDwarves.length).toBeGreaterThanOrEqual(1);

    // Relationships should have formed
    expect(result.dwarfRelationships.length).toBeGreaterThanOrEqual(1);

    // All relationships from a single rollup should be acquaintances
    for (const rel of result.dwarfRelationships) {
      expect(rel.type).toBe("acquaintance");
    }

    // Relationships should reference valid dwarves in canonical order
    const dwarfIds = new Set(result.dwarves.map(d => d.id));
    for (const rel of result.dwarfRelationships) {
      expect(dwarfIds.has(rel.dwarf_a_id)).toBe(true);
      expect(dwarfIds.has(rel.dwarf_b_id)).toBe(true);
      expect(rel.dwarf_a_id < rel.dwarf_b_id).toBe(true);
    }

    // Year-end summary event should exist
    const yearEndEvents = result.events.filter(
      e => e.category === "discovery" &&
        e.description.includes("Year") &&
        e.description.includes("ends"),
    );
    expect(yearEndEvents.length).toBeGreaterThanOrEqual(1);
  }, 120_000);
});
