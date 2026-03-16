import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { Dwarf } from "@pwarf/shared";
import {
  MIN_NEED,
  DECAY_FOOD,
  DECAY_DRINK,
  DECAY_SLEEP,
  DECAY_SOCIAL,
  DECAY_PURPOSE,
  DECAY_BEAUTY,
} from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { createEmptyCachedState } from "../sim-context.js";
import { needsDecay } from "../phases/needs-decay.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDwarf(overrides: Partial<Dwarf> = {}): Dwarf {
  return {
    id: randomUUID(),
    civilization_id: "civ-1",
    name: "Urist",
    surname: "McTest",
    status: "alive",
    age: 30,
    gender: "male",
    need_food: 80,
    need_drink: 80,
    need_sleep: 80,
    need_social: 50,
    need_purpose: 50,
    need_beauty: 50,
    stress_level: 0,
    is_in_tantrum: false,
    health: 100,
    injuries: [],
    memories: [],
    trait_openness: null,
    trait_conscientiousness: null,
    trait_extraversion: null,
    trait_agreeableness: null,
    trait_neuroticism: null,
    religious_devotion: 0,
    faction_id: null,
    born_year: null,
    died_year: null,
    cause_of_death: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeSimContext(dwarves: Dwarf[]): SimContext {
  const state = createEmptyCachedState();
  state.dwarves = dwarves;
  return {
    supabase: null as any,
    civilizationId: "civ-1",
    step: 0,
    year: 1,
    day: 1,
    state,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("needs decay over 100 ticks", () => {
  it("decreases all need values from their starting values", async () => {
    const dwarves = Array.from({ length: 7 }, () => makeDwarf());
    const ctx = makeSimContext(dwarves);

    for (let i = 0; i < 100; i++) {
      await needsDecay(ctx);
    }

    for (const d of ctx.state.dwarves) {
      expect(d.need_food).toBeLessThan(80);
      expect(d.need_drink).toBeLessThan(80);
      expect(d.need_sleep).toBeLessThan(80);
      expect(d.need_social).toBeLessThan(50);
      expect(d.need_purpose).toBeLessThan(50);
      expect(d.need_beauty).toBeLessThan(50);
    }
  });

  it("marks all 7 dwarf IDs as dirty", async () => {
    const dwarves = Array.from({ length: 7 }, () => makeDwarf());
    const ctx = makeSimContext(dwarves);

    for (let i = 0; i < 100; i++) {
      await needsDecay(ctx);
    }

    expect(ctx.state.dirtyDwarfIds.size).toBe(7);
    for (const d of dwarves) {
      expect(ctx.state.dirtyDwarfIds.has(d.id)).toBe(true);
    }
  });

  it("never lets any need go below 0", async () => {
    const dwarves = Array.from({ length: 7 }, () => makeDwarf());
    const ctx = makeSimContext(dwarves);

    for (let i = 0; i < 100; i++) {
      await needsDecay(ctx);
    }

    for (const d of ctx.state.dwarves) {
      expect(d.need_food).toBeGreaterThanOrEqual(0);
      expect(d.need_drink).toBeGreaterThanOrEqual(0);
      expect(d.need_sleep).toBeGreaterThanOrEqual(0);
      expect(d.need_social).toBeGreaterThanOrEqual(0);
      expect(d.need_purpose).toBeGreaterThanOrEqual(0);
      expect(d.need_beauty).toBeGreaterThanOrEqual(0);
    }
  });

  it("computes expected values after 100 ticks", async () => {
    const dwarves = Array.from({ length: 7 }, () => makeDwarf());
    const ctx = makeSimContext(dwarves);

    for (let i = 0; i < 100; i++) {
      await needsDecay(ctx);
    }

    const expectedFood = Math.max(MIN_NEED, 80 - 100 * DECAY_FOOD);
    const expectedDrink = Math.max(MIN_NEED, 80 - 100 * DECAY_DRINK);
    const expectedSleep = Math.max(MIN_NEED, 80 - 100 * DECAY_SLEEP);
    const expectedSocial = Math.max(MIN_NEED, 50 - 100 * DECAY_SOCIAL);
    const expectedPurpose = Math.max(MIN_NEED, 50 - 100 * DECAY_PURPOSE);
    const expectedBeauty = Math.max(MIN_NEED, 50 - 100 * DECAY_BEAUTY);

    for (const d of ctx.state.dwarves) {
      expect(d.need_food).toBeCloseTo(expectedFood, 5);
      expect(d.need_drink).toBeCloseTo(expectedDrink, 5);
      expect(d.need_sleep).toBeCloseTo(expectedSleep, 5);
      expect(d.need_social).toBeCloseTo(expectedSocial, 5);
      expect(d.need_purpose).toBeCloseTo(expectedPurpose, 5);
      expect(d.need_beauty).toBeCloseTo(expectedBeauty, 5);
    }
  });
});

describe("dead dwarves are not decayed", () => {
  it("leaves dead dwarf needs unchanged", async () => {
    const alive = Array.from({ length: 6 }, () => makeDwarf());
    const dead = makeDwarf({ status: "dead" });
    const ctx = makeSimContext([...alive, dead]);

    const originalNeeds = {
      need_food: dead.need_food,
      need_drink: dead.need_drink,
      need_sleep: dead.need_sleep,
      need_social: dead.need_social,
      need_purpose: dead.need_purpose,
      need_beauty: dead.need_beauty,
    };

    for (let i = 0; i < 10; i++) {
      await needsDecay(ctx);
    }

    expect(dead.need_food).toBe(originalNeeds.need_food);
    expect(dead.need_drink).toBe(originalNeeds.need_drink);
    expect(dead.need_sleep).toBe(originalNeeds.need_sleep);
    expect(dead.need_social).toBe(originalNeeds.need_social);
    expect(dead.need_purpose).toBe(originalNeeds.need_purpose);
    expect(dead.need_beauty).toBe(originalNeeds.need_beauty);
  });

  it("does not mark dead dwarf as dirty", async () => {
    const alive = Array.from({ length: 6 }, () => makeDwarf());
    const dead = makeDwarf({ status: "dead" });
    const ctx = makeSimContext([...alive, dead]);

    for (let i = 0; i < 10; i++) {
      await needsDecay(ctx);
    }

    expect(ctx.state.dirtyDwarfIds.has(dead.id)).toBe(false);
  });
});

describe("needs clamp at zero", () => {
  it("clamps all needs to exactly 0, not negative", async () => {
    const dwarf = makeDwarf({
      need_food: 1,
      need_drink: 1,
      need_sleep: 1,
      need_social: 1,
      need_purpose: 1,
      need_beauty: 1,
    });
    const ctx = makeSimContext([dwarf]);

    for (let i = 0; i < 100; i++) {
      await needsDecay(ctx);
    }

    expect(dwarf.need_food).toBe(0);
    expect(dwarf.need_drink).toBe(0);
    expect(dwarf.need_sleep).toBe(0);
    expect(dwarf.need_social).toBe(0);
    expect(dwarf.need_purpose).toBe(0);
    expect(dwarf.need_beauty).toBe(0);
  });
});
