import { describe, it, expect } from "vitest";
import { makeDwarf, makeContext } from "./test-helpers.js";
import { yearlyRollup } from "../phases/yearly-rollup.js";
import {
  STEPS_PER_YEAR,
  CARAVAN_INTERVAL_YEARS,
  CARAVAN_DRINK_COUNT,
  CARAVAN_FOOD_COUNT,
} from "@pwarf/shared";

describe("trade caravan scenario (issue #480)", () => {
  it("caravan arrives on a year divisible by CARAVAN_INTERVAL_YEARS", async () => {
    const dwarves = [
      makeDwarf({ need_food: 100, need_drink: 100, need_sleep: 100 }),
    ];
    const ctx = makeContext({ dwarves });

    // Year must be divisible by CARAVAN_INTERVAL_YEARS (default 5)
    const caravanYear = CARAVAN_INTERVAL_YEARS;
    ctx.year = caravanYear;
    ctx.step = caravanYear * STEPS_PER_YEAR;

    await yearlyRollup(ctx);

    const caravanEvents = ctx.state.pendingEvents.filter(
      (e) => e.category === "trade_caravan_arrival",
    );
    expect(caravanEvents.length).toBe(1);
    expect(caravanEvents[0].description).toContain("trade caravan");
    expect(
      (caravanEvents[0].event_data as Record<string, unknown>).type,
    ).toBe("trade_caravan_arrival");
  });

  it("caravan does NOT arrive on non-interval years", async () => {
    const dwarves = [
      makeDwarf({ need_food: 100, need_drink: 100, need_sleep: 100 }),
    ];
    const ctx = makeContext({ dwarves });

    // Pick a year that is not divisible by CARAVAN_INTERVAL_YEARS
    const nonCaravanYear = CARAVAN_INTERVAL_YEARS + 1;
    ctx.year = nonCaravanYear;
    ctx.step = nonCaravanYear * STEPS_PER_YEAR;

    await yearlyRollup(ctx);

    const caravanEvents = ctx.state.pendingEvents.filter(
      (e) => e.category === "trade_caravan_arrival",
    );
    expect(caravanEvents.length).toBe(0);
  });

  it("caravan drops food and drink supplies into fortress inventory", async () => {
    const dwarves = [
      makeDwarf({ need_food: 100, need_drink: 100, need_sleep: 100 }),
    ];
    const ctx = makeContext({ dwarves });
    const itemsBefore = ctx.state.items.length;

    ctx.year = CARAVAN_INTERVAL_YEARS;
    ctx.step = CARAVAN_INTERVAL_YEARS * STEPS_PER_YEAR;

    await yearlyRollup(ctx);

    const newItems = ctx.state.items.slice(itemsBefore);

    const drinks = newItems.filter((i) => i.category === "drink");
    const foods = newItems.filter((i) => i.category === "food");
    const rawMaterials = newItems.filter((i) => i.category === "raw_material");

    expect(drinks.length).toBe(CARAVAN_DRINK_COUNT);
    expect(foods.length).toBe(CARAVAN_FOOD_COUNT);
    expect(rawMaterials.length).toBeGreaterThanOrEqual(1);
    expect(rawMaterials.length).toBeLessThanOrEqual(3);
  });

  it("caravan supplies are located in the fortress civilization", async () => {
    const dwarves = [
      makeDwarf({ need_food: 100, need_drink: 100, need_sleep: 100 }),
    ];
    const ctx = makeContext({ dwarves });
    const itemsBefore = ctx.state.items.length;

    ctx.year = CARAVAN_INTERVAL_YEARS;
    ctx.step = CARAVAN_INTERVAL_YEARS * STEPS_PER_YEAR;

    await yearlyRollup(ctx);

    const newItems = ctx.state.items.slice(itemsBefore);

    for (const item of newItems) {
      // Items should belong to the civilization (usable by dwarves)
      expect(item.located_in_civ_id).toBe(ctx.civilizationId);
      // Items should not be held by any dwarf (free in stockpile)
      expect(item.held_by_dwarf_id).toBeNull();
      // Items should be marked dirty for persistence
      expect(ctx.state.dirtyItemIds.has(item.id)).toBe(true);
    }
  });

  it("caravan event_data includes item count", async () => {
    const dwarves = [
      makeDwarf({ need_food: 100, need_drink: 100, need_sleep: 100 }),
    ];
    const ctx = makeContext({ dwarves });
    const itemsBefore = ctx.state.items.length;

    ctx.year = CARAVAN_INTERVAL_YEARS;
    ctx.step = CARAVAN_INTERVAL_YEARS * STEPS_PER_YEAR;

    await yearlyRollup(ctx);

    const caravanEvent = ctx.state.pendingEvents.find(
      (e) => e.category === "trade_caravan_arrival",
    );
    expect(caravanEvent).toBeDefined();

    const data = caravanEvent!.event_data as Record<string, unknown>;
    const newItemCount = ctx.state.items.length - itemsBefore;
    expect(data.item_count).toBe(newItemCount);
  });

  it("dwarves receive a positive memory when caravan arrives", async () => {
    const dwarves = [
      makeDwarf({ need_food: 100, need_drink: 100, need_sleep: 100 }),
      makeDwarf({ need_food: 100, need_drink: 100, need_sleep: 100 }),
    ];
    const ctx = makeContext({ dwarves });

    ctx.year = CARAVAN_INTERVAL_YEARS;
    ctx.step = CARAVAN_INTERVAL_YEARS * STEPS_PER_YEAR;

    await yearlyRollup(ctx);

    for (const dwarf of ctx.state.dwarves.filter((d) => d.status === "alive")) {
      const caravanMemory = dwarf.memories.find((m) => {
        const mem = m as Record<string, unknown>;
        return typeof mem.text === "string" && mem.text.includes("caravan");
      });
      expect(caravanMemory).toBeDefined();
      const mem = caravanMemory as Record<string, unknown>;
      expect(mem.sentiment).toBe("positive");
    }
  });

  it("multiple caravans arrive over many years", async () => {
    const dwarves = [
      makeDwarf({ need_food: 100, need_drink: 100, need_sleep: 100 }),
    ];
    const ctx = makeContext({ dwarves });

    // Run through 3 caravan cycles
    const endYear = CARAVAN_INTERVAL_YEARS * 3;
    for (let year = 1; year <= endYear; year++) {
      ctx.year = year;
      ctx.step = year * STEPS_PER_YEAR;
      await yearlyRollup(ctx);
    }

    const caravanEvents = ctx.state.pendingEvents.filter(
      (e) => e.category === "trade_caravan_arrival",
    );
    // Should have exactly 3 caravan arrivals (at years 5, 10, 15)
    expect(caravanEvents.length).toBe(3);

    // Items should have accumulated from all 3 caravans
    const drinks = ctx.state.items.filter((i) => i.category === "drink");
    expect(drinks.length).toBe(CARAVAN_DRINK_COUNT * 3);

    const foods = ctx.state.items.filter((i) => i.category === "food");
    expect(foods.length).toBe(CARAVAN_FOOD_COUNT * 3);
  });
});
