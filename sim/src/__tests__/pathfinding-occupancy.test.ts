import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeSkill, makeTask, makeItem, makeMapTile } from "./test-helpers.js";
import { bfsNextStep } from "../pathfinding.js";
import type { FortressTileType } from "@pwarf/shared";

describe("pathfinding around occupied tiles", () => {
  it("dwarf routes around a stationary dwarf blocking the shortest path", async () => {
    // Scenario: Bomrek at (4,5) needs to reach (5,11) to build a well.
    // Urist is stationary at (5,5) doing a long build task — directly on the shortest path.
    // Without the fix, Bomrek waits forever at (4,5) with 0 progress.
    // With the fix, Bomrek routes around Urist and completes the well.

    const dwarf1 = makeDwarf({
      name: "Urist",
      surname: "Miner",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
      need_social: 80,
    });

    const dwarf2 = makeDwarf({
      name: "Bomrek",
      surname: "Builder",
      position_x: 4,
      position_y: 5,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
      need_social: 80,
    });

    // Give Urist a long build_floor task at (5,5) so he stays put.
    // Pre-assign with "claimed" status to avoid job-claiming reassignment.
    const blockingTask = makeTask("build_floor", {
      status: "claimed",
      assigned_dwarf_id: dwarf1.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: 500, // Very long — keeps him stationary for the whole run
    });
    dwarf1.current_task_id = blockingTask.id;

    // Well task pre-assigned to Bomrek
    const wellTask = makeTask("build_well", {
      status: "claimed",
      assigned_dwarf_id: dwarf2.id,
      target_x: 5,
      target_y: 11,
      target_z: 0,
      work_required: 60,
    });
    dwarf2.current_task_id = wellTask.id;

    // 15x15 grass grid
    const tiles = Array.from({ length: 15 }, (_, x) =>
      Array.from({ length: 15 }, (_, y) => makeMapTile(x, y, 0, "grass")),
    ).flat();

    const result = await runScenario({
      dwarves: [dwarf1, dwarf2],
      dwarfSkills: [
        makeSkill(dwarf1.id, "building", 1),
        makeSkill(dwarf2.id, "building", 3),
      ],
      items: [
        // 2 stone blocks for the well — must use "test-civ" to match runScenario's civilizationId
        makeItem({ name: "Stone block", category: "raw_material", material: "stone", position_x: 4, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
        makeItem({ name: "Stone block", category: "raw_material", material: "stone", position_x: 4, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
        // 1 stone for the blocking floor task
        makeItem({ name: "Stone block", category: "raw_material", material: "stone", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
        // Drinks to suppress auto-brew
        ...Array.from({ length: 10 }, () =>
          makeItem({ name: "Plump helmet brew", category: "drink", material: "plant", position_x: 5, position_y: 5, position_z: 0 }),
        ),
      ],
      tasks: [blockingTask, wellTask],
      fortressTileOverrides: tiles,
      ticks: 200,
      seed: 42,
    });

    // The well task must complete — Bomrek should route around Urist
    const well = result.tasks.find(t => t.id === wellTask.id);
    expect(well?.status).toBe("completed");

    // A well structure should exist
    const wellStructure = result.structures.find(s => s.type === "well");
    expect(wellStructure).toBeDefined();
    expect(wellStructure?.position_x).toBe(5);
    expect(wellStructure?.position_y).toBe(11);
  });

  it("dwarf waits when ALL paths are blocked (no alternative route)", async () => {
    // Scenario: dwarf in a 1-wide corridor blocked by another dwarf.
    // No alternative path exists, so waiting is correct behavior.

    const blocker = makeDwarf({
      name: "Blocker",
      surname: "Dwarf",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const mover = makeDwarf({
      name: "Mover",
      surname: "Dwarf",
      position_x: 5,
      position_y: 3,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    // Create a 1-wide corridor: only (5,3), (5,4), (5,5), (5,6), (5,7) are walkable
    const corridorTiles = [
      makeMapTile(5, 3, 0, "grass"),
      makeMapTile(5, 4, 0, "grass"),
      makeMapTile(5, 5, 0, "grass"),
      makeMapTile(5, 6, 0, "grass"),
      makeMapTile(5, 7, 0, "grass"),
    ];

    // Blocker has a very long task at (5,5) — pre-assigned to stay put
    const blockTask = makeTask("build_floor", {
      status: "claimed",
      assigned_dwarf_id: blocker.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: 5000,
    });
    blocker.current_task_id = blockTask.id;

    // Mover needs to build at (5,7) — pre-assigned
    const buildTask = makeTask("build_floor", {
      status: "claimed",
      assigned_dwarf_id: mover.id,
      target_x: 5,
      target_y: 7,
      target_z: 0,
      work_required: 25,
    });
    mover.current_task_id = buildTask.id;

    const result = await runScenario({
      dwarves: [blocker, mover],
      dwarfSkills: [
        makeSkill(blocker.id, "building", 1),
        makeSkill(mover.id, "building", 3),
      ],
      items: [
        makeItem({ name: "Stone block", category: "raw_material", material: "stone", position_x: 5, position_y: 3, position_z: 0, located_in_civ_id: "test-civ" }),
        makeItem({ name: "Stone block", category: "raw_material", material: "stone", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
      ],
      tasks: [blockTask, buildTask],
      fortressTileOverrides: corridorTiles,
      ticks: 100,
      seed: 42,
    });

    // The build task should NOT complete — mover is truly blocked with no alternative path
    const build = result.tasks.find(t => t.id === buildTask.id);
    expect(build?.status).not.toBe("completed");

    // Mover should still be alive (didn't crash or fail catastrophically)
    const moverResult = result.dwarves.find(d => d.id === mover.id);
    expect(moverResult?.status).toBe("alive");
  });

  it("bfsNextStep avoids blocked tiles when blockedTiles set is provided", () => {
    // Unit test for the bfsNextStep blockedTiles parameter directly
    const getTile = (_x: number, _y: number, _z: number): FortressTileType | null => {
      // 10x10 grass grid
      if (_x >= 0 && _x < 10 && _y >= 0 && _y < 10 && _z === 0) return "grass";
      return null;
    };

    const start = { x: 4, y: 5, z: 0 };
    const goal = { x: 6, y: 5, z: 0 };

    // Without blocked tiles: shortest path goes through (5,5)
    const step1 = bfsNextStep(start, goal, getTile, false);
    expect(step1).toEqual({ x: 5, y: 5, z: 0 });

    // With (5,5) blocked: must route around
    const blocked = new Set(["5,5,0"]);
    const step2 = bfsNextStep(start, goal, getTile, false, undefined, blocked);
    expect(step2).not.toBeNull();
    expect(step2).not.toEqual({ x: 5, y: 5, z: 0 });
    // The alternative step should still be adjacent to start
    if (step2) {
      const dist = Math.abs(step2.x - start.x) + Math.abs(step2.y - start.y);
      expect(dist).toBe(1);
    }
  });
});
