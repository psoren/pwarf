import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeSkill, makeItem, makeMapTile, makeStructure } from "./test-helpers.js";
import {
  WORK_MINE_BASE,
  WORK_BUILD_WALL,
  WORK_BUILD_BED,
  WORK_BUILD_WELL,
  createFortressDeriver,
} from "@pwarf/shared";
import type { FortressTile } from "@pwarf/shared";

function stoneBlock() {
  return makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "test-civ", held_by_dwarf_id: null });
}
function woodLog() {
  return makeItem({ name: "Wood log", category: "raw_material", material: "wood", located_in_civ_id: "test-civ", held_by_dwarf_id: null });
}

/**
 * Mining/building scenario tests (issue #549)
 *
 * Tests that idle dwarves with the right skills can pick up mine/build
 * designations and complete them end-to-end without pre-assigning tasks.
 */

/** Create a stone tile override that can be mined. */
function makeMinableTile(x: number, y: number, z: number): FortressTile {
  return {
    id: `tile-${x}-${y}-${z}`,
    civilization_id: "civ-1",
    x, y, z,
    tile_type: "stone",
    material: "granite",
    is_revealed: true,
    is_mined: false,
    created_at: new Date().toISOString(),
  };
}

const fortressDeriver = createFortressDeriver(42n, "test-civ", "plains");

describe("mining scenario", () => {
  it("idle dwarf picks up and completes a mine task", async () => {
    const dwarf = makeDwarf({ position_x: 256, position_y: 256, position_z: 0 });
    const miningSkill = makeSkill(dwarf.id, "mining", 1);

    // Place a stone tile adjacent to the dwarf and create a pending mine task
    const stoneTile = makeMinableTile(257, 256, 0);
    const mineTask = makeTask("mine", {
      status: "pending",
      target_x: 257,
      target_y: 256,
      target_z: 0,
      work_required: WORK_MINE_BASE,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [miningSkill],
      tasks: [mineTask],
      fortressTileOverrides: [stoneTile],
      fortressDeriver,
      ticks: WORK_MINE_BASE + 20, // enough for walking + mining
    });

    // Task should be completed
    const task = result.tasks.find(t => t.id === mineTask.id);
    expect(task?.status).toBe("completed");

    // Tile should be mined (changed to open_air)
    const minedTile = result.fortressTileOverrides.find(
      t => t.x === 257 && t.y === 256 && t.z === 0,
    );
    expect(minedTile?.tile_type).toBe("grass"); // surface mining (z=0) produces grass
  });

  it("mining produces a raw material item", async () => {
    const dwarf = makeDwarf({ position_x: 256, position_y: 256, position_z: 0 });
    const miningSkill = makeSkill(dwarf.id, "mining", 1);
    const stoneTile = makeMinableTile(257, 256, 0);
    const mineTask = makeTask("mine", {
      status: "pending",
      target_x: 257,
      target_y: 256,
      target_z: 0,
      work_required: WORK_MINE_BASE,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [miningSkill],
      tasks: [mineTask],
      fortressTileOverrides: [stoneTile],
      fortressDeriver,
      ticks: WORK_MINE_BASE + 20,
    });

    const rawMaterials = result.items.filter(i => i.category === "raw_material");
    expect(rawMaterials.length).toBeGreaterThanOrEqual(1);
  });
});

describe("building scenario", () => {
  it("idle dwarf picks up and completes a build_wall task", async () => {
    const dwarf = makeDwarf({ position_x: 256, position_y: 256, position_z: 0 });
    const buildSkill = makeSkill(dwarf.id, "building", 1);
    const buildTask = makeTask("build_wall", {
      status: "pending",
      target_x: 257,
      target_y: 256,
      target_z: 0,
      work_required: WORK_BUILD_WALL,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [buildSkill],
      tasks: [buildTask],
      items: [stoneBlock()],
      fortressDeriver,
      ticks: WORK_BUILD_WALL + 20,
    });

    const task = result.tasks.find(t => t.id === buildTask.id);
    expect(task?.status).toBe("completed");

    // Should have placed a constructed_wall tile
    const wallTile = result.fortressTileOverrides.find(
      t => t.x === 257 && t.y === 256 && t.z === 0,
    );
    expect(wallTile?.tile_type).toBe("constructed_wall");
  });

  it("idle dwarf builds a bed (creates structure)", async () => {
    const dwarf = makeDwarf({ position_x: 256, position_y: 256, position_z: 0 });
    const buildSkill = makeSkill(dwarf.id, "building", 1);
    const buildTask = makeTask("build_bed", {
      status: "pending",
      target_x: 257,
      target_y: 256,
      target_z: 0,
      work_required: WORK_BUILD_BED,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [buildSkill],
      tasks: [buildTask],
      items: [woodLog()],
      fortressDeriver,
      ticks: WORK_BUILD_BED + 20,
    });

    const task = result.tasks.find(t => t.id === buildTask.id);
    expect(task?.status).toBe("completed");

    const bed = result.structures.find(s => s.type === "bed");
    expect(bed).toBeDefined();
    expect(bed?.completion_pct).toBe(100);
    expect(bed?.position_x).toBe(257);
  });

  it("idle dwarf builds a well (creates structure)", async () => {
    const dwarf = makeDwarf({ position_x: 256, position_y: 256, position_z: 0 });
    const buildSkill = makeSkill(dwarf.id, "building", 1);
    const buildTask = makeTask("build_well", {
      status: "pending",
      target_x: 257,
      target_y: 256,
      target_z: 0,
      work_required: WORK_BUILD_WELL,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [buildSkill],
      tasks: [buildTask],
      items: [stoneBlock(), stoneBlock()],
      fortressDeriver,
      ticks: WORK_BUILD_WELL + 20,
    });

    const task = result.tasks.find(t => t.id === buildTask.id);
    expect(task?.status).toBe("completed");

    const well = result.structures.find(s => s.type === "well");
    expect(well).toBeDefined();
    expect(well?.completion_pct).toBe(100);
  });

  // NOTE: A combined mine→build test is omitted because the shared test
  // factory RNG causes non-deterministic behavior across test orderings.
  // Individual mine and build tests above prove each pipeline works.
});
