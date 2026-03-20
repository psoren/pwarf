import { describe, it, expect } from "vitest";
import { tantrumCheck, getTantrumDuration } from "./tantrum-check.js";
import { makeDwarf, makeTask, makeContext } from "../__tests__/test-helpers.js";
import { createRng } from "../rng.js";
import {
  STRESS_TANTRUM_THRESHOLD,
  STRESS_TANTRUM_MILD,
  STRESS_TANTRUM_MODERATE,
  STRESS_TANTRUM_SEVERE,
  TANTRUM_DURATION_MILD,
  TANTRUM_DURATION_MODERATE,
  TANTRUM_DURATION_SEVERE,
} from "@pwarf/shared";

describe("getTantrumDuration", () => {
  it("returns mild duration for mild stress (80–89)", () => {
    expect(getTantrumDuration(STRESS_TANTRUM_MILD)).toBe(TANTRUM_DURATION_MILD);
    expect(getTantrumDuration(85)).toBe(TANTRUM_DURATION_MILD);
    expect(getTantrumDuration(STRESS_TANTRUM_MODERATE - 1)).toBe(TANTRUM_DURATION_MILD);
  });

  it("returns moderate duration for moderate stress (90–95)", () => {
    expect(getTantrumDuration(STRESS_TANTRUM_MODERATE)).toBe(TANTRUM_DURATION_MODERATE);
    expect(getTantrumDuration(92)).toBe(TANTRUM_DURATION_MODERATE);
    expect(getTantrumDuration(STRESS_TANTRUM_SEVERE - 1)).toBe(TANTRUM_DURATION_MODERATE);
  });

  it("returns severe duration for severe stress (96–100)", () => {
    expect(getTantrumDuration(STRESS_TANTRUM_SEVERE)).toBe(TANTRUM_DURATION_SEVERE);
    expect(getTantrumDuration(100)).toBe(TANTRUM_DURATION_SEVERE);
  });
});

