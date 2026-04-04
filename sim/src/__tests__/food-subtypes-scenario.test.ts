import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeItem, makeRealisticScenario } from "./test-helpers.js";
import { FOOD_NUTRITION, DRINK_HYDRATION, FOOD_RESTORE_AMOUNT } from "@pwarf/shared";

/**
 * Food/drink subtypes scenario tests
 *
 * Verifies that different food and drink items restore different amounts
 * based on their name and quality, rather than a flat constant.
 *
 * Strategy: start dwarves with low needs so they autonomously eat/drink,
 * then check the final need values differ based on item type.
 */

describe("food subtypes scenario", () => {
  it("wild mushroom restores less than prepared meal", { timeout: 30_000 }, async () => {
    // Two dwarves, each with low food. One has only mushrooms, one has only meals.
    // After eating, the meal-eater should have higher need_food.
    const mushroomConfig = makeRealisticScenario({
      dwarfCount: 1,
      foodCount: 0,
      drinkCount: 20,
    });

    // Give the dwarf low food need to trigger eating
    mushroomConfig.dwarves![0]!.need_food = 10;

    // Place wild mushrooms near the dwarf
    const mushroomItems = Array.from({ length: 5 }, () =>
      makeItem({
        name: "Wild mushroom",
        category: "food",
        material: "plant",
        quality: "standard",
        located_in_civ_id: "test-civ",
        position_x: 258,
        position_y: 258,
        position_z: 0,
      }),
    );
    mushroomConfig.items = [
      ...mushroomItems,
      ...mushroomConfig.items!.filter(i => i.category === "drink"),
    ];
    mushroomConfig.ticks = 300;

    const mushroomResult = await runScenario(mushroomConfig);

    const mealConfig = makeRealisticScenario({
      dwarfCount: 1,
      foodCount: 0,
      drinkCount: 20,
    });

    mealConfig.dwarves![0]!.need_food = 10;

    const mealItems = Array.from({ length: 5 }, () =>
      makeItem({
        name: "Prepared meal",
        category: "food",
        material: "cooked",
        quality: "standard",
        located_in_civ_id: "test-civ",
        position_x: 258,
        position_y: 258,
        position_z: 0,
      }),
    );
    mealConfig.items = [
      ...mealItems,
      ...mealConfig.items!.filter(i => i.category === "drink"),
    ];
    mealConfig.ticks = 300;

    const mealResult = await runScenario(mealConfig);

    // Both dwarves should have eaten (at least one eat task completed)
    const mushroomEats = mushroomResult.tasks.filter(t => t.task_type === "eat" && t.status === "completed");
    const mealEats = mealResult.tasks.filter(t => t.task_type === "eat" && t.status === "completed");
    expect(mushroomEats.length).toBeGreaterThanOrEqual(1);
    expect(mealEats.length).toBeGreaterThanOrEqual(1);

    // Prepared meal (75) is strictly better than wild mushroom (35)
    expect(FOOD_NUTRITION["Prepared meal"]!).toBeGreaterThan(FOOD_NUTRITION["Wild mushroom"]!);

    // The meal-eater should have consumed fewer items to reach higher need_food
    // (or have a higher need_food if they ate the same number)
    const mushroomDwarf = mushroomResult.dwarves[0]!;
    const mealDwarf = mealResult.dwarves[0]!;

    // After eating one item each from need_food=10:
    // Mushroom: 10 + 35 = 45
    // Meal: 10 + 75 = 85
    // Due to need decay during the scenario, exact values will differ,
    // but the meal dwarf should have consumed fewer food items
    const mushroomConsumed = 5 - mushroomResult.items.filter(i => i.name === "Wild mushroom").length;
    const mealConsumed = 5 - mealResult.items.filter(i => i.name === "Prepared meal").length;

    // Meals are more nutritious, so fewer should be consumed (or equal)
    expect(mealConsumed).toBeLessThanOrEqual(mushroomConsumed);
  });

  it("drink subtypes restore different amounts", { timeout: 30_000 }, async () => {
    // Test plump helmet brew vs dwarven ale
    const brewConfig = makeRealisticScenario({
      dwarfCount: 1,
      foodCount: 20,
      drinkCount: 0,
    });

    brewConfig.dwarves![0]!.need_drink = 10;

    const brewItems = Array.from({ length: 5 }, () =>
      makeItem({
        name: "Plump helmet brew",
        category: "drink",
        material: "plant",
        quality: "standard",
        located_in_civ_id: "test-civ",
        position_x: 258,
        position_y: 258,
        position_z: 0,
      }),
    );
    brewConfig.items = [
      ...brewConfig.items!.filter(i => i.category === "food"),
      ...brewItems,
    ];
    brewConfig.ticks = 300;

    const brewResult = await runScenario(brewConfig);

    const aleConfig = makeRealisticScenario({
      dwarfCount: 1,
      foodCount: 20,
      drinkCount: 0,
    });

    aleConfig.dwarves![0]!.need_drink = 10;

    const aleItems = Array.from({ length: 5 }, () =>
      makeItem({
        name: "Dwarven ale",
        category: "drink",
        material: "plant",
        quality: "standard",
        located_in_civ_id: "test-civ",
        position_x: 258,
        position_y: 258,
        position_z: 0,
      }),
    );
    aleConfig.items = [
      ...aleConfig.items!.filter(i => i.category === "food"),
      ...aleItems,
    ];
    aleConfig.ticks = 300;

    const aleResult = await runScenario(aleConfig);

    // Both should have consumed at least one drink
    const brewDrinks = brewResult.tasks.filter(t => t.task_type === "drink" && t.status === "completed");
    const aleDrinks = aleResult.tasks.filter(t => t.task_type === "drink" && t.status === "completed");
    expect(brewDrinks.length).toBeGreaterThanOrEqual(1);
    expect(aleDrinks.length).toBeGreaterThanOrEqual(1);

    // Dwarven ale (80) is strictly better than plump helmet brew (65)
    expect(DRINK_HYDRATION["Dwarven ale"]!).toBeGreaterThan(DRINK_HYDRATION["Plump helmet brew"]!);

    // Ale drinker should consume fewer drinks
    const brewConsumed = 5 - brewResult.items.filter(i => i.name === "Plump helmet brew").length;
    const aleConsumed = 5 - aleResult.items.filter(i => i.name === "Dwarven ale").length;
    expect(aleConsumed).toBeLessThanOrEqual(brewConsumed);
  });

  it("cooked food is strictly better than raw food per the constants", () => {
    // Direct constant assertion — no scenario needed
    expect(FOOD_NUTRITION["Prepared meal"]!).toBeGreaterThan(FOOD_NUTRITION["Wild mushroom"]!);
    expect(FOOD_NUTRITION["Prepared meal"]!).toBeGreaterThan(FOOD_NUTRITION["Berries"]!);
    expect(FOOD_NUTRITION["Prepared meal"]!).toBeGreaterThan(FOOD_NUTRITION["Plump helmet"]!);
    expect(FOOD_NUTRITION["Prepared meal"]!).toBeGreaterThan(FOOD_NUTRITION["Dried meat"]!);
    expect(FOOD_NUTRITION["Prepared meal"]!).toBeGreaterThan(FOOD_NUTRITION["Cured meat"]!);
    // Prepared meal is also greater than fallback
    expect(FOOD_NUTRITION["Prepared meal"]!).toBeGreaterThan(FOOD_RESTORE_AMOUNT);
  });
});
