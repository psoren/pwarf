import { describe, it, expect } from "vitest";
import { taskRecovery } from "./task-recovery.js";
import { makeTask, makeContext, makeMapTile } from "../__tests__/test-helpers.js";

describe("taskRecovery", () => {
  it("resets a failed mine task to pending when no tile override exists", () => {
    const task = makeTask("mine", {
      status: "failed",
      assigned_dwarf_id: null,
      target_x: 5,
      target_y: 5,
      target_z: 0,
    });
    const ctx = makeContext({ tasks: [task] });

    taskRecovery(ctx);

    expect(task.status).toBe("pending");
  });

  it("cancels a failed mine task when the target tile is already open_air", () => {
    const task = makeTask("mine", {
      status: "failed",
      assigned_dwarf_id: null,
      target_x: 3,
      target_y: 3,
      target_z: 0,
    });
    const ctx = makeContext({ tasks: [task] });
    ctx.state.fortressTileOverrides.set("3,3,0", makeMapTile(3, 3, 0, "open_air"));

    taskRecovery(ctx);

    expect(task.status).toBe("cancelled");
  });

  it("resets a failed mine task to pending when tile override is still minable rock", () => {
    const task = makeTask("mine", {
      status: "failed",
      assigned_dwarf_id: null,
      target_x: 2,
      target_y: 2,
      target_z: 0,
    });
    const ctx = makeContext({ tasks: [task] });
    ctx.state.fortressTileOverrides.set("2,2,0", makeMapTile(2, 2, 0, "rock"));

    taskRecovery(ctx);

    expect(task.status).toBe("pending");
  });

  it("resets a failed build task to pending", () => {
    const task = makeTask("build_wall", {
      status: "failed",
      assigned_dwarf_id: null,
    });
    const ctx = makeContext({ tasks: [task] });

    taskRecovery(ctx);

    expect(task.status).toBe("pending");
  });

  it("resets a failed brew task to pending", () => {
    const task = makeTask("brew", { status: "failed", assigned_dwarf_id: null });
    const ctx = makeContext({ tasks: [task] });

    taskRecovery(ctx);

    expect(task.status).toBe("pending");
  });

  it("cancels a failed eat task — autonomous tasks do not retry", () => {
    const task = makeTask("eat", { status: "failed", assigned_dwarf_id: null });
    const ctx = makeContext({ tasks: [task] });

    taskRecovery(ctx);

    expect(task.status).toBe("cancelled");
  });

  it("cancels a failed drink task", () => {
    const task = makeTask("drink", { status: "failed", assigned_dwarf_id: null });
    const ctx = makeContext({ tasks: [task] });

    taskRecovery(ctx);

    expect(task.status).toBe("cancelled");
  });

  it("cancels a failed sleep task", () => {
    const task = makeTask("sleep", { status: "failed", assigned_dwarf_id: null });
    const ctx = makeContext({ tasks: [task] });

    taskRecovery(ctx);

    expect(task.status).toBe("cancelled");
  });

  it("ignores tasks that are not failed", () => {
    const pending = makeTask("mine", { status: "pending" });
    const inProgress = makeTask("brew", { status: "in_progress" });
    const completed = makeTask("cook", { status: "completed" });
    const ctx = makeContext({ tasks: [pending, inProgress, completed] });

    taskRecovery(ctx);

    expect(pending.status).toBe("pending");
    expect(inProgress.status).toBe("in_progress");
    expect(completed.status).toBe("completed");
  });

  it("ignores failed tasks that still have an assigned dwarf", () => {
    const task = makeTask("mine", {
      status: "failed",
      assigned_dwarf_id: "some-dwarf",
    });
    const ctx = makeContext({ tasks: [task] });

    taskRecovery(ctx);

    // Still failed — something else is responsible for clearing the dwarf
    expect(task.status).toBe("failed");
  });

  it("marks recovered tasks dirty", () => {
    const task = makeTask("brew", { status: "failed", assigned_dwarf_id: null });
    const ctx = makeContext({ tasks: [task] });

    taskRecovery(ctx);

    expect(ctx.state.dirtyTaskIds.has(task.id)).toBe(true);
  });

  it("marks cancelled tasks dirty", () => {
    const task = makeTask("eat", { status: "failed", assigned_dwarf_id: null });
    const ctx = makeContext({ tasks: [task] });

    taskRecovery(ctx);

    expect(ctx.state.dirtyTaskIds.has(task.id)).toBe(true);
  });
});
