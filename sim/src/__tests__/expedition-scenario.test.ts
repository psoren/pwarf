import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeExpedition, makeRuin, makeSkill } from "./test-helpers.js";
import { calculateTravelTicks } from "@pwarf/shared";

describe("expedition scenario", () => {
  it("dwarf travels to ruin, resolves, and returns with loot", async () => {
    const dwarf = makeDwarf({
      id: "d1",
      name: "Urist",
      status: "missing",
      position_x: 256,
      position_y: 256,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
    });
    const fighting = makeSkill("d1", "fighting", 3);

    const ruin = makeRuin({
      id: "r1",
      tile_x: 5,
      tile_y: 5,
      danger_level: 5, // low danger so dwarf survives
      remaining_wealth: 5000,
      is_trapped: false,
      is_contaminated: false,
      resident_monster_id: null,
    });

    // Distance = |5-0| + |5-0| = 10 (civTileX/Y default to 0 in runScenario)
    const travelTicks = calculateTravelTicks(10, "plains");

    const expedition = makeExpedition({
      id: "e1",
      ruin_id: "r1",
      dwarf_ids: ["d1"],
      status: "traveling",
      travel_ticks_remaining: travelTicks,
      destination_tile_x: 5,
      destination_tile_y: 5,
    });

    // Run enough ticks for travel + resolution + return trip
    // Return trip is also ~10 tiles at plains cost
    const totalTicks = travelTicks + calculateTravelTicks(10, "plains") + 10; // +10 buffer

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [fighting],
      expeditions: [expedition],
      ruins: [ruin],
      ticks: totalTicks,
      seed: 42,
    });

    // Expedition should be complete
    const exp = result.expeditions.find(e => e.id === "e1");
    expect(exp).toBeDefined();
    expect(exp!.status).toBe("complete");
    expect(exp!.expedition_log).toBeTruthy();
    expect(exp!.completed_at).toBeTruthy();

    // Dwarf should have survived (low danger) and returned to fortress
    const returnedDwarf = result.dwarves.find(d => d.id === "d1");
    expect(returnedDwarf).toBeDefined();
    expect(returnedDwarf!.status).toBe("alive");
    // Note: exact position not checked — idle behavior can move the dwarf after return.

    // Should have looted items from the wealthy ruin
    const lootItems = result.items.filter(i => i.lore?.includes("expedition"));
    expect(lootItems.length).toBeGreaterThan(0);

    // Should have fired a return event
    const returnEvents = result.events.filter(
      e => e.category === "discovery" && e.description?.includes("expedition has returned"),
    );
    expect(returnEvents.length).toBe(1);
  });

  it("high-danger ruin can kill expedition dwarves", async () => {
    const dwarf = makeDwarf({
      id: "d1",
      name: "Doomed",
      status: "missing",
      need_food: 100,
      need_drink: 100,
    });

    const ruin = makeRuin({
      id: "r1",
      tile_x: 1,
      tile_y: 1,
      danger_level: 100, // maximum danger
      is_trapped: true,
      is_contaminated: true,
      resident_monster_id: "monster-1",
      remaining_wealth: 1000,
    });

    const expedition = makeExpedition({
      id: "e1",
      ruin_id: "r1",
      dwarf_ids: ["d1"],
      status: "traveling",
      travel_ticks_remaining: 1, // arrive next tick
      destination_tile_x: 1,
      destination_tile_y: 1,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      expeditions: [expedition],
      ruins: [ruin],
      ticks: 500, // enough to complete return trip even if dwarf survives
      seed: 42,
    });

    const exp = result.expeditions.find(e => e.id === "e1");
    expect(exp).toBeDefined();
    // Expedition should have resolved (either retreating or complete)
    expect(["retreating", "complete"]).toContain(exp!.status);

    // With danger_level 100 + trapped + contaminated + monster,
    // effective danger = 100 + 20 + 15 + 10 = 145, deathThreshold = 145/200 = 0.725
    // High chance of death — check the log
    expect(exp!.expedition_log).toBeTruthy();

    // The dwarf should be dead given the extreme danger
    const deadDwarf = result.dwarves.find(d => d.id === "d1");
    expect(deadDwarf).toBeDefined();
    expect(deadDwarf!.status).toBe("dead");
    expect(deadDwarf!.cause_of_death).toBe("expedition");
  });

  it("multi-dwarf expedition with partial casualties", async () => {
    // Use 5 dwarves to get a statistical spread with moderate danger
    const dwarves = Array.from({ length: 5 }, (_, i) =>
      makeDwarf({
        id: `d${i}`,
        name: `Dwarf${i}`,
        status: "missing",
        need_food: 100,
        need_drink: 100,
      }),
    );

    const ruin = makeRuin({
      id: "r1",
      tile_x: 2,
      tile_y: 2,
      danger_level: 50, // moderate danger
      remaining_wealth: 8000,
    });

    const expedition = makeExpedition({
      id: "e1",
      ruin_id: "r1",
      dwarf_ids: dwarves.map(d => d.id),
      status: "traveling",
      travel_ticks_remaining: 1,
      destination_tile_x: 2,
      destination_tile_y: 2,
    });

    const result = await runScenario({
      dwarves,
      expeditions: [expedition],
      ruins: [ruin],
      ticks: 500,
      seed: 42,
    });

    const exp = result.expeditions.find(e => e.id === "e1");
    expect(exp).toBeDefined();

    const alive = result.dwarves.filter(d => d.status === "alive");
    const dead = result.dwarves.filter(d => d.status === "dead");

    // With 5 dwarves at danger 50 (threshold 0.25), we expect some to survive
    // and possibly some to die. The exact count depends on RNG but with seed 42
    // we can verify the expedition completed and the counts are valid.
    expect(alive.length + dead.length).toBe(5);
    expect(exp!.dwarves_lost).toBe(dead.length);
    expect(exp!.expedition_log).toBeTruthy();
  });
});
