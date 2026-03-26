import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeRealisticScenario, makeMapTile } from "./test-helpers.js";

/**
 * Event Firing scenario tests.
 *
 * Tests that critical need warnings fire when a dwarf's food or drink
 * drops below CRITICAL_NEED_THRESHOLD (10). The event-firing phase
 * checks each alive dwarf's needs and emits a "discovery" event with
 * "is starving" or "is dehydrated" descriptions.
 */

describe("event firing", () => {
  it("fires a critical food warning when need_food drops below threshold", async () => {
    const config = makeRealisticScenario({
      dwarfCount: 1,
      foodCount: 0,
      drinkCount: 20,
    });

    // Start the dwarf with low food — just above the threshold so the
    // warning fires after a few ticks of need decay
    const dwarf = config.dwarves![0]!;
    dwarf.need_food = 5;

    // Override fortress tiles with stone to prevent foraging (no grass/flowers)
    const stoneOverrides = [];
    for (let x = 250; x <= 265; x++) {
      for (let y = 250; y <= 265; y++) {
        stoneOverrides.push(makeMapTile(x, y, 0, "stone"));
      }
    }
    config.fortressTileOverrides = stoneOverrides;

    config.ticks = 200;

    const result = await runScenario(config);

    // Should have a critical food warning event (category "discovery" with "starving")
    const starvingEvents = result.events.filter(
      e => e.category === "discovery" && e.description.includes("is starving"),
    );
    expect(starvingEvents.length).toBeGreaterThanOrEqual(1);

    // The event should reference the dwarf
    expect(starvingEvents[0]!.dwarf_id).toBe(dwarf.id);
  });

  it("fires a critical drink warning when need_drink drops below threshold", async () => {
    const config = makeRealisticScenario({
      dwarfCount: 1,
      foodCount: 20,
      drinkCount: 0,
    });

    // Start the dwarf with low drink
    const dwarf = config.dwarves![0]!;
    dwarf.need_drink = 5;

    // Override fortress tiles with stone to prevent foraging
    const stoneOverrides = [];
    for (let x = 250; x <= 265; x++) {
      for (let y = 250; y <= 265; y++) {
        stoneOverrides.push(makeMapTile(x, y, 0, "stone"));
      }
    }
    config.fortressTileOverrides = stoneOverrides;

    config.ticks = 200;

    const result = await runScenario(config);

    // Should have a critical drink warning event
    const dehydratedEvents = result.events.filter(
      e => e.category === "discovery" && e.description.includes("is dehydrated"),
    );
    expect(dehydratedEvents.length).toBeGreaterThanOrEqual(1);
    expect(dehydratedEvents[0]!.dwarf_id).toBe(dwarf.id);
  });

  it("does not fire warning when needs are above threshold", async () => {
    const config = makeRealisticScenario({
      dwarfCount: 1,
      foodCount: 20,
      drinkCount: 20,
    });

    // Start with high needs — no warnings should fire
    const dwarf = config.dwarves![0]!;
    dwarf.need_food = 100;
    dwarf.need_drink = 100;

    config.ticks = 50;

    const result = await runScenario(config);

    // No starvation or dehydration warnings should have fired
    const criticalEvents = result.events.filter(
      e => e.category === "discovery" &&
        (e.description.includes("is starving") || e.description.includes("is dehydrated")),
    );
    expect(criticalEvents.length).toBe(0);
  });
});