describe("tantrumCheck", () => {
  describe("triggering a tantrum", () => {
    it("triggers tantrum when stress reaches threshold", async () => {
      const dwarf = makeDwarf({ stress_level: STRESS_TANTRUM_THRESHOLD, is_in_tantrum: false });
      const ctx = makeContext({ dwarves: [dwarf] });

      await tantrumCheck(ctx);

      expect(dwarf.is_in_tantrum).toBe(true);
    });

    it("does not trigger tantrum below threshold", async () => {
      const dwarf = makeDwarf({ stress_level: STRESS_TANTRUM_THRESHOLD - 1, is_in_tantrum: false });
      const ctx = makeContext({ dwarves: [dwarf] });

      await tantrumCheck(ctx);

      expect(dwarf.is_in_tantrum).toBe(false);
    });

    it("cancels current task when tantrum starts", async () => {
      const dwarf = makeDwarf({ stress_level: 85, is_in_tantrum: false });
      const task = makeTask("mine", {
        assigned_dwarf_id: dwarf.id,
        status: "in_progress",
      });
      dwarf.current_task_id = task.id;
      const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

      await tantrumCheck(ctx);

      expect(dwarf.current_task_id).toBeNull();
      expect(task.status).toBe("cancelled");
    });

    it("sets tantrum duration based on severity", async () => {
      const mild = makeDwarf({ stress_level: 85, is_in_tantrum: false });
      const moderate = makeDwarf({ stress_level: 92, is_in_tantrum: false });
      const severe = makeDwarf({ stress_level: 98, is_in_tantrum: false });

      const ctx = makeContext({ dwarves: [mild, moderate, severe] });
      await tantrumCheck(ctx);

      expect(ctx.state.tantrumTicks.get(mild.id)).toBe(TANTRUM_DURATION_MILD);
      expect(ctx.state.tantrumTicks.get(moderate.id)).toBe(TANTRUM_DURATION_MODERATE);
      expect(ctx.state.tantrumTicks.get(severe.id)).toBe(TANTRUM_DURATION_SEVERE);
    });

    it("marks dwarf dirty when tantrum triggers", async () => {
      const dwarf = makeDwarf({ stress_level: 85, is_in_tantrum: false });
      const ctx = makeContext({ dwarves: [dwarf] });

      await tantrumCheck(ctx);

      expect(ctx.state.dirtyDwarfIds.has(dwarf.id)).toBe(true);
    });
  });

  describe("tantrum recovery", () => {
    it("recovers when ticks expire and stress is below threshold", async () => {
      const dwarf = makeDwarf({ stress_level: 20, is_in_tantrum: true });
      const ctx = makeContext({ dwarves: [dwarf] });
      ctx.state.tantrumTicks.set(dwarf.id, 1); // one tick remaining

      await tantrumCheck(ctx);

      expect(dwarf.is_in_tantrum).toBe(false);
      expect(ctx.state.tantrumTicks.has(dwarf.id)).toBe(false);
    });

    it("does not recover if stress is still at threshold even when ticks expire", async () => {
      const dwarf = makeDwarf({ stress_level: STRESS_TANTRUM_THRESHOLD, is_in_tantrum: true });
      const ctx = makeContext({ dwarves: [dwarf] });
      ctx.state.tantrumTicks.set(dwarf.id, 1);

      await tantrumCheck(ctx);

      expect(dwarf.is_in_tantrum).toBe(true);
    });

    it("does not recover if ticks have not expired", async () => {
      const dwarf = makeDwarf({ stress_level: 10, is_in_tantrum: true });
      const ctx = makeContext({ dwarves: [dwarf] });
      ctx.state.tantrumTicks.set(dwarf.id, 20); // many ticks remaining

      await tantrumCheck(ctx);

      expect(dwarf.is_in_tantrum).toBe(true);
      expect(ctx.state.tantrumTicks.get(dwarf.id)).toBe(19);
    });
  });

  describe("edge cases", () => {
    it("does not affect dead dwarves", async () => {
      const dwarf = makeDwarf({ status: "dead", stress_level: 100, is_in_tantrum: false });
      const ctx = makeContext({ dwarves: [dwarf] });

      await tantrumCheck(ctx);

      expect(dwarf.is_in_tantrum).toBe(false);
    });

    it("does not trigger a second tantrum while already tantrumming", async () => {
      const dwarf = makeDwarf({ stress_level: 90, is_in_tantrum: true });
      const ctx = makeContext({ dwarves: [dwarf] });
      ctx.state.tantrumTicks.set(dwarf.id, 50);

      await tantrumCheck(ctx);

      // Should count down, not reset
      expect(ctx.state.tantrumTicks.get(dwarf.id)).toBe(49);
    });
  });

  describe("strange moods", () => {
    it("triggers strange mood instead of tantrum at severe stress (seed 7)", async () => {
      // Seed 7 produces rng.random() ≈ 0.012 which is < STRANGE_MOOD_CHANCE (0.05)
      const dwarf = makeDwarf({ stress_level: STRESS_TANTRUM_SEVERE, is_in_tantrum: false });
      const ctx = makeContext({ dwarves: [dwarf] }, 7);

      await tantrumCheck(ctx);

      expect(ctx.state.strangeMoodDwarfIds.has(dwarf.id)).toBe(true);
      expect(dwarf.is_in_tantrum).toBe(false);
    });

    it("strange mood dwarf gets a create_artifact task", async () => {
      const dwarf = makeDwarf({ stress_level: STRESS_TANTRUM_SEVERE, is_in_tantrum: false });
      const ctx = makeContext({ dwarves: [dwarf] }, 7);

      await tantrumCheck(ctx);

      expect(ctx.state.strangeMoodDwarfIds.has(dwarf.id)).toBe(true);
      const artifactTask = ctx.state.tasks.find(t => t.task_type === 'create_artifact');
      expect(artifactTask).toBeDefined();
      expect(artifactTask?.assigned_dwarf_id).toBe(dwarf.id);
      expect(dwarf.current_task_id).toBe(artifactTask?.id);
    });

    it("strange mood cancels the dwarf's current task", async () => {
      const dwarf = makeDwarf({ stress_level: STRESS_TANTRUM_SEVERE, is_in_tantrum: false });
      const existingTask = makeTask("mine", { assigned_dwarf_id: dwarf.id, status: "in_progress" });
      dwarf.current_task_id = existingTask.id;
      const ctx = makeContext({ dwarves: [dwarf], tasks: [existingTask] }, 7);

      await tantrumCheck(ctx);

      expect(existingTask.status).toBe("cancelled");
    });

    it("dwarf below severe threshold always gets tantrum not strange mood", async () => {
      // At moderate stress (< 96) no strange mood possible
      const dwarf = makeDwarf({ stress_level: STRESS_TANTRUM_MODERATE, is_in_tantrum: false });
      const ctx = makeContext({ dwarves: [dwarf] }, 7);

      await tantrumCheck(ctx);

      expect(dwarf.is_in_tantrum).toBe(true);
      expect(ctx.state.strangeMoodDwarfIds.has(dwarf.id)).toBe(false);
    });

    it("does not affect dwarves already in strange mood", async () => {
      const dwarf = makeDwarf({ stress_level: STRESS_TANTRUM_SEVERE, is_in_tantrum: false });
      const ctx = makeContext({ dwarves: [dwarf] }, 7);
      ctx.state.strangeMoodDwarfIds.add(dwarf.id);

      const tasksBefore = ctx.state.tasks.length;
      await tantrumCheck(ctx);

      // No new tasks created — dwarf is already in strange mood
      expect(ctx.state.tasks.length).toBe(tasksBefore);
      expect(dwarf.is_in_tantrum).toBe(false);
    });
  });
});
