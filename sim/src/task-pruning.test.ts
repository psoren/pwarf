import { describe, it, expect } from "vitest";
import { pruneTerminalTasks } from "./task-pruning.js";
import { makeContext, makeTask, makeDwarf } from "./__tests__/test-helpers.js";

describe("pruneTerminalTasks", () => {
  it("removes completed tasks not referenced by any dwarf", () => {
    const task = makeTask("mine", { status: "completed" });
    const ctx = makeContext({ tasks: [task] });

    pruneTerminalTasks(ctx.state);

    expect(ctx.state.tasks).toHaveLength(0);
    expect(ctx.state.taskById.size).toBe(0);
  });

  it("removes cancelled and failed tasks", () => {
    const cancelled = makeTask("mine", { status: "cancelled" });
    const failed = makeTask("mine", { status: "failed" });
    const ctx = makeContext({ tasks: [cancelled, failed] });

    pruneTerminalTasks(ctx.state);

    expect(ctx.state.tasks).toHaveLength(0);
  });

  it("keeps pending and in_progress tasks", () => {
    const pending = makeTask("mine", { status: "pending" });
    const inProgress = makeTask("mine", { status: "in_progress" });
    const ctx = makeContext({ tasks: [pending, inProgress] });

    pruneTerminalTasks(ctx.state);

    expect(ctx.state.tasks).toHaveLength(2);
    expect(ctx.state.taskById.size).toBe(2);
  });

  it("keeps completed tasks referenced by a dwarf's current_task_id", () => {
    const task = makeTask("mine", { status: "completed" });
    const dwarf = makeDwarf({ current_task_id: task.id });
    const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

    pruneTerminalTasks(ctx.state);

    expect(ctx.state.tasks).toHaveLength(1);
    expect(ctx.state.tasks[0].id).toBe(task.id);
  });

  it("keeps dirty terminal tasks in DB mode (skipDirtyCheck=false)", () => {
    const task = makeTask("mine", { status: "completed" });
    const ctx = makeContext({ tasks: [task] });
    ctx.state.dirtyTaskIds.add(task.id);

    pruneTerminalTasks(ctx.state);

    expect(ctx.state.tasks).toHaveLength(1);
    expect(ctx.state.tasks[0].id).toBe(task.id);
  });

  it("removes dirty terminal tasks in headless mode (skipDirtyCheck=true)", () => {
    const task = makeTask("mine", { status: "completed" });
    const ctx = makeContext({ tasks: [task] });
    ctx.state.dirtyTaskIds.add(task.id);

    pruneTerminalTasks(ctx.state, true);

    expect(ctx.state.tasks).toHaveLength(0);
  });

  it("keeps referenced tasks even with skipDirtyCheck=true", () => {
    const task = makeTask("mine", { status: "completed" });
    const dwarf = makeDwarf({ current_task_id: task.id });
    const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });
    ctx.state.dirtyTaskIds.add(task.id);

    pruneTerminalTasks(ctx.state, true);

    expect(ctx.state.tasks).toHaveLength(1);
  });

  it("keeps terminal tasks that are in newTasks (DB mode)", () => {
    const task = makeTask("mine", { status: "completed" });
    const ctx = makeContext({ tasks: [task] });
    ctx.state.newTasks.push(task);

    pruneTerminalTasks(ctx.state);

    expect(ctx.state.tasks).toHaveLength(1);
  });

  it("rebuilds taskById index after pruning", () => {
    const kept = makeTask("mine", { status: "pending" });
    const pruned = makeTask("mine", { status: "completed" });
    const ctx = makeContext({ tasks: [kept, pruned] });

    pruneTerminalTasks(ctx.state);

    expect(ctx.state.taskById.size).toBe(1);
    expect(ctx.state.taskById.get(kept.id)).toBe(kept);
    expect(ctx.state.taskById.has(pruned.id)).toBe(false);
  });

  it("handles mixed tasks — only prunes unreferenced terminal ones", () => {
    const pending = makeTask("mine", { status: "pending" });
    const completedReferenced = makeTask("mine", { status: "completed" });
    const completedUnreferenced = makeTask("mine", { status: "completed" });
    const failed = makeTask("mine", { status: "failed" });
    const dwarf = makeDwarf({ current_task_id: completedReferenced.id });

    const ctx = makeContext({
      dwarves: [dwarf],
      tasks: [pending, completedReferenced, completedUnreferenced, failed],
    });

    pruneTerminalTasks(ctx.state);

    expect(ctx.state.tasks).toHaveLength(2);
    const ids = ctx.state.tasks.map(t => t.id);
    expect(ids).toContain(pending.id);
    expect(ids).toContain(completedReferenced.id);
    expect(ids).not.toContain(completedUnreferenced.id);
    expect(ids).not.toContain(failed.id);
  });
});
