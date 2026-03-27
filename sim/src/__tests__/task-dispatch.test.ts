import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { Task, FortressTileType, FortressDeriver } from "@pwarf/shared";
import {
  NEED_INTERRUPT_FOOD,
  NEED_INTERRUPT_DRINK,
  STARVATION_TICKS,
  FOOD_RESTORE_AMOUNT,
  DRINK_RESTORE_AMOUNT,
  SLEEP_RESTORE_AMOUNT,
  SLEEP_RESTORE_PER_TICK,
  BASE_WORK_RATE,
  WORK_EAT,
  WORK_SLEEP,
  MAX_NEED,
} from "@pwarf/shared";
import { needsDecay } from "../phases/needs-decay.js";
import { jobClaiming } from "../phases/job-claiming.js";
import { taskExecution } from "../phases/task-execution.js";
import { needSatisfaction } from "../phases/need-satisfaction.js";
import { stressUpdate } from "../phases/stress-update.js";
import { createTask, isDwarfIdle, getBestSkill } from "../task-helpers.js";
import { makeDwarf, makeSkill, makeContext, makeItem, makeStructure } from "./test-helpers.js";

// ---------------------------------------------------------------------------
// Task helper tests
// ---------------------------------------------------------------------------

describe("isDwarfIdle", () => {
  it("alive dwarf with no task is idle", () => {
    const dwarf = makeDwarf();
    expect(isDwarfIdle(dwarf)).toBe(true);
  });

  it("dwarf with current task is not idle", () => {
    const dwarf = makeDwarf({ current_task_id: randomUUID() });
    expect(isDwarfIdle(dwarf)).toBe(false);
  });

  it("dead dwarf is not idle", () => {
    const dwarf = makeDwarf({ status: "dead" });
    expect(isDwarfIdle(dwarf)).toBe(false);
  });

  it("dwarf in tantrum is not idle", () => {
    const dwarf = makeDwarf({ is_in_tantrum: true });
    expect(isDwarfIdle(dwarf)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Job claiming tests
// ---------------------------------------------------------------------------

describe("job claiming", () => {
  it("assigns an idle dwarf to a pending task", async () => {
    const dwarf = makeDwarf();
    const skill = makeSkill(dwarf.id, "mining", 5);
    const ctx = makeContext({ dwarves: [dwarf], skills: [skill] });

    createTask(ctx, {
      task_type: "mine",
      target_x: 10,
      target_y: 10,
      target_z: 0,
    });

    await jobClaiming(ctx);

    expect(dwarf.current_task_id).not.toBeNull();
    const task = ctx.state.tasks[0]!;
    expect(task.status).toBe("claimed");
    expect(task.assigned_dwarf_id).toBe(dwarf.id);
  });

  it("assigns a dwarf even without the required skill (any dwarf can do any task)", async () => {
    const dwarf = makeDwarf();
    // No mining skill — but should still claim the task
    const ctx = makeContext({ dwarves: [dwarf] });

    createTask(ctx, {
      task_type: "mine",
      target_x: 10,
      target_y: 10,
      target_z: 0,
    });

    await jobClaiming(ctx);

    expect(dwarf.current_task_id).not.toBeNull();
    expect(ctx.state.tasks[0]!.status).toBe("claimed");
  });

  it("any dwarf can haul", async () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });

    createTask(ctx, {
      task_type: "haul",
      target_x: 5,
      target_y: 5,
      target_z: 0,
    });

    await jobClaiming(ctx);

    expect(dwarf.current_task_id).not.toBeNull();
    expect(ctx.state.tasks[0]!.status).toBe("claimed");
  });

  it("prefers higher-priority tasks", async () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });

    createTask(ctx, {
      task_type: "haul",
      priority: 3,
      target_x: 5,
      target_y: 5,
      target_z: 0,
    });
    createTask(ctx, {
      task_type: "haul",
      priority: 8,
      target_x: 5,
      target_y: 5,
      target_z: 0,
    });

    await jobClaiming(ctx);

    const claimedTask = ctx.state.tasks.find(t => t.status === "claimed");
    expect(claimedTask!.priority).toBe(8);
  });

  it("does not double-assign tasks", async () => {
    const dwarf1 = makeDwarf();
    const dwarf2 = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf1, dwarf2] });

    createTask(ctx, {
      task_type: "haul",
      target_x: 5,
      target_y: 5,
      target_z: 0,
    });

    await jobClaiming(ctx);

    const assigned = [dwarf1.current_task_id, dwarf2.current_task_id].filter(Boolean);
    expect(assigned).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Task execution tests
