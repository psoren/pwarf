import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeRealisticScenario, makeMapTile } from "./test-helpers.js";

/**
 * Auto-Forage scenario tests
 *
 * Tests that:
 * - When food stock is zero and forageable tiles exist, a forage task is auto-created
 * - The forage task completes and produces a food item
 * - Dwarves survive by foraging wild food
 */

describe("auto-forage scenario", () => {
  it("auto-creates forage task and produces food when stock is zero", { timeout: 30_000 }, async () => {
    const config = makeRealisticScenario({
      dwarfCount: 2,
      foodCount: 0,
      drinkCount: 20,
    });

    // Remove any food items (keep only drinks)
    config.items = config.items!.filter(i => i.category !== "food");

    // Place forageable tiles (grass, bush) in the fortress area.
    // Auto-forage scans fortressTileOverrides for forageable tile types.
    const tiles: ReturnType<typeof makeMapTile>[] = [];
    for (let x = 254; x <= 262; x++) {
      for (let y = 254; y <= 262; y++) {
        // Mix of grass and bush tiles
        const tileType = (x + y) % 3 === 0 ? "bush" : "grass";
        tiles.push(makeMapTile(x, y, 0, tileType));
      }
    }
    config.fortressTileOverrides = tiles;
    config.ticks = 500;

    const result = await runScenario(config);

    // A forage task should have been created
    const forageTasks = result.tasks.filter(t => t.task_type === "forage");
    expect(forageTasks.length).toBeGreaterThanOrEqual(1);

    // At least one forage task should have completed
    const completedForage = forageTasks.find(t => t.status === "completed");
    expect(completedForage).toBeDefined();

    // Food should exist in items (produced by foraging)
    const foodItems = result.items.filter(i => i.category === "food");
    expect(foodItems.length).toBeGreaterThanOrEqual(1);

    // Dwarves should still be alive (they foraged food to survive)
    const aliveDwarves = result.dwarves.filter(d => d.status === "alive");
    expect(aliveDwarves.length).toBe(2);
  });

  it("does not create forage task when no forageable tiles exist", async () => {
    const config = makeRealisticScenario({
      dwarfCount: 2,
      foodCount: 0,
      drinkCount: 20,
    });

    // Remove all food items
    config.items = config.items!.filter(i => i.category !== "food");

    // Only stone tiles (not forageable)
    const tiles: ReturnType<typeof makeMapTile>[] = [];
    for (let x = 254; x <= 262; x++) {
      for (let y = 254; y <= 262; y++) {
        tiles.push(makeMapTile(x, y, 0, "stone"));
      }
    }
    config.fortressTileOverrides = tiles;
    config.ticks = 200;

    const result = await runScenario(config);

    // No forage task should have been created (no forageable tiles)
    const forageTasks = result.tasks.filter(t => t.task_type === "forage");
    expect(forageTasks).toHaveLength(0);
  });
});
