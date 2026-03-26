import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeRealisticScenario, makeItem } from "./test-helpers.js";
import { MIN_COOK_STOCK } from "@pwarf/shared";

/**
 * Auto-Cook scenario tests
 *
 * Tests that:
 * - When cooked food is below MIN_COOK_STOCK and raw food exists, a cook task is auto-created
 * - The cook task completes and produces a "Prepared meal" item (material: "cooked")
 * - When cooked food is at or above threshold, no cook task is created
 */

describe("auto-cook scenario", () => {
  it("auto-creates cook task and produces a cooked meal when stock is low", { timeout: 30_000 }, async () => {
    // Start with raw food items (material !== "cooked") and zero cooked food.
    // Total food count is below MIN_COOK_STOCK so auto-cook should trigger.
    const rawFoodItems = Array.from({ length: 3 }, () =>
      makeItem({
        name: "Plump helmet",
        category: "food",
        material: "plant",
        located_in_civ_id: "test-civ",
        position_x: 257,
        position_y: 257,
        position_z: 0,
      }),
    );

    const config = makeRealisticScenario({
      dwarfCount: 2,
      foodCount: 0,
      drinkCount: 20,
    });

    // Replace the default food items with our raw food
    config.items = [
      ...rawFoodItems,
      // Keep drink items from the realistic scenario
      ...config.items!.filter(i => i.category === "drink"),
    ];

    config.ticks = 500;

    const result = await runScenario(config);

    // A cook task should have been created and completed
    const cookTasks = result.tasks.filter(t => t.task_type === "cook");
    expect(cookTasks.length).toBeGreaterThanOrEqual(1);

    const completedCook = cookTasks.find(t => t.status === "completed");
    expect(completedCook).toBeDefined();

    // A cooked meal should exist in items
    const cookedMeals = result.items.filter(
      i => i.category === "food" && i.material === "cooked",
    );
    expect(cookedMeals.length).toBeGreaterThanOrEqual(1);
    expect(cookedMeals[0]!.name).toBe("Prepared meal");
  });

  it("does not create cook task when food stock is sufficient", async () => {
    // Provide enough food items (>= MIN_COOK_STOCK) so auto-cook does not trigger.
    // Auto-cook checks all ground food (not just cooked), so having enough total food
    // at or above MIN_COOK_STOCK means no cook task is needed.
    const config = makeRealisticScenario({
      dwarfCount: 2,
      foodCount: MIN_COOK_STOCK + 5,
      drinkCount: 20,
    });

    config.ticks = 200;

    const result = await runScenario(config);

    // No cook task should have been created
    const cookTasks = result.tasks.filter(t => t.task_type === "cook");
    expect(cookTasks).toHaveLength(0);
  });
});
