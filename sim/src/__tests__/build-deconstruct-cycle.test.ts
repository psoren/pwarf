import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeSkill, makeTask, makeItem, makeMapTile } from "./test-helpers.js";
import { createFortressDeriver } from "@pwarf/shared";

const fortressDeriver = createFortressDeriver(42n, "test-civ", "plains");

describe("build and deconstruct cycle", () => {
  it("builds structures then deconstructs them back to open_air", async () => {
    const dwarf = makeDwarf({
      name: "Builder", position_x: 256, position_y: 256, position_z: 0,
      need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80,
    });

    // Phase 1: Build a wall, floor, and door
    // Phase 2: Deconstruct them all
    // Tasks are ordered by priority so builds happen before deconstructs
    const tasks = [
      // Builds (high priority — done first)
      makeTask("build_wall", { status: "pending", target_x: 257, target_y: 256, target_z: 0, work_required: 40, priority: 10 }),
      makeTask("build_floor", { status: "pending", target_x: 258, target_y: 256, target_z: 0, work_required: 25, priority: 9 }),
      makeTask("build_door", { status: "pending", target_x: 259, target_y: 256, target_z: 0, work_required: 35, priority: 8 }),
      // Deconstructs (lower priority — done after builds)
      makeTask("deconstruct", { status: "pending", target_x: 257, target_y: 256, target_z: 0, work_required: 30, priority: 4 }),
      makeTask("deconstruct", { status: "pending", target_x: 258, target_y: 256, target_z: 0, work_required: 30, priority: 3 }),
      makeTask("deconstruct", { status: "pending", target_x: 259, target_y: 256, target_z: 0, work_required: 30, priority: 2 }),
    ];

    const items = [
      // Stone for wall + floor (1 each)
      makeItem({ name: "Stone block", category: "raw_material", material: "stone", position_x: 256, position_y: 256, position_z: 0, located_in_civ_id: "test-civ" }),
      makeItem({ name: "Stone block", category: "raw_material", material: "stone", position_x: 256, position_y: 256, position_z: 0, located_in_civ_id: "test-civ" }),
      // Wood for door (1)
      makeItem({ name: "Wood log", category: "raw_material", material: "wood", position_x: 256, position_y: 256, position_z: 0, located_in_civ_id: "test-civ" }),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [makeSkill(dwarf.id, "building", 3)],
      items,
      tasks,
      fortressDeriver,
      ticks: 3000,
      seed: 42,
    });

    // All 6 tasks (3 builds + 3 deconstructs) should complete
    const originalTasks = result.tasks.filter(t => tasks.some(orig => orig.id === t.id));
    const completed = originalTasks.filter(t => t.status === "completed");
    expect(completed.length).toBe(6);

    // After deconstruction, tiles should be open_air
    for (const pos of [{ x: 257, y: 256 }, { x: 258, y: 256 }, { x: 259, y: 256 }]) {
      const tile = result.fortressTileOverrides.find(
        t => t.x === pos.x && t.y === pos.y && t.z === 0,
      );
      expect(tile?.tile_type).toBe("open_air");
    }

    // Door structure should have been removed
    const doorStructures = result.structures.filter(s => s.type === "door");
    expect(doorStructures.length).toBe(0);
  });

  it("mine trees, build with wood, mine rock, build with stone, then deconstruct all", async () => {
    // Full cycle: gather resources → build → tear down

    const dwarf = makeDwarf({
      name: "Urist", position_x: 256, position_y: 256, position_z: 0,
      need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80,
    });

    // Need: 2 wood (door + mushroom_garden), 4 stone (wall + floor + well×2)
    // Tree overrides at (250, 256) and (250, 257)
    // Rock overrides at (262, 256..260)
    const tileOverrides = [
      makeMapTile(250, 256, 0, "tree"),
      makeMapTile(250, 257, 0, "tree"),
      makeMapTile(262, 256, 0, "rock"),
      makeMapTile(262, 257, 0, "rock"),
      makeMapTile(262, 258, 0, "rock"),
      makeMapTile(262, 259, 0, "rock"),
      makeMapTile(262, 260, 0, "rock"),
    ];

    const tasks = [
      // Phase 1: Mine resources (highest priority)
      makeTask("mine", { status: "pending", target_x: 250, target_y: 256, target_z: 0, work_required: 100, priority: 10 }),
      makeTask("mine", { status: "pending", target_x: 250, target_y: 257, target_z: 0, work_required: 100, priority: 10 }),
      makeTask("mine", { status: "pending", target_x: 262, target_y: 256, target_z: 0, work_required: 100, priority: 9 }),
      makeTask("mine", { status: "pending", target_x: 262, target_y: 257, target_z: 0, work_required: 100, priority: 9 }),
      makeTask("mine", { status: "pending", target_x: 262, target_y: 258, target_z: 0, work_required: 100, priority: 9 }),
      makeTask("mine", { status: "pending", target_x: 262, target_y: 259, target_z: 0, work_required: 100, priority: 9 }),
      makeTask("mine", { status: "pending", target_x: 262, target_y: 260, target_z: 0, work_required: 100, priority: 9 }),
      // Phase 2: Build (medium priority)
      makeTask("build_door", { status: "pending", target_x: 256, target_y: 260, target_z: 0, work_required: 35, priority: 6 }),
      makeTask("build_mushroom_garden", { status: "pending", target_x: 256, target_y: 261, target_z: 0, work_required: 50, priority: 6 }),
      makeTask("build_wall", { status: "pending", target_x: 256, target_y: 262, target_z: 0, work_required: 40, priority: 6 }),
      makeTask("build_floor", { status: "pending", target_x: 256, target_y: 263, target_z: 0, work_required: 25, priority: 6 }),
      makeTask("build_well", { status: "pending", target_x: 256, target_y: 264, target_z: 0, work_required: 60, priority: 5 }),
      // Phase 3: Deconstruct everything (low priority)
      makeTask("deconstruct", { status: "pending", target_x: 256, target_y: 260, target_z: 0, work_required: 30, priority: 2 }),
      makeTask("deconstruct", { status: "pending", target_x: 256, target_y: 261, target_z: 0, work_required: 30, priority: 2 }),
      makeTask("deconstruct", { status: "pending", target_x: 256, target_y: 262, target_z: 0, work_required: 30, priority: 2 }),
      makeTask("deconstruct", { status: "pending", target_x: 256, target_y: 263, target_z: 0, work_required: 30, priority: 2 }),
      makeTask("deconstruct", { status: "pending", target_x: 256, target_y: 264, target_z: 0, work_required: 30, priority: 2 }),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [
        makeSkill(dwarf.id, "mining", 3),
        makeSkill(dwarf.id, "building", 3),
      ],
      items: [],
      tasks,
      fortressTileOverrides: tileOverrides,
      fortressDeriver,
      ticks: 5000,
      seed: 42,
    });

    // All 17 tasks should complete
    const originalTasks = result.tasks.filter(t => tasks.some(orig => orig.id === t.id));
    const completed = originalTasks.filter(t => t.status === "completed");
    const incomplete = originalTasks.filter(t => t.status !== "completed");

    if (incomplete.length > 0) {
      console.log("Incomplete tasks:");
      for (const t of incomplete) {
        console.log(`  ${t.task_type} @ (${t.target_x},${t.target_y}) — ${t.status} progress=${t.work_progress.toFixed(1)}/${t.work_required}`);
      }
    }

    expect(completed.length).toBe(17);

    // After deconstruction, all built tiles should be open_air
    for (let y = 260; y <= 264; y++) {
      const tile = result.fortressTileOverrides.find(
        t => t.x === 256 && t.y === y && t.z === 0,
      );
      expect(tile?.tile_type).toBe("open_air");
    }

    // All structures should have been removed
    const builtStructures = result.structures.filter(
      s => s.position_x === 256 && s.position_y != null && s.position_y >= 260 && s.position_y <= 264,
    );
    expect(builtStructures.length).toBe(0);

    // Mined tiles should be grass (z=0 surface)
    for (const pos of [{ x: 250, y: 256 }, { x: 250, y: 257 }, { x: 262, y: 256 }, { x: 262, y: 257 }, { x: 262, y: 258 }, { x: 262, y: 259 }, { x: 262, y: 260 }]) {
      const tile = result.fortressTileOverrides.find(
        t => t.x === pos.x && t.y === pos.y && t.z === 0,
      );
      expect(tile?.is_mined).toBe(true);
    }

    // Dwarf should still be alive
    expect(result.dwarves[0].status).toBe("alive");
  });

  it("build a bed, sleep in it, deconstruct it", async () => {
    const dwarf = makeDwarf({
      name: "Sleepy", position_x: 256, position_y: 256, position_z: 0,
      need_food: 100, need_drink: 100,
      need_sleep: 5, // Exhausted — will sleep as soon as a bed exists
      need_social: 80,
    });

    const tasks = [
      // Build bed first (high priority)
      makeTask("build_bed", { status: "pending", target_x: 257, target_y: 256, target_z: 0, work_required: 30, priority: 10 }),
      // Deconstruct after sleeping (low priority — will execute after bed is built + sleep happens)
      makeTask("deconstruct", { status: "pending", target_x: 257, target_y: 256, target_z: 0, work_required: 30, priority: 1 }),
    ];

    const items = [
      makeItem({ name: "Wood log", category: "raw_material", material: "wood", position_x: 256, position_y: 256, position_z: 0, located_in_civ_id: "test-civ" }),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [makeSkill(dwarf.id, "building", 3)],
      items,
      tasks,
      fortressDeriver,
      ticks: 1000,
      seed: 42,
    });

    // Build bed should complete
    const buildBed = result.tasks.find(t => t.id === tasks[0].id);
    expect(buildBed?.status).toBe("completed");

    // Deconstruct should complete
    const deconstructBed = result.tasks.find(t => t.id === tasks[1].id);
    expect(deconstructBed?.status).toBe("completed");

    // Bed structure should be removed after deconstruct
    const beds = result.structures.filter(s => s.type === "bed");
    expect(beds.length).toBe(0);

    // Sleep need should have recovered (dwarf slept during the scenario)
    expect(result.dwarves[0].need_sleep).toBeGreaterThan(5);

    // Tile should be open_air after deconstruct
    const tile = result.fortressTileOverrides.find(
      t => t.x === 257 && t.y === 256 && t.z === 0,
    );
    expect(tile?.tile_type).toBe("open_air");
  });
});
