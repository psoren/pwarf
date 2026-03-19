import { describe, it, expect } from "vitest";
import type { FortressDeriver } from "@pwarf/shared";
import { makeDwarf, makeContext } from "./test-helpers.js";
import { idleWandering } from "../phases/idle-wandering.js";

describe("idle wandering", () => {
  it("creates a wander task for an idle dwarf", async () => {
    const dwarf = makeDwarf({ position_x: 128, position_y: 128, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });

    await idleWandering(ctx);

    const wanderTasks = ctx.state.tasks.filter(t => t.task_type === "wander");
    expect(wanderTasks).toHaveLength(1);
    expect(wanderTasks[0]!.assigned_dwarf_id).toBe(dwarf.id);
    expect(wanderTasks[0]!.priority).toBe(1);
  });

  it("does not create a wander task for a dwarf with a task", async () => {
    const dwarf = makeDwarf({ current_task_id: "some-task" });
    const ctx = makeContext({ dwarves: [dwarf] });

    await idleWandering(ctx);

    const wanderTasks = ctx.state.tasks.filter(t => t.task_type === "wander");
    expect(wanderTasks).toHaveLength(0);
  });

  it("does not create duplicate wander tasks", async () => {
    const dwarf = makeDwarf({ position_x: 128, position_y: 128, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });

    await idleWandering(ctx);
    // Dwarf still idle (wander task was created but not assigned via current_task_id)
    // But the check in idleWandering should see the existing wander task
    await idleWandering(ctx);

    const wanderTasks = ctx.state.tasks.filter(t => t.task_type === "wander");
    expect(wanderTasks).toHaveLength(1);
  });

  it("does not create wander task for dead dwarf", async () => {
    const dwarf = makeDwarf({ status: "dead" });
    const ctx = makeContext({ dwarves: [dwarf] });

    await idleWandering(ctx);

    expect(ctx.state.tasks).toHaveLength(0);
  });

  it("skips non-walkable target tiles", async () => {
    const dwarf = makeDwarf({ position_x: 128, position_y: 128, position_z: 0 });
    // Deriver that returns stone (non-walkable) for everything
    const stoneDeriver = {
      deriveTile: () => ({ tileType: 'stone' as const, material: 'granite' }),
    } as unknown as FortressDeriver;
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.fortressDeriver = stoneDeriver;

    // Run many times — should never create a task since all targets are stone
    for (let i = 0; i < 20; i++) {
      await idleWandering(ctx);
    }

    const wanderTasks = ctx.state.tasks.filter(t => t.task_type === "wander");
    expect(wanderTasks).toHaveLength(0);
  });

  it("wander target stays within fortress bounds", async () => {
    // Dwarf at edge of fortress
    const dwarf = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });

    // Run multiple times to verify bounds
    for (let i = 0; i < 20; i++) {
      ctx.state.tasks = [];
      await idleWandering(ctx);
      for (const task of ctx.state.tasks) {
        expect(task.target_x).toBeGreaterThanOrEqual(0);
        expect(task.target_y).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