// ---------------------------------------------------------------------------

describe("task execution", () => {
  it("progresses work when dwarf is at task site", async () => {
    const dwarf = makeDwarf({ position_x: 10, position_y: 10, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });

    const task = createTask(ctx, {
      task_type: "haul",
      target_x: 10,
      target_y: 10,
      target_z: 0,
      work_required: 20,
    });
    task.status = "claimed";
    task.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = task.id;

    await taskExecution(ctx);

    expect(task.status).toBe("in_progress");
    expect(task.work_progress).toBe(BASE_WORK_RATE);
  });

  it("completes task when work reaches required amount", async () => {
    const dwarf = makeDwarf({ position_x: 10, position_y: 10, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });

    const task = createTask(ctx, {
      task_type: "haul",
      target_x: 10,
      target_y: 10,
      target_z: 0,
      work_required: 1, // Completes in one tick
    });
    task.status = "in_progress";
    task.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = task.id;

    await taskExecution(ctx);

    expect(task.status).toBe("completed");
    expect(dwarf.current_task_id).toBeNull();
  });

  it("eating restores food need (infinite source)", async () => {
    const dwarf = makeDwarf({
      position_x: 0, position_y: 0, position_z: 0,
      need_food: 20,
    });
    const ctx = makeContext({ dwarves: [dwarf] });

    const task = createTask(ctx, {
      task_type: "eat",
      target_x: 0,
      target_y: 0,
      target_z: 0,
      work_required: 1,
      assigned_dwarf_id: dwarf.id,
    });
    task.status = "in_progress";
    task.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = task.id;

    await taskExecution(ctx);

    expect(task.status).toBe("completed");
    expect(dwarf.need_food).toBe(Math.min(MAX_NEED, 20 + FOOD_RESTORE_AMOUNT));
  });

  it("drinking restores drink need (infinite source)", async () => {
    const dwarf = makeDwarf({
      position_x: 0, position_y: 0, position_z: 0,
      need_drink: 15,
    });
    const ctx = makeContext({ dwarves: [dwarf] });

    const task = createTask(ctx, {
      task_type: "drink",
      target_x: 0,
      target_y: 0,
      target_z: 0,
      work_required: 1,
      assigned_dwarf_id: dwarf.id,
    });
    task.status = "in_progress";
    task.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = task.id;

    await taskExecution(ctx);

    expect(task.status).toBe("completed");
    expect(dwarf.need_drink).toBe(Math.min(MAX_NEED, 15 + DRINK_RESTORE_AMOUNT));
  });

  it("sleeping restores sleep gradually each tick", async () => {
    const dwarf = makeDwarf({
      position_x: 0, position_y: 0, position_z: 0,
      need_sleep: 10,
    });
    const ctx = makeContext({ dwarves: [dwarf] });

    const task = createTask(ctx, {
      task_type: "sleep",
      target_x: 0,
      target_y: 0,
      target_z: 0,
      work_required: WORK_SLEEP,
      assigned_dwarf_id: dwarf.id,
    });
    task.status = "in_progress";
    task.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = task.id;

    // After 1 tick, only a fraction of sleep should be restored
    await taskExecution(ctx);
    expect(dwarf.need_sleep).toBeCloseTo(10 + SLEEP_RESTORE_PER_TICK, 5);

    // After all ticks, full SLEEP_RESTORE_AMOUNT should be restored
    for (let i = 1; i < WORK_SLEEP; i++) {
      await taskExecution(ctx);
    }
    expect(dwarf.need_sleep).toBeCloseTo(10 + SLEEP_RESTORE_AMOUNT, 5);
  });

  it("mining creates a stone item", async () => {
    const dwarf = makeDwarf({ position_x: 9, position_y: 10, position_z: 0 });
    const skill = makeSkill(dwarf.id, "mining", 0);
    const ctx = makeContext({ dwarves: [dwarf], skills: [skill] });

    const task = createTask(ctx, {
      task_type: "mine",
      target_x: 10,
      target_y: 10,
      target_z: 0,
      work_required: 1,
    });
    task.status = "in_progress";
    task.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = task.id;

    await taskExecution(ctx);

    expect(task.status).toBe("completed");
    const stoneItems = ctx.state.items.filter(i => i.category === "raw_material");
    expect(stoneItems.length).toBe(1);
    expect(stoneItems[0]!.name).toBe("Stone block");
  });

  it("dwarf moves on same z-level using real tile lookup", async () => {
    // Dwarf at (3, 3, 0), task at (3, 3, 0) — haul task, dwarf needs to be on tile
    const dwarf = makeDwarf({ position_x: 3, position_y: 3, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });

    // Deriver that returns open_air everywhere at z=0
    ctx.fortressDeriver = {
      baseTileType: "grass" as FortressTileType,
      entrances: [],
      getZForEntrance() { return null; },
      getEntranceForZ() { return null; },
      getCaveName() { return null; },
      warmCaveCache() {},
      deriveTile() {
        return { tileType: "open_air" as FortressTileType, material: null };
      },
    };

    const task = createTask(ctx, {
      task_type: "haul",
      target_x: 5,
      target_y: 3,
      target_z: 0,
      work_required: 1,
    });
    task.status = "in_progress";
    task.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = task.id;

    // Tick 1: move one step toward target
    await taskExecution(ctx);
    expect(dwarf.position_x).toBe(4);
    expect(dwarf.position_y).toBe(3);

    // Tick 2: move another step
    await taskExecution(ctx);
    expect(dwarf.position_x).toBe(5);

    // Tick 3: at target — do work
    await taskExecution(ctx);
    expect(task.status).toBe("completed");
  });

  it("fails task when no path exists through solid rock", async () => {
    // Dwarf at (0, 0, 0), task at (0, 0, -1), no cave entrance
    const dwarf = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const skill = makeSkill(dwarf.id, "mining", 5);
    const ctx = makeContext({ dwarves: [dwarf], skills: [skill] });

    ctx.fortressDeriver = {
      baseTileType: "grass" as FortressTileType,
      entrances: [],
      getZForEntrance() { return null; },
      getEntranceForZ() { return null; },
      getCaveName() { return null; },
      warmCaveCache() {},
      deriveTile(_x: number, _y: number, z: number) {
        if (z === 0) return { tileType: "open_air" as FortressTileType, material: null };
        return { tileType: "stone" as FortressTileType, material: "granite" };
      },
    };

    const task = createTask(ctx, {
      task_type: "mine",
      target_x: 0,
      target_y: 0,
      target_z: -1,
      work_required: 100,
    });
    task.status = "in_progress";
    task.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = task.id;

    await taskExecution(ctx);

    // Task should be failed (reset to pending) since no path exists
    expect(task.status).toBe("pending");
    expect(dwarf.current_task_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Need satisfaction tests
// ---------------------------------------------------------------------------

describe("need satisfaction", () => {
  it("creates eat task targeting nearest food item when food need is low", async () => {
    const dwarf = makeDwarf({ need_food: NEED_INTERRUPT_FOOD - 1, position_x: 0, position_y: 0, position_z: 0 });
    const food = makeItem({ category: "food", position_x: 3, position_y: 0, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf], items: [food] });

    await needSatisfaction(ctx);

    const eatTasks = ctx.state.tasks.filter(t => t.task_type === "eat");
    expect(eatTasks).toHaveLength(1);
    expect(eatTasks[0]!.assigned_dwarf_id).toBe(dwarf.id);
    expect(eatTasks[0]!.target_item_id).toBe(food.id);
  });

  it("creates drink task targeting nearest water source when drink need is low", async () => {
    const dwarf = makeDwarf({ need_drink: NEED_INTERRUPT_DRINK - 1, position_x: 0, position_y: 0, position_z: 0 });
    const well = makeStructure({ type: "well", position_x: 4, position_y: 0, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf], structures: [well] });

    await needSatisfaction(ctx);

    const drinkTasks = ctx.state.tasks.filter(t => t.task_type === "drink");
    expect(drinkTasks).toHaveLength(1);
    expect(drinkTasks[0]!.target_x).toBe(4);
    expect(drinkTasks[0]!.target_item_id).toBeNull(); // well has no item id
  });

  it("drops current task when need is critical and food is available", async () => {
    const dwarf = makeDwarf({ need_food: NEED_INTERRUPT_FOOD - 1, position_x: 0, position_y: 0, position_z: 0 });
    const food = makeItem({ category: "food", position_x: 2, position_y: 0, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf], items: [food] });

    // Give dwarf a mine task (non-haul, interruptible)
    const mineTask = createTask(ctx, {
      task_type: "mine",
      target_x: 5,
      target_y: 5,
      target_z: 0,
    });
    mineTask.status = "in_progress";
    mineTask.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = mineTask.id;

    await needSatisfaction(ctx);

    // Mine task should be returned to pending
    expect(mineTask.status).toBe("pending");
    expect(mineTask.assigned_dwarf_id).toBeNull();

    // Eat task should be created and immediately claimed
    const eatTasks = ctx.state.tasks.filter(t => t.task_type === "eat");
    expect(eatTasks).toHaveLength(1);
    expect(eatTasks[0].status).toBe("claimed");
    expect(dwarf.current_task_id).toBe(eatTasks[0].id);
  });

  it("does not interrupt a haul task even when need is critical", async () => {
    const dwarf = makeDwarf({ need_food: NEED_INTERRUPT_FOOD - 1, position_x: 0, position_y: 0, position_z: 0 });
    const food = makeItem({ category: "food", position_x: 2, position_y: 0, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf], items: [food] });

    const haulTask = createTask(ctx, {
      task_type: "haul",
      target_x: 5,
      target_y: 5,
      target_z: 0,
    });
    haulTask.status = "in_progress";
    haulTask.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = haulTask.id;

    await needSatisfaction(ctx);

    // Haul task should NOT be interrupted
    expect(haulTask.status).toBe("in_progress");
    expect(haulTask.assigned_dwarf_id).toBe(dwarf.id);
    expect(dwarf.current_task_id).toBe(haulTask.id);

    // No eat task should be created
    const eatTasks = ctx.state.tasks.filter(t => t.task_type === "eat");
    expect(eatTasks).toHaveLength(0);
  });

  it("does not interrupt an existing autonomous task", async () => {
    const dwarf = makeDwarf({ need_food: 10, need_drink: 10 });
    const ctx = makeContext({ dwarves: [dwarf] });

    // Dwarf is already eating
    const eatTask = createTask(ctx, {
      task_type: "eat",
      target_x: 0,
      target_y: 0,
      target_z: 0,
      assigned_dwarf_id: dwarf.id,
    });
    eatTask.status = "in_progress";
    dwarf.current_task_id = eatTask.id;

    await needSatisfaction(ctx);

    // Should not create a drink task while eating
    const drinkTasks = ctx.state.tasks.filter(t => t.task_type === "drink");
    expect(drinkTasks).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Stress update tests
// ---------------------------------------------------------------------------

describe("stress update", () => {
  it("increases stress when needs are critically low", async () => {
    const dwarf = makeDwarf({
      need_food: 5,
      need_drink: 5,
      stress_level: 0,
    });
    const ctx = makeContext({ dwarves: [dwarf] });

    await stressUpdate(ctx);

    expect(dwarf.stress_level).toBeGreaterThan(0);
  });

  it("decreases stress when needs are comfortable", async () => {
    const dwarf = makeDwarf({
      need_food: 80,
      need_drink: 80,
      need_sleep: 80,
      need_social: 80,
      need_purpose: 80,
      need_beauty: 80,
      stress_level: 50,
    });
    const ctx = makeContext({ dwarves: [dwarf] });

    await stressUpdate(ctx);

    expect(dwarf.stress_level).toBeLessThan(50);
  });

  it("does not affect dead dwarves", async () => {
    const dwarf = makeDwarf({ status: "dead", stress_level: 50 });
    const ctx = makeContext({ dwarves: [dwarf] });

    await stressUpdate(ctx);

    expect(dwarf.stress_level).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Starvation scenario (integration)
// ---------------------------------------------------------------------------

describe("starvation scenario", () => {
  it("dwarf dies after prolonged food deprivation", async () => {
    const dwarf = makeDwarf({ need_food: 0, need_drink: 80 });
    const ctx = makeContext({ dwarves: [dwarf] });

    // Run task execution for STARVATION_TICKS to trigger death
    for (let i = 0; i < STARVATION_TICKS; i++) {
      ctx.step = i;
      await taskExecution(ctx);
    }

    expect(dwarf.status).toBe("dead");
    expect(dwarf.cause_of_death).toBe("starvation");
  });

  it("dwarf survives if food is available before starvation", async () => {
    const dwarf = makeDwarf({ need_food: 0, need_drink: 80 });
    const ctx = makeContext({ dwarves: [dwarf] });

    // Run partway through starvation window
    for (let i = 0; i < STARVATION_TICKS / 2; i++) {
      ctx.step = i;
      await taskExecution(ctx);
    }

    expect(dwarf.status).toBe("alive");

    // Now eat (infinite source — no target item needed)
    const eatTask = createTask(ctx, {
      task_type: "eat",
      target_x: 0,
      target_y: 0,
      target_z: 0,
      work_required: 1,
      assigned_dwarf_id: dwarf.id,
    });
    eatTask.status = "in_progress";
    dwarf.current_task_id = eatTask.id;
    dwarf.need_food = 0; // still starving

    await taskExecution(ctx);

    // Food restored, starvation counter reset
    expect(dwarf.need_food).toBe(FOOD_RESTORE_AMOUNT);
    expect(dwarf.status).toBe("alive");
  });

  it("full core loop: needs decay until dwarf seeks food autonomously", async () => {
    const dwarf = makeDwarf({
      need_food: NEED_INTERRUPT_FOOD + 5, // Just above threshold
      need_drink: 80,
      need_sleep: 80,
      position_x: 0,
      position_y: 0,
      position_z: 0,
    });
    const food = makeItem({ category: "food", position_x: 0, position_y: 0, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf], items: [food] });

    // Run needs decay until food drops below interrupt threshold
    let ticks = 0;
    while (dwarf.need_food >= NEED_INTERRUPT_FOOD && ticks < 5000) {
      await needsDecay(ctx);
      ticks++;
    }

    expect(dwarf.need_food).toBeLessThan(NEED_INTERRUPT_FOOD);

    // Now run need satisfaction — should create an eat task
    await needSatisfaction(ctx);

    const eatTasks = ctx.state.tasks.filter(t => t.task_type === "eat");
    expect(eatTasks).toHaveLength(1);
    expect(eatTasks[0]!.assigned_dwarf_id).toBe(dwarf.id);

    // Run job claiming to pick up the task
    await jobClaiming(ctx);

    expect(dwarf.current_task_id).toBe(eatTasks[0]!.id);

    // Run task execution to completion (work_required is WORK_EAT = 10)
    for (let i = 0; i < WORK_EAT; i++) {
      await taskExecution(ctx);
    }

    expect(eatTasks[0]!.status).toBe("completed");
    expect(dwarf.need_food).toBeGreaterThan(NEED_INTERRUPT_FOOD);
  });

  it("fortress falls when all dwarves die", async () => {
    const dwarves = [
      makeDwarf({ need_food: 0, need_drink: 80 }),
      makeDwarf({ need_food: 0, need_drink: 80 }),
    ];
    const ctx = makeContext({ dwarves });

    for (let i = 0; i < STARVATION_TICKS; i++) {
      ctx.step = i;
      await taskExecution(ctx);
    }

    expect(dwarves.every(d => d.status === "dead")).toBe(true);

    // Should have queued a fortress_fallen event
    const fallenEvents = ctx.state.pendingEvents.filter(
      e => e.category === "fortress_fallen",
    );
    expect(fallenEvents.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Build task tests
// ---------------------------------------------------------------------------

describe("build tasks", () => {
  it("completeBuild creates a fortress tile override for build_wall", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 6, position_z: 0 });
    const task: Task = {
      id: randomUUID(),
      civilization_id: "civ-1",
      task_type: "build_wall",
      status: "in_progress",
      priority: 5,
      assigned_dwarf_id: dwarf.id,
      target_x: 5,
      target_y: 7,
      target_z: 0,
      target_item_id: null,
      work_progress: 79,
      work_required: 80,
      created_at: new Date().toISOString(),
      completed_at: null,
    };
    dwarf.current_task_id = task.id;

    const stone = makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "civ-1", held_by_dwarf_id: null });
    const ctx = makeContext({
      dwarves: [dwarf],
      tasks: [task],
      skills: [makeSkill(dwarf.id, "building", 0)],
      items: [stone],
    });

    await taskExecution(ctx);

    // Task should be completed
    expect(task.status).toBe("completed");

    // Fortress tile override should be created
    const key = "5,7,0";
    expect(ctx.state.fortressTileOverrides.has(key)).toBe(true);
    const tile = ctx.state.fortressTileOverrides.get(key)!;
    expect(tile.tile_type).toBe("constructed_wall");
    expect(tile.material).toBe("stone");
    expect(tile.is_mined).toBe(false);

    // Should be marked dirty
    expect(ctx.state.dirtyFortressTileKeys.has(key)).toBe(true);
  });

  it("completeBuild creates correct tile type for build_floor", async () => {
    const dwarf = makeDwarf({ position_x: 10, position_y: 10, position_z: 0 });
    const task: Task = {
      id: randomUUID(),
      civilization_id: "civ-1",
      task_type: "build_floor",
      status: "in_progress",
      priority: 5,
      assigned_dwarf_id: dwarf.id,
      target_x: 10,
      target_y: 10,
      target_z: 0,
      target_item_id: null,
      work_progress: 49,
      work_required: 50,
      created_at: new Date().toISOString(),
      completed_at: null,
    };
    dwarf.current_task_id = task.id;

    const stone = makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "civ-1", held_by_dwarf_id: null });
    const ctx = makeContext({
      dwarves: [dwarf],
      tasks: [task],
      skills: [makeSkill(dwarf.id, "building", 0)],
      items: [stone],
    });

    await taskExecution(ctx);

    expect(task.status).toBe("completed");
    const tile = ctx.state.fortressTileOverrides.get("10,10,0")!;
    expect(tile.tile_type).toBe("constructed_floor");
  });

  it("completeMine creates a fortress tile override with open_air", async () => {
    const dwarf = makeDwarf({ position_x: 3, position_y: 4, position_z: 0 });
    const task: Task = {
      id: randomUUID(),
      civilization_id: "civ-1",
      task_type: "mine",
      status: "in_progress",
      priority: 5,
      assigned_dwarf_id: dwarf.id,
      target_x: 3,
      target_y: 5,
      target_z: 0,
      target_item_id: null,
      work_progress: 99,
      work_required: 100,
      created_at: new Date().toISOString(),
      completed_at: null,
    };
    dwarf.current_task_id = task.id;

    const ctx = makeContext({
      dwarves: [dwarf],
      tasks: [task],
      skills: [makeSkill(dwarf.id, "mining", 0)],
    });

    await taskExecution(ctx);

    expect(task.status).toBe("completed");

    // Mining at z=0 should create a grass tile override (surface)
    const key = "3,5,0";
    expect(ctx.state.fortressTileOverrides.has(key)).toBe(true);
    const tile = ctx.state.fortressTileOverrides.get(key)!;
    expect(tile.tile_type).toBe("grass");
    expect(tile.is_mined).toBe(true);

    // Should also create a stone item
    expect(ctx.state.items.length).toBe(1);
    expect(ctx.state.items[0]!.category).toBe("raw_material");
  });

  it("build tasks award building XP", async () => {
    const dwarf = makeDwarf({ position_x: 1, position_y: 1, position_z: 0 });
    const skill = makeSkill(dwarf.id, "building", 0, 0);
    const task: Task = {
      id: randomUUID(),
      civilization_id: "civ-1",
      task_type: "build_floor",
      status: "in_progress",
      priority: 5,
      assigned_dwarf_id: dwarf.id,
      target_x: 1,
      target_y: 1,
      target_z: 0,
      target_item_id: null,
      work_progress: 49,
      work_required: 50,
      created_at: new Date().toISOString(),
      completed_at: null,
    };
    dwarf.current_task_id = task.id;

    const stone = makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "civ-1", held_by_dwarf_id: null });
    const ctx = makeContext({
      dwarves: [dwarf],
      tasks: [task],
      skills: [skill],
      items: [stone],
    });

    await taskExecution(ctx);

    expect(skill.xp).toBe(12); // XP_BUILD = 12
  });
});

// ---------------------------------------------------------------------------
// getBestSkill tests
// ---------------------------------------------------------------------------

describe("getBestSkill", () => {
  it("returns null for dwarf with no skills", () => {
    expect(getBestSkill("dwarf-1", [])).toBeNull();
  });

  it("returns the highest-level skill", () => {
    const skills = [
      makeSkill("dwarf-1", "mining", 3),
      makeSkill("dwarf-1", "farming", 7),
      makeSkill("dwarf-1", "building", 1),
    ];
    expect(getBestSkill("dwarf-1", skills)).toBe("farming");
  });

  it("only considers skills belonging to the given dwarf", () => {
    const skills = [
      makeSkill("dwarf-1", "mining", 3),
      makeSkill("dwarf-2", "mining", 10),
    ];
    expect(getBestSkill("dwarf-1", skills)).toBe("mining");
  });
});

// ---------------------------------------------------------------------------
// Skill preference tests
// ---------------------------------------------------------------------------

describe("skill-based task preferences", () => {
  it("dwarf prefers task matching best skill over equidistant alternative", async () => {
    const miner = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const skills = [
      makeSkill(miner.id, "mining", 8),
      makeSkill(miner.id, "building", 2),
    ];
    const stone = makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "civ-1", held_by_dwarf_id: null });
    const ctx = makeContext({ dwarves: [miner], skills, items: [stone] });

    const buildTask = createTask(ctx, {
      task_type: "build_wall",
      priority: 5,
      target_x: 5,
      target_y: 0,
      target_z: 0,
    });
    const mineTask = createTask(ctx, {
      task_type: "mine",
      priority: 5,
      target_x: 5,
      target_y: 0,
      target_z: 0,
    });

    await jobClaiming(ctx);

    // Miner's best skill is mining, so mine task should be preferred
    expect(miner.current_task_id).toBe(mineTask.id);
    expect(mineTask.status).toBe("claimed");
    expect(buildTask.status).toBe("pending");
  });

  it("best skill bonus does not override large priority difference", async () => {
    const dwarf = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const skills = [
      makeSkill(dwarf.id, "mining", 5),
      makeSkill(dwarf.id, "building", 0),
    ];
    const stone = makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "civ-1", held_by_dwarf_id: null });
    const ctx = makeContext({ dwarves: [dwarf], skills, items: [stone] });

    // Build task with much higher priority
    const buildTask = createTask(ctx, {
      task_type: "build_wall",
      priority: 10,
      target_x: 5,
      target_y: 0,
      target_z: 0,
    });
    const mineTask = createTask(ctx, {
      task_type: "mine",
      priority: 1,
      target_x: 5,
      target_y: 0,
      target_z: 0,
    });

    await jobClaiming(ctx);

    // Priority difference of 9 (= 27 score points) overwhelms the best skill bonus (5)
    expect(dwarf.current_task_id).toBe(buildTask.id);
  });

  it("two dwarves with different specializations pick matching tasks", async () => {
    const miner = makeDwarf({ name: "Miner", position_x: 0, position_y: 0, position_z: 0 });
    const builder = makeDwarf({ name: "Builder", position_x: 0, position_y: 0, position_z: 0 });
    const skills = [
      makeSkill(miner.id, "mining", 8),
      makeSkill(miner.id, "building", 1),
      makeSkill(builder.id, "mining", 1),
      makeSkill(builder.id, "building", 8),
    ];
    const stone = makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "civ-1", held_by_dwarf_id: null });
    const ctx = makeContext({ dwarves: [miner, builder], skills, items: [stone] });

    const mineTask = createTask(ctx, {
      task_type: "mine",
      priority: 5,
      target_x: 5,
      target_y: 0,
      target_z: 0,
    });
    const buildTask = createTask(ctx, {
      task_type: "build_wall",
      priority: 5,
      target_x: 5,
      target_y: 0,
      target_z: 0,
    });

    await jobClaiming(ctx);

    expect(miner.current_task_id).toBe(mineTask.id);
    expect(builder.current_task_id).toBe(buildTask.id);
  });
});
