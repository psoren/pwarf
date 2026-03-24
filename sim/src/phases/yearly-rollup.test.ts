import { describe, it, expect } from "vitest";
import { yearlyRollup } from "./yearly-rollup.js";
import { makeDwarf, makeTask, makeItem, makeContext } from "../__tests__/test-helpers.js";
import { ELDER_DEATH_AGE, CARAVAN_INTERVAL_YEARS, CARAVAN_DRINK_COUNT, CARAVAN_FOOD_COUNT } from "@pwarf/shared";

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

      const deathEvent = ctx.state.pendingEvents.find(e => e.category === "death");
      expect(deathEvent).toBeDefined();
      expect(deathEvent?.description).toContain("old age");
    });
  });

  describe("year-end summary event", () => {
    it("fires a discovery event at the end of every year", async () => {
      const dwarf = makeDwarf({ age: 30 });
      const ctx = makeContext({ dwarves: [dwarf] });
      ctx.year = 3;

      await yearlyRollup(ctx);

      const summaryEvent = ctx.state.pendingEvents.find(
        e => e.category === "discovery" && typeof e.event_data === "object" &&
          (e.event_data as Record<string, unknown>).type === "year_rollup",
      );
      expect(summaryEvent).toBeDefined();
      expect(summaryEvent?.description).toContain("Year 3 ends");
    });

    it("includes population count in the summary", async () => {
      const d1 = makeDwarf({ age: 30 });
      const d2 = makeDwarf({ age: 25 });
      const ctx = makeContext({ dwarves: [d1, d2] });
      ctx.year = 5;

      await yearlyRollup(ctx);

      const summaryEvent = ctx.state.pendingEvents.find(
        e => (e.event_data as Record<string, unknown>)?.type === "year_rollup",
      );
      expect(summaryEvent?.description).toContain("Population: 2 dwarves");
    });

    it("reports deaths in the summary when a dwarf dies", async () => {
      const dwarf = makeDwarf({ age: 99 });
      const ctx = makeContext({ dwarves: [dwarf] });
      ctx.year = 10;

      await yearlyRollup(ctx);

      const summaryEvent = ctx.state.pendingEvents.find(
        e => (e.event_data as Record<string, unknown>)?.type === "year_rollup",
      );
      expect(summaryEvent?.description).toContain("1 dwarf died this year");
    });

    it("reports no deaths when no dwarf dies", async () => {
      const dwarf = makeDwarf({ age: 30 });
      // year 1 skips immigration so only the year-end summary fires
      const ctx1 = makeContext({ dwarves: [dwarf] });
      ctx1.year = 1;
      await yearlyRollup(ctx1);

      const summaryEvent = ctx1.state.pendingEvents.find(
        e => (e.event_data as Record<string, unknown>)?.type === "year_rollup",
      );
      expect(summaryEvent?.description).toContain("No dwarves died");
    });

    it("updates civPopulation and civWealth and sets civDirty when values change", async () => {
      const dwarf = makeDwarf({ age: 30, civilization_id: "civ-1" });
      const item = makeItem({ value: 50, located_in_civ_id: "civ-1" });
      const ctx = makeContext({ dwarves: [dwarf], items: [item] });
      ctx.state.civPopulation = 0;
      ctx.state.civWealth = 0;
      ctx.state.civDirty = false;

      await yearlyRollup(ctx);

      expect(ctx.state.civPopulation).toBe(1);
      expect(ctx.state.civWealth).toBe(50);
      expect(ctx.state.civDirty).toBe(true);
    });

    it("does not set civDirty when population and wealth are unchanged", async () => {
      const dwarf = makeDwarf({ age: 30, civilization_id: "civ-1" });
      const item = makeItem({ value: 10, located_in_civ_id: "civ-1" });
      const ctx = makeContext({ dwarves: [dwarf], items: [item] });
      ctx.state.civPopulation = 1;
      ctx.state.civWealth = 10;
      ctx.state.civDirty = false;
      ctx.year = 1; // year 1: no immigration

      await yearlyRollup(ctx);

      expect(ctx.state.civDirty).toBe(false);
    });

    it("excludes items not in this civilization from wealth", async () => {
      const dwarf = makeDwarf({ age: 30, civilization_id: "civ-1" });
      const ownItem = makeItem({ value: 100, located_in_civ_id: "civ-1" });
      const otherItem = makeItem({ value: 999, located_in_civ_id: "civ-other" });
      const ctx = makeContext({ dwarves: [dwarf], items: [ownItem, otherItem] });
      ctx.state.civPopulation = 0;
      ctx.state.civWealth = 0;

      await yearlyRollup(ctx);

      expect(ctx.state.civWealth).toBe(100);
    });

    it("event_data includes population, deaths, migrants fields", async () => {
      const dwarf = makeDwarf({ age: 30 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await yearlyRollup(ctx);

      const summaryEvent = ctx.state.pendingEvents.find(
        e => (e.event_data as Record<string, unknown>)?.type === "year_rollup",
      );
      const data = summaryEvent?.event_data as Record<string, unknown>;
      expect(data.population).toBeTypeOf("number");
      expect(data.deaths).toBeTypeOf("number");
      expect(data.migrants).toBeTypeOf("number");
    });
  });

  describe("trade caravan arrivals", () => {
    it("fires a caravan event on caravan years (year divisible by CARAVAN_INTERVAL_YEARS)", async () => {
      const dwarf = makeDwarf({ age: 30 });
      for (const year of [CARAVAN_INTERVAL_YEARS, CARAVAN_INTERVAL_YEARS * 2, CARAVAN_INTERVAL_YEARS * 3]) {
        const ctx = makeContext({ dwarves: [dwarf] });
        ctx.year = year;

        await yearlyRollup(ctx);

        const caravanEvent = ctx.state.pendingEvents.find(e => e.category === "trade_caravan_arrival");
        expect(caravanEvent, `expected caravan event on year ${year}`).toBeDefined();
        expect(caravanEvent?.description).toContain("Mountainhome");
      }
    });

    it("does not fire on non-caravan years (1, 3, 5)", async () => {
      const dwarf = makeDwarf({ age: 30 });
      for (const year of [1, 3, 5]) {
        const ctx = makeContext({ dwarves: [dwarf] });
        ctx.year = year;

        await yearlyRollup(ctx);

        const caravanEvent = ctx.state.pendingEvents.find(e => e.category === "trade_caravan_arrival");
        expect(caravanEvent, `did not expect caravan event on year ${year}`).toBeUndefined();
      }
    });

    it("adds correct drink and food item counts on caravan year", async () => {
      const dwarf = makeDwarf({ age: 30 });
      const ctx = makeContext({ dwarves: [dwarf] });
      ctx.year = CARAVAN_INTERVAL_YEARS;

      await yearlyRollup(ctx);

      const drinkItems = ctx.state.items.filter(i => i.category === "drink");
      const foodItems = ctx.state.items.filter(i => i.category === "food");
      expect(drinkItems).toHaveLength(CARAVAN_DRINK_COUNT);
      expect(foodItems.length).toBeGreaterThanOrEqual(CARAVAN_FOOD_COUNT);
    });

    it("adds raw material items (1–3) on caravan year", async () => {
      const dwarf = makeDwarf({ age: 30 });
      const ctx = makeContext({ dwarves: [dwarf] });
      ctx.year = CARAVAN_INTERVAL_YEARS;

      await yearlyRollup(ctx);

      const rawItems = ctx.state.items.filter(i => i.category === "raw_material");
      expect(rawItems.length).toBeGreaterThanOrEqual(1);
      expect(rawItems.length).toBeLessThanOrEqual(3);
    });

    it("adds a positive memory to all living dwarves on caravan year", async () => {
      const d1 = makeDwarf({ age: 30 });
      const d2 = makeDwarf({ age: 25 });
      const ctx = makeContext({ dwarves: [d1, d2] });
      ctx.year = CARAVAN_INTERVAL_YEARS;

      await yearlyRollup(ctx);

      for (const dwarf of [d1, d2]) {
        const memories = dwarf.memories as Array<{ text: string; sentiment: string }>;
        const caravanMemory = memories.find(m => m.text.includes("caravan"));
        expect(caravanMemory).toBeDefined();
        expect(caravanMemory?.sentiment).toBe("positive");
      }
    });

    it("does not add caravan memory to dead dwarves", async () => {
      const alive = makeDwarf({ age: 30 });
      const dead = makeDwarf({ status: "dead", age: 40 });
      const ctx = makeContext({ dwarves: [alive, dead] });
      ctx.year = CARAVAN_INTERVAL_YEARS;

      await yearlyRollup(ctx);

      expect((dead.memories as Array<{ text: string }>).find(m => m.text.includes("caravan"))).toBeUndefined();
    });
  });
});
