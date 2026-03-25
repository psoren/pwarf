import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeSkill, makeItem, makeMapTile } from "./test-helpers.js";

describe("item lifecycle", () => {
  it("consumed food items are removed from state.items", async () => {
    const dwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      need_food: 10, // Very hungry — will eat immediately
      need_drink: 100, need_sleep: 100,
    });

    const food = makeItem({
      name: "Plump helmet", category: "food",
      position_x: 5, position_y: 5, position_z: 0,
      located_in_civ_id: "test-civ",
    });

    const tiles = Array.from({ length: 10 }, (_, x) =>
      Array.from({ length: 10 }, (_, y) => makeMapTile(x, y, 0, "grass")),
    ).flat();

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [],
      items: [food],
      tasks: [],
      fortressTileOverrides: tiles,
      ticks: 50,
      seed: 42,
    });

    // The food should have been eaten — removed from items
    const remainingFood = result.items.filter(i => i.id === food.id);
    expect(remainingFood.length).toBe(0);

    // Dwarf should have higher food need now
    expect(result.dwarves[0].need_food).toBeGreaterThan(10);
  });

  it("consumed drink items are removed from state.items", async () => {
    const dwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      need_food: 100,
      need_drink: 10, // Very thirsty
      need_sleep: 100,
    });

    const drink = makeItem({
      name: "Plump helmet brew", category: "drink", material: "plant",
      position_x: 5, position_y: 5, position_z: 0,
      located_in_civ_id: "test-civ",
    });

    const tiles = Array.from({ length: 10 }, (_, x) =>
      Array.from({ length: 10 }, (_, y) => makeMapTile(x, y, 0, "grass")),
    ).flat();

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [],
      items: [drink],
      tasks: [],
      fortressTileOverrides: tiles,
      ticks: 50,
      seed: 42,
    });

    const remainingDrink = result.items.filter(i => i.id === drink.id);
    expect(remainingDrink.length).toBe(0);
    expect(result.dwarves[0].need_drink).toBeGreaterThan(10);
  });

  it("building consumes raw materials from items", async () => {
    const dwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      need_food: 100, need_drink: 100, need_sleep: 100,
    });

    const stone = makeItem({
      name: "Stone block", category: "raw_material", material: "stone",
      position_x: 5, position_y: 5, position_z: 0,
      located_in_civ_id: "test-civ",
    });

    const tiles = Array.from({ length: 10 }, (_, x) =>
      Array.from({ length: 10 }, (_, y) => makeMapTile(x, y, 0, "grass")),
    ).flat();

    const { makeTask } = await import("./test-helpers.js");
    const buildWall = makeTask("build_wall", {
      status: "pending", target_x: 6, target_y: 5, target_z: 0,
      work_required: 40, priority: 10,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [makeSkill(dwarf.id, "building", 3)],
      items: [stone],
      tasks: [buildWall],
      fortressTileOverrides: tiles,
      ticks: 100,
      seed: 42,
    });

    // Wall should be built
    expect(result.tasks.find(t => t.id === buildWall.id)?.status).toBe("completed");
    // Stone should be consumed
    const remainingStone = result.items.filter(i => i.id === stone.id);
    expect(remainingStone.length).toBe(0);
  });

  it("mined items are created and added to state.items", async () => {
    const dwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      need_food: 100, need_drink: 100, need_sleep: 100,
    });

    const tiles = [
      makeMapTile(6, 5, 0, "rock"),
      ...Array.from({ length: 10 }, (_, x) =>
        Array.from({ length: 10 }, (_, y) => ({ x, y })),
      ).flat()
        .filter(({ x, y }) => !(x === 6 && y === 5))
        .map(({ x, y }) => makeMapTile(x, y, 0, "grass")),
    ];

    const { makeTask } = await import("./test-helpers.js");
    const mineTask = makeTask("mine", {
      status: "pending", target_x: 6, target_y: 5, target_z: 0,
      work_required: 100, priority: 10,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [makeSkill(dwarf.id, "mining", 3)],
      items: [],
      tasks: [mineTask],
      fortressTileOverrides: tiles,
      ticks: 120,
      seed: 42,
    });

    // Mine should complete
    expect(result.tasks.find(t => t.id === mineTask.id)?.status).toBe("completed");
    // Stone block should be created
    const stoneBlocks = result.items.filter(i => i.name === "Stone block");
    expect(stoneBlocks.length).toBeGreaterThan(0);
  });
});
