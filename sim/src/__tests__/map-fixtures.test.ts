import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeMapTile } from "./test-helpers.js";
import { WORK_MINE_BASE } from "@pwarf/shared";

/**
 * Tests for custom map fixture support via ScenarioConfig.fortressTileOverrides.
 *
 * Without fixtures, all tiles default to open_air (no deriver). Fixtures let
 * scenario tests control exactly what tile type is at a given position.
 */

describe("map fixture: rock tile", () => {
  it("mining a rock tile produces a stone block", async () => {
    const dwarf = makeDwarf({ position_x: 1, position_y: 0, position_z: -1 });
    const task = makeTask("mine", {
      assigned_dwarf_id: dwarf.id,
      target_x: 2,
      target_y: 0,
      target_z: -1,
      work_required: WORK_MINE_BASE,
    });
    dwarf.current_task_id = task.id;

    const rockTile = makeMapTile(2, 0, -1, "rock");

    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      fortressTileOverrides: [rockTile],
      ticks: WORK_MINE_BASE + 5,
    });

    const stone = result.items.find(i => i.name === "Stone block" && i.material === "stone");
    expect(stone).toBeDefined();

    const minedTile = result.fortressTileOverrides.find(t => t.x === 2 && t.y === 0 && t.z === -1);
    expect(minedTile?.is_mined).toBe(true);
    // Underground tiles become open_air after mining
    expect(minedTile?.tile_type).toBe("open_air");
  });
});

describe("map fixture: tree tile", () => {
  it("mining a tree tile produces a wood log", async () => {
    const dwarf = makeDwarf({ position_x: 1, position_y: 0, position_z: 0 });
    const task = makeTask("mine", {
      assigned_dwarf_id: dwarf.id,
      target_x: 2,
      target_y: 0,
      target_z: 0,
      work_required: WORK_MINE_BASE,
    });
    dwarf.current_task_id = task.id;

    const treeTile = makeMapTile(2, 0, 0, "tree");

    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      fortressTileOverrides: [treeTile],
      ticks: WORK_MINE_BASE + 5,
    });

    const log = result.items.find(i => i.name === "Wood log" && i.material === "wood");
    expect(log).toBeDefined();
  });
});

describe("map fixture: multiple tiles", () => {
  it("tile overrides are applied at scenario start", async () => {
    // Place a wall tile, run for 1 tick, verify it's still there
    const rockTile = makeMapTile(5, 5, 0, "rock");
    const grassTile = makeMapTile(3, 3, 0, "grass");

    const result = await runScenario({
      dwarves: [],
      fortressTileOverrides: [rockTile, grassTile],
      ticks: 1,
    });

    const rock = result.fortressTileOverrides.find(t => t.x === 5 && t.y === 5);
    expect(rock?.tile_type).toBe("rock");

    const grass = result.fortressTileOverrides.find(t => t.x === 3 && t.y === 3);
    expect(grass?.tile_type).toBe("grass");
  });
});
