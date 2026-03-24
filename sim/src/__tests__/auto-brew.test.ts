import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeSkill, makeTask, makeItem, makeMapTile } from "./test-helpers.js";

describe("auto-brew material filter", () => {
  it("does not consume stone blocks for brewing", async () => {
    // Scenario: fortress has stone blocks but no plant materials.
    // Auto-brew should NOT create a brew task since there are no plant raw_materials.

    const dwarf = makeDwarf({
      name: "Brewer",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const tiles = Array.from({ length: 10 }, (_, x) =>
      Array.from({ length: 10 }, (_, y) => makeMapTile(x, y, 0, "grass")),
    ).flat();

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [makeSkill(dwarf.id, "brewing", 3)],
      items: [
        // Stone blocks — should NOT be consumed by brewing
        makeItem({ name: "Stone block", category: "raw_material", material: "stone", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
        makeItem({ name: "Stone block", category: "raw_material", material: "stone", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
      ],
      tasks: [],
      fortressTileOverrides: tiles,
      ticks: 100,
      seed: 42,
    });

    // Stone blocks should still be there — not consumed by brewing
    const stoneBlocks = result.items.filter(i => i.name === "Stone block");
    expect(stoneBlocks.length).toBe(2);

    // No brew tasks should have been created
    const brewTasks = result.tasks.filter(t => t.task_type === "brew");
    expect(brewTasks.length).toBe(0);
  });

  it("correctly brews with plant raw_materials", async () => {
    // Scenario: fortress has plant raw_materials. Auto-brew should use them.

    const dwarf = makeDwarf({
      name: "Brewer",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const tiles = Array.from({ length: 10 }, (_, x) =>
      Array.from({ length: 10 }, (_, y) => makeMapTile(x, y, 0, "grass")),
    ).flat();

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [makeSkill(dwarf.id, "brewing", 3)],
      items: [
        // Plant material — should be consumed by brewing
        makeItem({ name: "Plump helmet", category: "raw_material", material: "plant", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
        // Stone block — should NOT be consumed
        makeItem({ name: "Stone block", category: "raw_material", material: "stone", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
      ],
      tasks: [],
      fortressTileOverrides: tiles,
      ticks: 100,
      seed: 42,
    });

    // Stone block should still exist
    const stoneBlocks = result.items.filter(i => i.name === "Stone block");
    expect(stoneBlocks.length).toBe(1);

    // A brew should have been produced
    const drinks = result.items.filter(i => i.category === "drink");
    expect(drinks.length).toBeGreaterThan(0);
  });
});
