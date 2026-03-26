import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeRealisticScenario } from "./test-helpers.js";
import { STEPS_PER_YEAR } from "@pwarf/shared";

/**
 * Relationship Formation scenario tests.
 *
 * The yearly rollup phase calls relationshipFormationPhase, which rolls
 * FRIENDSHIP_FORMATION_CHANCE (0.3) for each pair of alive dwarves to
 * form acquaintances.
 *
 * Uses makeRealisticScenario with the fortress deriver so pathfinding,
 * movement, and tile lookup all exercise the full BFS + simplex pipeline.
 */

describe("relationship formation", () => {
  it("forms acquaintances after the first yearly rollup", async () => {
    // 5 dwarves = 10 pairs, 30% chance each => P(zero) = 0.7^10 ~ 2.8%
    const config = makeRealisticScenario({
      dwarfCount: 5,
      foodCount: 200,
      drinkCount: 200,
    });

    config.ticks = STEPS_PER_YEAR + 1;

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
  }, 600_000);
});
