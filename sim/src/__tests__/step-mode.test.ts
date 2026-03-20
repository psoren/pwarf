import { describe, it, expect } from "vitest";
import { createStepSession, dispatchCommand } from "../step-mode.js";
import { makeDwarf, makeSkill } from "./test-helpers.js";

describe("createStepSession", () => {
  it("creates a session with empty state by default", () => {
    const session = createStepSession();
    expect(session.step).toBe(0);
    expect(session.year).toBe(1);
    expect(session.day).toBe(1);
    expect(session.tasksCompleted).toBe(0);
    expect(session.ctx.state.dwarves).toHaveLength(0);
  });

  it("creates a session from a named scenario", () => {
    const session = createStepSession({ scenario: "idle-fortress" });
    expect(session.ctx.state.dwarves.length).toBeGreaterThan(0);
  });

  it("throws for unknown scenario", () => {
    expect(() => createStepSession({ scenario: "nonexistent" })).toThrow(/Unknown scenario/);
  });
});

describe("dispatchCommand — tick", () => {
  it("advances step by 1 by default", async () => {
    const session = createStepSession();
    const resp = await dispatchCommand(session, { command: "tick" });
    expect(session.step).toBe(1);
    expect("summary" in resp && resp.summary.tick).toBe(1);
  });

  it("advances step by N ticks", async () => {
    const session = createStepSession();
    await dispatchCommand(session, { command: "tick", count: 10 });
    expect(session.step).toBe(10);
  });

  it("returns a state snapshot after ticking", async () => {
    const session = createStepSession({ scenario: "idle-fortress" });
    const resp = await dispatchCommand(session, { command: "tick", count: 5 });
    expect("summary" in resp).toBe(true);
    if ("summary" in resp) {
      expect(resp.summary.tick).toBe(5);
      expect(resp.summary.population.alive).toBeGreaterThan(0);
    }
  });

  it("clamps count to minimum 1", async () => {
    const session = createStepSession();
    await dispatchCommand(session, { command: "tick", count: 0 });
    expect(session.step).toBe(1);
  });
});

describe("dispatchCommand — state", () => {
  it("returns current state without advancing", async () => {
    const session = createStepSession();
    await dispatchCommand(session, { command: "tick", count: 5 });
    const resp = await dispatchCommand(session, { command: "state" });
    expect(session.step).toBe(5); // no change
    expect("summary" in resp && resp.summary.tick).toBe(5);
  });
});

describe("dispatchCommand — designate", () => {
  it("creates a pending task in state", async () => {
    const session = createStepSession();
    const resp = await dispatchCommand(session, {
      command: "designate",
      type: "mine",
      x: 10,
      y: 20,
      z: 0,
    });
    expect("ok" in resp && resp.ok).toBe(true);
    if ("ok" in resp && resp.ok) {
      expect(resp.task_id).toBeDefined();
    }
    const task = session.ctx.state.tasks.find(t => t.task_type === "mine");
    expect(task).toBeDefined();
    expect(task?.status).toBe("pending");
    expect(task?.target_x).toBe(10);
    expect(task?.target_y).toBe(20);
    expect(task?.target_z).toBe(0);
  });

  it("designated task is visible in state after ticking", async () => {
    const session = createStepSession({ scenario: "idle-fortress" });
    const designResp = await dispatchCommand(session, {
      command: "designate",
      type: "mine",
      x: 5,
      y: 5,
      z: 0,
    });
    expect("ok" in designResp && designResp.ok).toBe(true);
    // Tick a few times
    await dispatchCommand(session, { command: "tick", count: 3 });
    // Task should still be tracked in state
    const mineTask = session.ctx.state.tasks.find(t => t.task_type === "mine");
    expect(mineTask).toBeDefined();
    expect(mineTask?.target_x).toBe(5);
  });
});

