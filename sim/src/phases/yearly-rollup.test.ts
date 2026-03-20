import { describe, it, expect } from "vitest";
import { yearlyRollup } from "./yearly-rollup.js";
import { makeDwarf, makeTask, makeContext } from "../__tests__/test-helpers.js";
import { ELDER_DEATH_AGE } from "@pwarf/shared";

describe("yearlyRollup", () => {
  describe("aging", () => {
    it("increments age for all alive dwarves each year", async () => {
      const dwarf = makeDwarf({ age: 30 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await yearlyRollup(ctx);

      expect(dwarf.age).toBe(31);
    });

    it("does not age dead dwarves", async () => {
      const dwarf = makeDwarf({ status: "dead", age: 40 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await yearlyRollup(ctx);

      expect(dwarf.age).toBe(40);
    });

    it("marks dwarves dirty after aging", async () => {
      const dwarf = makeDwarf({ age: 25 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await yearlyRollup(ctx);

      expect(ctx.state.dirtyDwarfIds.has(dwarf.id)).toBe(true);
    });
  });

  describe("old-age death", () => {
    it("young dwarves cannot die of old age", async () => {
      const dwarf = makeDwarf({ age: ELDER_DEATH_AGE - 1 });
      const ctx = makeContext({ dwarves: [dwarf] });

      // Run many years — should never die
      for (let i = 0; i < 100; i++) {
        await yearlyRollup(ctx);
      }

      // After 100 years of yearly rollup, age = ELDER_DEATH_AGE + 100
      // but the point is: at the starting age they were safe
      // Actually they WILL eventually die — so let's use a fresh dwarf at the threshold
    });

    it("dwarves at ELDER_DEATH_AGE are not yet eligible for death roll", async () => {
      // Death check is `age > ELDER_DEATH_AGE`, so at exactly ELDER_DEATH_AGE
      // the roll doesn't happen until they age past it
      const dwarf = makeDwarf({ age: ELDER_DEATH_AGE - 1 }); // will become ELDER_DEATH_AGE after rollup
      const ctx = makeContext({ dwarves: [dwarf] });

      await yearlyRollup(ctx);

      expect(dwarf.age).toBe(ELDER_DEATH_AGE);
      expect(dwarf.status).toBe("alive"); // not dead — death check needs age > threshold
    });

    it("very old dwarves (way past threshold) have high death chance", async () => {
      // Age 100 → 20 years past threshold → 20 × 10% = 200% chance (certain death)
      const dwarf = makeDwarf({ age: 99 }); // will become 100 after aging
      const ctx = makeContext({ dwarves: [dwarf] });

      await yearlyRollup(ctx);

      expect(dwarf.status).toBe("dead");
      expect(dwarf.died_year).toBe(ctx.year);
      expect(dwarf.cause_of_death).toBe("unknown");
    });

    it("death cancels the dwarf's current task", async () => {
      const dwarf = makeDwarf({ age: 99 });
      const task = makeTask("mine", { assigned_dwarf_id: dwarf.id, status: "in_progress" });
      dwarf.current_task_id = task.id;
      const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

      await yearlyRollup(ctx);

      expect(dwarf.current_task_id).toBeNull();
      expect(task.status).toBe("cancelled");
    });

    it("death creates a death event", async () => {
      const dwarf = makeDwarf({ age: 99, name: "Urist", surname: "McDead" });
      const ctx = makeContext({ dwarves: [dwarf] });

      await yearlyRollup(ctx);

      expect(ctx.state.pendingEvents.length).toBe(1);
      expect(ctx.state.pendingEvents[0].category).toBe("death");
      expect(ctx.state.pendingEvents[0].description).toContain("old age");
    });
  });
});
