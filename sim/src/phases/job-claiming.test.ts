import { describe, it, expect } from "vitest";
import { jobClaiming } from "./job-claiming.js";
import { makeDwarf, makeSkill, makeTask, makeItem, makeContext } from "../__tests__/test-helpers.js";
import { DWARF_CARRY_CAPACITY } from "@pwarf/shared";

describe("jobClaiming", () => {
  it("assigns a pending task to an idle dwarf", async () => {
    const dwarf = makeDwarf();
    const task = makeTask("haul", { status: "pending" });
    const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

    await jobClaiming(ctx);

    expect(task.status).toBe("claimed");
    expect(task.assigned_dwarf_id).toBe(dwarf.id);
    expect(dwarf.current_task_id).toBe(task.id);
  });

  it("does nothing when there are no pending tasks", async () => {
    const dwarf = makeDwarf();
    const task = makeTask("haul", { status: "claimed", assigned_dwarf_id: "someone" });
    const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

    await jobClaiming(ctx);

    expect(dwarf.current_task_id).toBeNull();
  });

  it("does nothing when there are no idle dwarves", async () => {
    const dwarf = makeDwarf({ current_task_id: "existing-task" });
    const task = makeTask("haul", { status: "pending" });
    const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

    await jobClaiming(ctx);

    expect(task.status).toBe("pending");
  });

  it("skips dead dwarves", async () => {
    const dwarf = makeDwarf({ status: "dead" });
    const task = makeTask("haul", { status: "pending" });
    const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

    await jobClaiming(ctx);

    expect(task.status).toBe("pending");
  });

  it("skips tantruming dwarves", async () => {
    const dwarf = makeDwarf({ is_in_tantrum: true });
    const task = makeTask("haul", { status: "pending" });
    const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

    await jobClaiming(ctx);

    expect(task.status).toBe("pending");
  });

  it("requires matching skill for skill-based tasks", async () => {
    const dwarf = makeDwarf();
    // Mine requires 'mining' skill — dwarf has no skills
    const task = makeTask("mine", { status: "pending", target_x: 5, target_y: 5, target_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

    await jobClaiming(ctx);

    expect(task.status).toBe("pending");
  });

  it("assigns skill-based tasks when dwarf has the required skill", async () => {
    const dwarf = makeDwarf();
    const skill = makeSkill(dwarf.id, "mining", 1);
    const task = makeTask("mine", { status: "pending", target_x: 5, target_y: 5, target_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf], skills: [skill], tasks: [task] });

    await jobClaiming(ctx);

    expect(task.status).toBe("claimed");
    expect(task.assigned_dwarf_id).toBe(dwarf.id);
  });

  it("does not double-assign the same task to two dwarves", async () => {
    const dwarf1 = makeDwarf({ position_x: 1, position_y: 1 });
    const dwarf2 = makeDwarf({ position_x: 2, position_y: 2 });
    const task = makeTask("haul", { status: "pending", target_x: 1, target_y: 1, target_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf1, dwarf2], tasks: [task] });

    await jobClaiming(ctx);

    // One dwarf gets it, the other stays idle
    const assigned = [dwarf1, dwarf2].filter(d => d.current_task_id === task.id);
    expect(assigned).toHaveLength(1);
    expect(task.status).toBe("claimed");
  });

  it("prefers closer tasks (distance penalty)", async () => {
    const dwarf = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const nearTask = makeTask("haul", { status: "pending", target_x: 1, target_y: 0, target_z: 0, priority: 5 });
    const farTask = makeTask("haul", { status: "pending", target_x: 50, target_y: 50, target_z: 0, priority: 5 });
    const ctx = makeContext({ dwarves: [dwarf], tasks: [nearTask, farTask] });

    await jobClaiming(ctx);

    expect(dwarf.current_task_id).toBe(nearTask.id);
  });

  it("prefers higher priority tasks", async () => {
    const dwarf = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const lowPriority = makeTask("haul", { status: "pending", target_x: 1, target_y: 0, target_z: 0, priority: 1 });
    const highPriority = makeTask("haul", { status: "pending", target_x: 1, target_y: 0, target_z: 0, priority: 10 });
    const ctx = makeContext({ dwarves: [dwarf], tasks: [lowPriority, highPriority] });

    await jobClaiming(ctx);

    expect(dwarf.current_task_id).toBe(highPriority.id);
  });

  it("gives best-skill bonus when task matches dwarf specialty", async () => {
    const dwarf = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const miningSkill = makeSkill(dwarf.id, "mining", 5);
    const buildingSkill = makeSkill(dwarf.id, "building", 1);

    // Two tasks at same distance and priority — the mine task should win because mining is the dwarf's best skill
    const mineTask = makeTask("mine", { status: "pending", target_x: 5, target_y: 5, target_z: 0, priority: 5 });
    const buildTask = makeTask("build_wall", { status: "pending", target_x: 5, target_y: 5, target_z: 0, priority: 5 });
    const ctx = makeContext({
      dwarves: [dwarf],
      skills: [miningSkill, buildingSkill],
      tasks: [buildTask, mineTask],
    });

    await jobClaiming(ctx);

    expect(dwarf.current_task_id).toBe(mineTask.id);
  });

  it("skips autonomous tasks not assigned to the dwarf", async () => {
    const dwarf = makeDwarf();
    const eatTask = makeTask("eat", { status: "pending", assigned_dwarf_id: "other-dwarf" });
    const ctx = makeContext({ dwarves: [dwarf], tasks: [eatTask] });

    await jobClaiming(ctx);

    expect(dwarf.current_task_id).toBeNull();
  });

  it("claims autonomous tasks assigned to the same dwarf", async () => {
    const dwarf = makeDwarf();
    const eatTask = makeTask("eat", { status: "pending", assigned_dwarf_id: dwarf.id });
    const ctx = makeContext({ dwarves: [dwarf], tasks: [eatTask] });

    await jobClaiming(ctx);

    expect(dwarf.current_task_id).toBe(eatTask.id);
  });

  it("skips mine tasks when dwarf inventory is full", async () => {
    const dwarf = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const skill = makeSkill(dwarf.id, "mining", 1);
    // Fill inventory to capacity
    const items = Array.from({ length: DWARF_CARRY_CAPACITY }, () =>
      makeItem({ held_by_dwarf_id: dwarf.id, weight: 1 }),
    );
    const mineTask = makeTask("mine", { status: "pending", target_x: 5, target_y: 5, target_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf], skills: [skill], tasks: [mineTask], items });

    await jobClaiming(ctx);

    expect(mineTask.status).toBe("pending");
    expect(dwarf.current_task_id).toBeNull();
  });

  it("marks claimed entities as dirty for DB flush", async () => {
    const dwarf = makeDwarf();
    const task = makeTask("haul", { status: "pending" });
    const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

    await jobClaiming(ctx);

    expect(ctx.state.dirtyDwarfIds.has(dwarf.id)).toBe(true);
    expect(ctx.state.dirtyTaskIds.has(task.id)).toBe(true);
  });

  it("fires an event for non-autonomous task claims", async () => {
    const dwarf = makeDwarf();
    const task = makeTask("haul", { status: "pending" });
    const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

    await jobClaiming(ctx);

    expect(ctx.state.pendingEvents).toHaveLength(1);
    expect(ctx.state.pendingEvents[0].description).toContain("Urist");
    expect(ctx.state.pendingEvents[0].description).toContain("haul");
  });

  it("does not fire an event for autonomous task claims", async () => {
    const dwarf = makeDwarf();
    const eatTask = makeTask("eat", { status: "pending", assigned_dwarf_id: dwarf.id });
    const ctx = makeContext({ dwarves: [dwarf], tasks: [eatTask] });

    await jobClaiming(ctx);

    expect(ctx.state.pendingEvents).toHaveLength(0);
  });
});