describe("dispatchCommand — cancel", () => {
  it("cancels a pending task", async () => {
    const session = createStepSession();
    const designResp = await dispatchCommand(session, {
      command: "designate",
      type: "mine",
      x: 1,
      y: 1,
      z: 0,
    });
    expect("ok" in designResp && designResp.ok).toBe(true);
    const taskId = "ok" in designResp && designResp.ok ? designResp.task_id! : "";

    const cancelResp = await dispatchCommand(session, {
      command: "cancel",
      taskId,
    });
    expect("ok" in cancelResp && cancelResp.ok).toBe(true);

    const task = session.ctx.state.tasks.find(t => t.id === taskId);
    expect(task?.status).toBe("cancelled");
  });

  it("returns error for unknown taskId", async () => {
    const session = createStepSession();
    const resp = await dispatchCommand(session, {
      command: "cancel",
      taskId: "does-not-exist",
    });
    expect("ok" in resp && !resp.ok).toBe(true);
    if ("ok" in resp && !resp.ok) {
      expect(resp.error).toMatch(/not found/);
    }
  });

  it("returns error when cancelling already-completed task", async () => {
    const session = createStepSession();
    session.ctx.state.dwarves.push(makeDwarf({ civilization_id: "step-civ" }));
    const designResp = await dispatchCommand(session, {
      command: "designate",
      type: "mine",
      x: 0,
      y: 0,
      z: 0,
    });
    const taskId = "ok" in designResp && designResp.ok ? designResp.task_id! : "";
    // Manually mark task completed
    const task = session.ctx.state.tasks.find(t => t.id === taskId)!;
    task.status = "completed";

    const resp = await dispatchCommand(session, { command: "cancel", taskId });
    expect("ok" in resp && !resp.ok).toBe(true);
  });

  it("clears dwarf's current_task_id when cancelling a claimed task", async () => {
    const session = createStepSession();
    const dwarf = makeDwarf({ civilization_id: "step-civ" });
    session.ctx.state.dwarves.push(dwarf);

    const designResp = await dispatchCommand(session, {
      command: "designate",
      type: "mine",
      x: 0,
      y: 0,
      z: 0,
    });
    const taskId = "ok" in designResp && designResp.ok ? designResp.task_id! : "";

    // Simulate dwarf claiming the task
    const task = session.ctx.state.tasks.find(t => t.id === taskId)!;
    task.status = "claimed";
    task.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = taskId;

    await dispatchCommand(session, { command: "cancel", taskId });
    expect(dwarf.current_task_id).toBeNull();
  });
});

describe("dispatchCommand — scenario", () => {
  it("resets session state to a named scenario", async () => {
    const session = createStepSession();
    await dispatchCommand(session, { command: "tick", count: 20 });
    expect(session.step).toBe(20);

    const resp = await dispatchCommand(session, { command: "scenario", name: "idle-fortress" });
    expect("ok" in resp && resp.ok).toBe(true);
    expect(session.step).toBe(0);
    expect(session.year).toBe(1);
    expect(session.ctx.state.dwarves.length).toBeGreaterThan(0);
  });

  it("returns error for unknown scenario", async () => {
    const session = createStepSession();
    const resp = await dispatchCommand(session, { command: "scenario", name: "nope" });
    expect("ok" in resp && !resp.ok).toBe(true);
    if ("ok" in resp && !resp.ok) {
      expect(resp.error).toMatch(/Unknown scenario/);
    }
  });
});

describe("step mode determinism", () => {
  it("produces identical results for same seed and commands", async () => {
    const s1 = createStepSession({ seed: 42, scenario: "idle-fortress" });
    const s2 = createStepSession({ seed: 42, scenario: "idle-fortress" });

    await dispatchCommand(s1, { command: "tick", count: 50 });
    await dispatchCommand(s2, { command: "tick", count: 50 });

    const snap1 = await dispatchCommand(s1, { command: "state" });
    const snap2 = await dispatchCommand(s2, { command: "state" });

    if ("summary" in snap1 && "summary" in snap2) {
      expect(snap1.summary.population.alive).toBe(snap2.summary.population.alive);
      expect(snap1.summary.population.dead).toBe(snap2.summary.population.dead);
    }
  });
});
