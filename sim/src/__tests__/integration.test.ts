import { describe, it, expect } from "vitest";
import {
  FOOD_DECAY_PER_TICK,
  DRINK_DECAY_PER_TICK,
  SLEEP_DECAY_PER_TICK,
  MORALE_DECAY_PER_TICK,
} from "@pwarf/shared";
import { needsDecay } from "../phases/needs-decay.js";
import { makeDwarf, makeContext } from "./test-helpers.js";

describe("needs decay", () => {
  it("needs decay over 100 ticks", async () => {
    const dwarves = Array.from({ length: 7 }, () => makeDwarf());
    const ctx = makeContext({ dwarves });

    for (let i = 0; i < 100; i++) {
      await needsDecay(ctx);
    }

    for (const dwarf of ctx.state.dwarves) {
      // Active needs should have decreased
      expect(dwarf.need_food).toBeLessThan(80);
      expect(dwarf.need_drink).toBeLessThan(80);
      expect(dwarf.need_sleep).toBeLessThan(80);
      expect(dwarf.need_social).toBeLessThan(50);

      // No values below 0
      expect(dwarf.need_food).toBeGreaterThanOrEqual(0);
      expect(dwarf.need_drink).toBeGreaterThanOrEqual(0);
      expect(dwarf.need_sleep).toBeGreaterThanOrEqual(0);
      expect(dwarf.need_social).toBeGreaterThanOrEqual(0);

      // Unused needs stay at 0
      expect(dwarf.need_purpose).toBe(0);
      expect(dwarf.need_beauty).toBe(0);

      // All IDs should be dirty
      expect(ctx.state.dirtyDwarfIds.has(dwarf.id)).toBe(true);
    }

    // Verify computed values match expected
    const d = ctx.state.dwarves[0]!;
    expect(d.need_food).toBeCloseTo(80 - 100 * FOOD_DECAY_PER_TICK, 5);
    expect(d.need_drink).toBeCloseTo(80 - 100 * DRINK_DECAY_PER_TICK, 5);
    expect(d.need_sleep).toBeCloseTo(80 - 100 * SLEEP_DECAY_PER_TICK, 5);
    expect(d.need_social).toBeCloseTo(50 - 100 * MORALE_DECAY_PER_TICK, 5);
  });

  it("dead dwarves are not decayed", async () => {
    const deadDwarf = makeDwarf({ status: "dead" });
    const originalFood = deadDwarf.need_food;
    const originalDrink = deadDwarf.need_drink;
    const originalSleep = deadDwarf.need_sleep;
    const originalSocial = deadDwarf.need_social;

    const ctx = makeContext({ dwarves: [deadDwarf] });

    for (let i = 0; i < 10; i++) {
      await needsDecay(ctx);
    }

    expect(deadDwarf.need_food).toBe(originalFood);
    expect(deadDwarf.need_drink).toBe(originalDrink);
    expect(deadDwarf.need_sleep).toBe(originalSleep);
    expect(deadDwarf.need_social).toBe(originalSocial);

    expect(ctx.state.dirtyDwarfIds.has(deadDwarf.id)).toBe(false);
  });

  it("needs clamp at zero", async () => {
    const dwarf = makeDwarf({
      need_food: 1,
      need_drink: 1,
      need_sleep: 1,
      need_social: 1,
    });

    const ctx = makeContext({ dwarves: [dwarf] });

    for (let i = 0; i < 100; i++) {
      await needsDecay(ctx);
    }

    expect(dwarf.need_food).toBe(0);
    expect(dwarf.need_drink).toBe(0);
    expect(dwarf.need_sleep).toBe(0);
    expect(dwarf.need_social).toBe(0);
  });
});
