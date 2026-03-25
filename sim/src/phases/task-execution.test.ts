import { describe, it, expect } from "vitest";
import {
  BASE_WORK_RATE,
  HARDNESS_SOIL,
  HARDNESS_STONE,
  HARDNESS_ORE,
  HARDNESS_GEM,
  HARDNESS_IGNITE,
  CONSCIENTIOUSNESS_WORK_MULTIPLIER,
  SLEEP_RESTORE_PER_TICK,
  MAX_NEED,
} from "@pwarf/shared";
import { makeDwarf, makeTask, makeSkill, makeContext, makeMapTile, makeItem } from "../__tests__/test-helpers.js";

function stoneBlock() {
  return makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "civ-1", held_by_dwarf_id: null });
}
import { taskExecution, getTileHardness } from "./task-execution.js";

describe("getTileHardness", () => {
  it("returns HARDNESS_SOIL for soil tiles", () => {
    expect(getTileHardness("soil")).toBe(HARDNESS_SOIL);
  });

  it("returns HARDNESS_STONE for stone tiles", () => {
    expect(getTileHardness("stone")).toBe(HARDNESS_STONE);
  });

  it("returns HARDNESS_ORE for ore tiles", () => {
    expect(getTileHardness("ore")).toBe(HARDNESS_ORE);
  });

  it("returns HARDNESS_GEM for gem tiles", () => {
    expect(getTileHardness("gem")).toBe(HARDNESS_GEM);
  });

  it("returns HARDNESS_IGNITE for lava_stone tiles", () => {
    expect(getTileHardness("lava_stone")).toBe(HARDNESS_IGNITE);
  });

  it("returns HARDNESS_IGNITE for cavern_wall tiles", () => {
    expect(getTileHardness("cavern_wall")).toBe(HARDNESS_IGNITE);
  });

  it("returns HARDNESS_STONE for unknown tile types", () => {
    expect(getTileHardness("open_air")).toBe(HARDNESS_STONE);
    expect(getTileHardness(null)).toBe(HARDNESS_STONE);
  });
});

