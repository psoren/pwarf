import { describe, it, expect } from "vitest";
import { needSatisfaction } from "./need-satisfaction.js";
import { makeDwarf, makeTask, makeContext } from "../__tests__/test-helpers.js";
import { NEED_INTERRUPT_DRINK, NEED_INTERRUPT_FOOD, NEED_INTERRUPT_SLEEP } from "@pwarf/shared";

describe("needSatisfaction", () => {
  describe("maybeInterruptForNeed", () => {
    it("creates a drink task when need_drink is below threshold", async () => {
      const dwarf = makeDwarf({ need_drink: NEED_INTERRUPT_DRINK - 1 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await needSatisfaction(ctx);

      const drinkTask = ctx.state.tasks.find(t => t.task_type === 'drink');
      expect(drinkTask).toBeDefined();
      expect(drinkTask?.assigned_dwarf_id).toBe(dwarf.id);
      expect(drinkTask?.status).toBe('pending');
    });

    it("creates an eat task when need_food is below threshold", async () => {
      const dwarf = makeDwarf({ need_food: NEED_INTERRUPT_FOOD - 1 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await needSatisfaction(ctx);

      const eatTask = ctx.state.tasks.find(t => t.task_type === 'eat');
      expect(eatTask).toBeDefined();
      expect(eatTask?.assigned_dwarf_id).toBe(dwarf.id);
    });

    it("creates a sleep task when need_sleep is below threshold", async () => {
      const dwarf = makeDwarf({ need_sleep: NEED_INTERRUPT_SLEEP - 1 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await needSatisfaction(ctx);

      const sleepTask = ctx.state.tasks.find(t => t.task_type === 'sleep');
      expect(sleepTask).toBeDefined();
      expect(sleepTask?.assigned_dwarf_id).toBe(dwarf.id);
    });

    it("does not create a task if need is above threshold", async () => {
      const dwarf = makeDwarf({ need_drink: 100, need_food: 100, need_sleep: 100 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await needSatisfaction(ctx);

      expect(ctx.state.tasks.length).toBe(0);
    });

    it("does not interrupt if already doing an autonomous eat/drink/sleep task", async () => {
      const drinkTask = makeTask('drink', {
        status: 'in_progress',
        assigned_dwarf_id: 'dwarf-1',
      });
      const dwarf = makeDwarf({
        id: 'dwarf-1',
        need_drink: NEED_INTERRUPT_DRINK - 1,
        current_task_id: drinkTask.id,
      });
      const ctx = makeContext({ dwarves: [dwarf], tasks: [drinkTask] });

      await needSatisfaction(ctx);

      // Should not create a second drink task
      const drinkTasks = ctx.state.tasks.filter(t => t.task_type === 'drink');
      expect(drinkTasks.length).toBe(1);
    });

    it("does not create a duplicate if a pending drink task already exists for the dwarf", async () => {
      const existingDrink = makeTask('drink', {
        status: 'pending',
        assigned_dwarf_id: 'dwarf-1',
      });
      const dwarf = makeDwarf({ id: 'dwarf-1', need_drink: NEED_INTERRUPT_DRINK - 1 });
      const ctx = makeContext({ dwarves: [dwarf], tasks: [existingDrink] });

      await needSatisfaction(ctx);

      const drinkTasks = ctx.state.tasks.filter(t => t.task_type === 'drink');
      expect(drinkTasks.length).toBe(1);
    });

    it("completes a wander task (not resets to pending) when interrupting for a need", async () => {
      const wanderTask = makeTask('wander', {
        status: 'in_progress',
        assigned_dwarf_id: 'dwarf-1',
        target_x: 5,
        target_y: 5,
        target_z: 0,
      });
      const dwarf = makeDwarf({
        id: 'dwarf-1',
        need_drink: NEED_INTERRUPT_DRINK - 1,
        current_task_id: wanderTask.id,
      });
      const ctx = makeContext({ dwarves: [dwarf], tasks: [wanderTask] });

      await needSatisfaction(ctx);

      // Wander task must be completed, not orphaned as pending with no assignee
      expect(wanderTask.status).toBe('completed');
      expect(wanderTask.assigned_dwarf_id).toBe('dwarf-1'); // unchanged
      // A new drink task should have been created
      const drinkTask = ctx.state.tasks.find(t => t.task_type === 'drink');
      expect(drinkTask).toBeDefined();
      expect(drinkTask?.assigned_dwarf_id).toBe(dwarf.id);
      // Dwarf should no longer be on the wander task
      expect(dwarf.current_task_id).toBeNull();
    });

    it("does not leave orphaned wander task stuck in pending with no assignee", async () => {
      const wanderTask = makeTask('wander', {
        status: 'in_progress',
        assigned_dwarf_id: 'dwarf-1',
        target_x: 5,
        target_y: 5,
        target_z: 0,
      });
      const dwarf = makeDwarf({
        id: 'dwarf-1',
        need_drink: NEED_INTERRUPT_DRINK - 1,
        current_task_id: wanderTask.id,
      });
      const ctx = makeContext({ dwarves: [dwarf], tasks: [wanderTask] });

      await needSatisfaction(ctx);

      // The critical invariant: no pending wander task with null assignee
      const orphaned = ctx.state.tasks.find(
        t => t.task_type === 'wander' && t.status === 'pending' && t.assigned_dwarf_id === null,
      );
      expect(orphaned).toBeUndefined();
    });

    it("resets a non-wander task back to pending when interrupting for a need", async () => {
      const mineTask = makeTask('mine', {
        status: 'in_progress',
        assigned_dwarf_id: 'dwarf-1',
        target_x: 3,
        target_y: 3,
        target_z: 0,
        work_progress: 50,
      });
      const dwarf = makeDwarf({
        id: 'dwarf-1',
        need_drink: NEED_INTERRUPT_DRINK - 1,
        current_task_id: mineTask.id,
      });
      const ctx = makeContext({ dwarves: [dwarf], tasks: [mineTask] });

      await needSatisfaction(ctx);

      // Mine task should be reset to pending for another dwarf to claim
      expect(mineTask.status).toBe('pending');
      expect(mineTask.assigned_dwarf_id).toBeNull();
      expect(mineTask.work_progress).toBe(0);
    });
  });
});
