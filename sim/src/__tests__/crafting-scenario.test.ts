import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeRealisticScenario, makeDwarf, makeTask, makeSkill, makeItem, makeStructure } from "./test-helpers.js";
import { WORK_BREW, WORK_COOK, WORK_SMITH, SKILL_NAMES } from "@pwarf/shared";

/**
 * Crafting scenario tests — brew, cook, and smith tasks.
 *
 * Each test sets up 2 dwarves with high needs (to suppress autonomous
 * distractions), places the required ingredients at the workshop location,
 * and asserts that the crafting task completes and the expected item is
 * produced.
 */

describe("crafting scenarios", () => {
  it("brew task consumes a plant and produces a drink", async () => {
    const config = makeRealisticScenario({ dwarfCount: 2 });

    // Place a raw_material plant at the brew target tile
    const brewX = 257;
    const brewY = 257;
    config.items!.push(makeItem({
      name: "Plump helmet",
      category: "raw_material",
      material: "plant",
      located_in_civ_id: "test-civ",
      position_x: brewX,
      position_y: brewY,
      position_z: 0,
    }));

    // Create a brew task at the same position
    config.tasks = [
      makeTask("brew", {
        status: "pending",
        target_x: brewX,
        target_y: brewY,
        target_z: 0,
        work_required: WORK_BREW,
        civilization_id: "test-civ",
      }),
    ];

    config.ticks = 800;

    const result = await runScenario(config);

    // Brew task should be completed
    const brewTask = result.tasks.find(t => t.task_type === "brew" && t.status === "completed");
    expect(brewTask).toBeDefined();

    // A drink item should have been produced
    const drinks = result.items.filter(i => i.category === "drink" && i.name === "Plump helmet brew");
    expect(drinks.length).toBeGreaterThanOrEqual(1);
  });

  it("cook task consumes food and produces a prepared meal", async () => {
    const config = makeRealisticScenario({ dwarfCount: 2 });

    // Place a raw food item at the cook target tile
    const cookX = 257;
    const cookY = 257;
    config.items!.push(makeItem({
      name: "Raw plump helmet",
      category: "food",
      material: "plant",
      located_in_civ_id: "test-civ",
      position_x: cookX,
      position_y: cookY,
      position_z: 0,
    }));

    // Create a cook task at the same position
    config.tasks = [
      makeTask("cook", {
        status: "pending",
        target_x: cookX,
        target_y: cookY,
        target_z: 0,
        work_required: WORK_COOK,
        civilization_id: "test-civ",
      }),
    ];

    config.ticks = 800;

    const result = await runScenario(config);

    // Cook task should be completed
    const cookTask = result.tasks.find(t => t.task_type === "cook" && t.status === "completed");
    expect(cookTask).toBeDefined();

    // A prepared meal should have been produced
    const meals = result.items.filter(i => i.category === "food" && i.name === "Prepared meal");
    expect(meals.length).toBeGreaterThanOrEqual(1);
  });

  it("smith task consumes ore and produces a tool", async () => {
    const config = makeRealisticScenario({ dwarfCount: 2 });

    // Place ore at the smith target tile
    const smithX = 257;
    const smithY = 257;
    config.items!.push(makeItem({
      name: "Iron ore",
      category: "raw_material",
      material: "metal",
      located_in_civ_id: "test-civ",
      position_x: smithX,
      position_y: smithY,
      position_z: 0,
    }));

    // Create a smith task at the same position
    config.tasks = [
      makeTask("smith", {
        status: "pending",
        target_x: smithX,
        target_y: smithY,
        target_z: 0,
        work_required: WORK_SMITH,
        civilization_id: "test-civ",
      }),
    ];

    config.ticks = 800;

    const result = await runScenario(config);

    // Smith task should be completed
    const smithTask = result.tasks.find(t => t.task_type === "smith" && t.status === "completed");
    expect(smithTask).toBeDefined();

    // A tool should have been produced
    const tools = result.items.filter(i => i.category === "tool");
    expect(tools.length).toBeGreaterThanOrEqual(1);
    expect(tools[0]!.material).toBe("metal");
  });

  it("crafting awards XP to the relevant skill", async () => {
    const config = makeRealisticScenario({ dwarfCount: 1 });

    // Place ingredient
    const x = 257;
    const y = 257;
    config.items!.push(makeItem({
      name: "Iron ore",
      category: "raw_material",
      material: "metal",
      located_in_civ_id: "test-civ",
      position_x: x,
      position_y: y,
      position_z: 0,
    }));

    config.tasks = [
      makeTask("smith", {
        status: "pending",
        target_x: x,
        target_y: y,
        target_z: 0,
        work_required: WORK_SMITH,
        civilization_id: "test-civ",
      }),
    ];

    config.ticks = 800;

    const result = await runScenario(config);

    // Smith task should be completed
    const smithTask = result.tasks.find(t => t.task_type === "smith" && t.status === "completed");
    expect(smithTask).toBeDefined();

    // Smithing skill should have gained XP
    const smithSkill = result.dwarfSkills.find(
      s => s.skill_name === "smithing" && s.dwarf_id === result.dwarves[0]!.id,
    );
    expect(smithSkill).toBeDefined();
    expect(smithSkill!.xp).toBeGreaterThan(0);
  });
});