describe("taskExecution", () => {
  describe("work_progress advances each tick", () => {
    it("increments work_progress by BASE_WORK_RATE for unskilled tasks", async () => {
      const task = makeTask("build_floor", {
        status: "claimed",
        target_x: 0,
        target_y: 0,
        target_z: 0,
        work_required: 100,
        work_progress: 0,
      });
      const dwarf = makeDwarf({
        current_task_id: task.id,
        position_x: 0,
        position_y: 0,
        position_z: 0,
      });
      task.assigned_dwarf_id = dwarf.id;

      const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

      await taskExecution(ctx);

      expect(task.work_progress).toBe(BASE_WORK_RATE);
      expect(task.status).toBe("in_progress");
    });

    it("accumulates work over multiple ticks", async () => {
      const task = makeTask("build_floor", {
        status: "in_progress",
        target_x: 0,
        target_y: 0,
        target_z: 0,
        work_required: 100,
        work_progress: 0,
      });
      const dwarf = makeDwarf({
        current_task_id: task.id,
        position_x: 0,
        position_y: 0,
        position_z: 0,
      });
      task.assigned_dwarf_id = dwarf.id;

      const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

      await taskExecution(ctx);
      await taskExecution(ctx);
      await taskExecution(ctx);

      expect(task.work_progress).toBeCloseTo(BASE_WORK_RATE * 3, 5);
    });
  });

  describe("dwarf skill multiplier applied", () => {
    it("works faster with higher skill level", async () => {
      const task = makeTask("mine", {
        status: "in_progress",
        target_x: 1,
        target_y: 0,
        target_z: 0,
        work_required: 100,
        work_progress: 0,
      });
      const dwarf = makeDwarf({
        current_task_id: task.id,
        position_x: 0,
        position_y: 0,
        position_z: 0,
      });
      task.assigned_dwarf_id = dwarf.id;

      const skill = makeSkill(dwarf.id, "mining", 5);

      // Place a stone tile at the target for hardness lookup
      const tile = makeMapTile(1, 0, 0, "stone");

      const ctx = makeContext({ dwarves: [dwarf], tasks: [task], skills: [skill] });
      ctx.state.fortressTileOverrides.set("1,0,0", tile);

      await taskExecution(ctx);

      // Formula: BASE_WORK_RATE * (1 + skillLevel * 0.1) / hardness
      // = 1 * (1 + 5 * 0.1) / 1.0 = 1.5
      const expected = BASE_WORK_RATE * (1 + 5 * 0.1) / HARDNESS_STONE;
      expect(task.work_progress).toBeCloseTo(expected, 5);
    });

    it("works at base rate with no skill", async () => {
      const task = makeTask("mine", {
        status: "in_progress",
        target_x: 1,
        target_y: 0,
        target_z: 0,
        work_required: 100,
        work_progress: 0,
      });
      const dwarf = makeDwarf({
        current_task_id: task.id,
        position_x: 0,
        position_y: 0,
        position_z: 0,
      });
      task.assigned_dwarf_id = dwarf.id;

      const tile = makeMapTile(1, 0, 0, "stone");
      const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });
      ctx.state.fortressTileOverrides.set("1,0,0", tile);

      await taskExecution(ctx);

      // No skill → skillLevel=0 → multiplier=1.0
      expect(task.work_progress).toBeCloseTo(BASE_WORK_RATE / HARDNESS_STONE, 5);
    });
  });

  describe("conscientiousness modifier", () => {
    it("high conscientiousness increases work rate", async () => {
      const task = makeTask("build_floor", {
        status: "in_progress",
        target_x: 0,
        target_y: 0,
        target_z: 0,
        work_required: 100,
        work_progress: 0,
      });
      const dwarf = makeDwarf({
        current_task_id: task.id,
        position_x: 0,
        position_y: 0,
        position_z: 0,
        trait_conscientiousness: 1.0, // max → +25%
      });
      task.assigned_dwarf_id = dwarf.id;

      const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

      await taskExecution(ctx);

      const modifier = 1 + (1.0 - 0.5) * CONSCIENTIOUSNESS_WORK_MULTIPLIER;
      expect(task.work_progress).toBeCloseTo(BASE_WORK_RATE * modifier, 5);
    });

    it("low conscientiousness decreases work rate", async () => {
      const task = makeTask("build_floor", {
        status: "in_progress",
        target_x: 0,
        target_y: 0,
        target_z: 0,
        work_required: 100,
        work_progress: 0,
      });
      const dwarf = makeDwarf({
        current_task_id: task.id,
        position_x: 0,
        position_y: 0,
        position_z: 0,
        trait_conscientiousness: 0.0, // min → -25%
      });
      task.assigned_dwarf_id = dwarf.id;

      const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

      await taskExecution(ctx);

      const modifier = 1 + (0.0 - 0.5) * CONSCIENTIOUSNESS_WORK_MULTIPLIER;
      expect(task.work_progress).toBeCloseTo(BASE_WORK_RATE * modifier, 5);
    });

    it("null conscientiousness applies no modifier", async () => {
      const task = makeTask("build_floor", {
        status: "in_progress",
        target_x: 0,
        target_y: 0,
        target_z: 0,
        work_required: 100,
        work_progress: 0,
      });
      const dwarf = makeDwarf({
        current_task_id: task.id,
        position_x: 0,
        position_y: 0,
        position_z: 0,
        trait_conscientiousness: null,
      });
      task.assigned_dwarf_id = dwarf.id;

      const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

      await taskExecution(ctx);

      expect(task.work_progress).toBeCloseTo(BASE_WORK_RATE, 5);
    });
  });

  describe("task completes at 100%", () => {
    it("marks task complete when work_progress reaches work_required", async () => {
      const task = makeTask("build_floor", {
        status: "in_progress",
        target_x: 0,
        target_y: 0,
        target_z: 0,
        work_required: BASE_WORK_RATE, // Completes in 1 tick
        work_progress: 0,
      });
      const dwarf = makeDwarf({
        current_task_id: task.id,
        position_x: 0,
        position_y: 0,
        position_z: 0,
      });
      task.assigned_dwarf_id = dwarf.id;

      const ctx = makeContext({ dwarves: [dwarf], tasks: [task], items: [stoneBlock()] });

      await taskExecution(ctx);

      expect(task.status).toBe("completed");
      expect(dwarf.current_task_id).toBeNull();
    });

    it("does not complete task when progress is below required", async () => {
      const task = makeTask("build_floor", {
        status: "in_progress",
        target_x: 0,
        target_y: 0,
        target_z: 0,
        work_required: 100,
        work_progress: 0,
      });
      const dwarf = makeDwarf({
        current_task_id: task.id,
        position_x: 0,
        position_y: 0,
        position_z: 0,
      });
      task.assigned_dwarf_id = dwarf.id;

      const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

      await taskExecution(ctx);

      expect(task.status).toBe("in_progress");
      expect(dwarf.current_task_id).toBe(task.id);
    });
  });

  describe("work halts when dwarf dies", () => {
    it("skips dead dwarves entirely", async () => {
      const task = makeTask("build_floor", {
        status: "in_progress",
        target_x: 0,
        target_y: 0,
        target_z: 0,
        work_required: 100,
        work_progress: 50,
      });
      const dwarf = makeDwarf({
        current_task_id: task.id,
        position_x: 0,
        position_y: 0,
        position_z: 0,
        status: "dead",
      });
      task.assigned_dwarf_id = dwarf.id;

      const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

      await taskExecution(ctx);

      // Work should not advance
      expect(task.work_progress).toBe(50);
    });
  });

  describe("task status transitions", () => {
    it("transitions claimed → in_progress on first tick", async () => {
      const task = makeTask("build_floor", {
        status: "claimed",
        target_x: 0,
        target_y: 0,
        target_z: 0,
        work_required: 100,
      });
      const dwarf = makeDwarf({
        current_task_id: task.id,
        position_x: 0,
        position_y: 0,
        position_z: 0,
      });
      task.assigned_dwarf_id = dwarf.id;

      const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

      await taskExecution(ctx);

      expect(task.status).toBe("in_progress");
    });

    it("clears dwarf task when task not found in state", async () => {
      const dwarf = makeDwarf({
        current_task_id: "nonexistent-task-id",
        position_x: 0,
        position_y: 0,
        position_z: 0,
      });

      const ctx = makeContext({ dwarves: [dwarf], tasks: [] });

      await taskExecution(ctx);

      expect(dwarf.current_task_id).toBeNull();
    });
  });

  describe("movement toward target", () => {
    it("moves dwarf toward task target when not at site", async () => {
      const task = makeTask("build_floor", {
        status: "in_progress",
        target_x: 5,
        target_y: 0,
        target_z: 0,
        work_required: 100,
      });
      const dwarf = makeDwarf({
        current_task_id: task.id,
        position_x: 0,
        position_y: 0,
        position_z: 0,
      });
      task.assigned_dwarf_id = dwarf.id;

      const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

      await taskExecution(ctx);

      // Dwarf should have moved one step (not done work)
      const moved = dwarf.position_x !== 0 || dwarf.position_y !== 0;
      expect(moved).toBe(true);
      expect(task.work_progress).toBe(0); // No work done while moving
    });

    it("does work when already at task target", async () => {
      const task = makeTask("build_floor", {
        status: "in_progress",
        target_x: 0,
        target_y: 0,
        target_z: 0,
        work_required: 100,
      });
      const dwarf = makeDwarf({
        current_task_id: task.id,
        position_x: 0,
        position_y: 0,
        position_z: 0,
      });
      task.assigned_dwarf_id = dwarf.id;

      const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

      await taskExecution(ctx);

      expect(task.work_progress).toBeGreaterThan(0);
    });
  });

  describe("adjacent task types (mine, build_wall, deconstruct)", () => {
    it("mine task works when dwarf is adjacent to target", async () => {
      const task = makeTask("mine", {
        status: "in_progress",
        target_x: 1,
        target_y: 0,
        target_z: 0,
        work_required: 100,
      });
      const dwarf = makeDwarf({
        current_task_id: task.id,
        position_x: 0, // Adjacent (dx=1)
        position_y: 0,
        position_z: 0,
      });
      task.assigned_dwarf_id = dwarf.id;

      const tile = makeMapTile(1, 0, 0, "stone");
      const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });
      ctx.state.fortressTileOverrides.set("1,0,0", tile);

      await taskExecution(ctx);

      expect(task.work_progress).toBeGreaterThan(0);
      // Dwarf should NOT have moved onto the tile — mine is adjacent
      expect(dwarf.position_x).toBe(0);
    });
  });

  describe("sleep restores energy", () => {
    it("restores need_sleep while sleeping", async () => {
      const task = makeTask("sleep", {
        status: "in_progress",
        target_x: 0,
        target_y: 0,
        target_z: 0,
        work_required: 100,
      });
      const dwarf = makeDwarf({
        current_task_id: task.id,
        position_x: 0,
        position_y: 0,
        position_z: 0,
        need_sleep: 20,
      });
      task.assigned_dwarf_id = dwarf.id;

      const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

      await taskExecution(ctx);

      expect(dwarf.need_sleep).toBe(Math.min(MAX_NEED, 20 + SLEEP_RESTORE_PER_TICK));
    });
  });

  describe("mining hardness affects work rate", () => {
    it("mines soil faster than stone", async () => {
      // Soil mining
      const soilTask = makeTask("mine", {
        status: "in_progress",
        target_x: 1,
        target_y: 0,
        target_z: 0,
        work_required: 100,
        work_progress: 0,
      });
      const soilDwarf = makeDwarf({
        current_task_id: soilTask.id,
        position_x: 0,
        position_y: 0,
        position_z: 0,
      });
      soilTask.assigned_dwarf_id = soilDwarf.id;

      const soilTile = makeMapTile(1, 0, 0, "soil");
      const soilCtx = makeContext({ dwarves: [soilDwarf], tasks: [soilTask] });
      soilCtx.state.fortressTileOverrides.set("1,0,0", soilTile);

      await taskExecution(soilCtx);

      // Stone mining
      const stoneTask = makeTask("mine", {
        status: "in_progress",
        target_x: 1,
        target_y: 0,
        target_z: 0,
        work_required: 100,
        work_progress: 0,
      });
      const stoneDwarf = makeDwarf({
        current_task_id: stoneTask.id,
        position_x: 0,
        position_y: 0,
        position_z: 0,
      });
      stoneTask.assigned_dwarf_id = stoneDwarf.id;

      const stoneTile = makeMapTile(1, 0, 0, "stone");
      const stoneCtx = makeContext({ dwarves: [stoneDwarf], tasks: [stoneTask] });
      stoneCtx.state.fortressTileOverrides.set("1,0,0", stoneTile);

      await taskExecution(stoneCtx);

      // Soil should have more progress (lower hardness)
      expect(soilTask.work_progress).toBeGreaterThan(stoneTask.work_progress);
    });
  });

  describe("anti-oscillation", () => {
    it("prevents a dwarf from oscillating via alt-path backtracking", async () => {
      // Narrow 1-wide corridor: (0,0) → (1,0) → (2,0) → (3,0)
      // Everything else is wall. Dwarf at (1,0), blocker at (2,0), task at (3,0).
      // Primary BFS says go to (2,0), but it's occupied. Alt BFS can only
      // route back to (0,0). With anti-oscillation: dwarf waits instead.
      const blocker = makeDwarf({
        position_x: 2,
        position_y: 0,
        position_z: 0,
      });

      const task = makeTask("farm_till", {
        status: "in_progress",
        target_x: 3,
        target_y: 0,
        target_z: 0,
        work_required: 100,
        work_progress: 0,
      });

      const dwarf = makeDwarf({
        current_task_id: task.id,
        position_x: 1,
        position_y: 0,
        position_z: 0,
      });
      task.assigned_dwarf_id = dwarf.id;

      const ctx = makeContext({ dwarves: [dwarf, blocker], tasks: [task] });

      // Use a deriver that returns walls everywhere — only overrides are walkable
      ctx.fortressDeriver = {
        deriveTile: () => ({ tileType: 'constructed_wall' as const, material: 'stone', isMined: false }),
        baseTileType: 'constructed_wall' as any,
        getZForEntrance: () => null,
        getEntranceForZ: () => null,
        getCaveName: () => null,
      } as any;

      // Only the corridor tiles are walkable
      for (let x = 0; x <= 3; x++) {
        ctx.state.fortressTileOverrides.set(`${x},0,0`, makeMapTile(x, 0, 0, "open_air"));
      }

      // Simulate that the dwarf previously came from (0,0)
      ctx.state._previousPositions = new Map();
      ctx.state._previousPositions.set(dwarf.id, "0,0,0");

      await taskExecution(ctx);

      // The dwarf should NOT have moved back to (0,0) — should stay at (1,0)
      expect(dwarf.position_x).toBe(1);
      expect(dwarf.position_y).toBe(0);

      // Occupancy wait counter should have incremented
      expect(ctx.state._occupancyWaitTicks?.get(dwarf.id)).toBe(1);
    });

    it("records previous position on successful movement", async () => {
      const task = makeTask("farm_till", {
        status: "in_progress",
        target_x: 3,
        target_y: 0,
        target_z: 0,
        work_required: 100,
        work_progress: 0,
      });

      const dwarf = makeDwarf({
        current_task_id: task.id,
        position_x: 0,
        position_y: 0,
        position_z: 0,
      });
      task.assigned_dwarf_id = dwarf.id;

      const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

      // Set up walkable corridor
      for (let x = 0; x <= 3; x++) {
        ctx.state.fortressTileOverrides.set(`${x},0,0`, makeMapTile(x, 0, 0, "open_air"));
      }

      await taskExecution(ctx);

      // Dwarf should have moved to (1,0,0)
      expect(dwarf.position_x).toBe(1);

      // Previous position should be recorded as (0,0,0)
      expect(ctx.state._previousPositions?.get(dwarf.id)).toBe("0,0,0");
    });
  });
});
