import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dwarf } from "@pwarf/shared";
import {
  FOOD_DECAY_PER_TICK,
  DRINK_DECAY_PER_TICK,
  SLEEP_DECAY_PER_TICK,
  SOCIAL_DECAY_PER_TICK,
  PURPOSE_DECAY_PER_TICK,
  BEAUTY_DECAY_PER_TICK,
} from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { createEmptyCachedState } from "../sim-context.js";
import { needsDecay } from "../phases/needs-decay.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeDwarf(overrides?: Partial<Dwarf>): Dwarf {
  return {
    id: randomUUID(),
    civilization_id: "civ-1",
    name: "Urist",
    surname: null,
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
    current_task_id: null,
    position_x: 0,
    position_y: 0,
    position_z: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeSimContext(dwarves: Dwarf[]): SimContext {
  const state = createEmptyCachedState();
  state.dwarves = dwarves;

  return {
    supabase: null as unknown as SupabaseClient,
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

describe("needs decay", () => {
  it("needs decay over 100 ticks", async () => {
    const dwarves = Array.from({ length: 7 }, () => makeDwarf());
    const ctx = makeSimContext(dwarves);

    for (let i = 0; i < 100; i++) {
      await needsDecay(ctx);
    }

    for (const dwarf of ctx.state.dwarves) {
      // All needs should have decreased
      expect(dwarf.need_food).toBeLessThan(80);
      expect(dwarf.need_drink).toBeLessThan(80);
      expect(dwarf.need_sleep).toBeLessThan(80);
      expect(dwarf.need_social).toBeLessThan(50);
      expect(dwarf.need_purpose).toBeLessThan(50);
      expect(dwarf.need_beauty).toBeLessThan(50);

      // No values below 0
      expect(dwarf.need_food).toBeGreaterThanOrEqual(0);
      expect(dwarf.need_drink).toBeGreaterThanOrEqual(0);
      expect(dwarf.need_sleep).toBeGreaterThanOrEqual(0);
      expect(dwarf.need_social).toBeGreaterThanOrEqual(0);
      expect(dwarf.need_purpose).toBeGreaterThanOrEqual(0);
      expect(dwarf.need_beauty).toBeGreaterThanOrEqual(0);

      // All IDs should be dirty
      expect(ctx.state.dirtyDwarfIds.has(dwarf.id)).toBe(true);
    }

    // Verify computed values match expected
    const d = ctx.state.dwarves[0]!;
    expect(d.need_food).toBeCloseTo(80 - 100 * FOOD_DECAY_PER_TICK, 5);
    expect(d.need_drink).toBeCloseTo(80 - 100 * DRINK_DECAY_PER_TICK, 5);
    expect(d.need_sleep).toBeCloseTo(80 - 100 * SLEEP_DECAY_PER_TICK, 5);
    expect(d.need_social).toBeCloseTo(50 - 100 * SOCIAL_DECAY_PER_TICK, 5);
    expect(d.need_purpose).toBeCloseTo(50 - 100 * PURPOSE_DECAY_PER_TICK, 5);
    expect(d.need_beauty).toBeCloseTo(50 - 100 * BEAUTY_DECAY_PER_TICK, 5);
  });

  it("dead dwarves are not decayed", async () => {
    const deadDwarf = makeDwarf({ status: "dead" });
    const originalFood = deadDwarf.need_food;
    const originalDrink = deadDwarf.need_drink;
    const originalSleep = deadDwarf.need_sleep;
    const originalSocial = deadDwarf.need_social;
    const originalPurpose = deadDwarf.need_purpose;
    const originalBeauty = deadDwarf.need_beauty;

    const ctx = makeSimContext([deadDwarf]);

    for (let i = 0; i < 10; i++) {
      await needsDecay(ctx);
    }

    expect(deadDwarf.need_food).toBe(originalFood);
    expect(deadDwarf.need_drink).toBe(originalDrink);
    expect(deadDwarf.need_sleep).toBe(originalSleep);
    expect(deadDwarf.need_social).toBe(originalSocial);
    expect(deadDwarf.need_purpose).toBe(originalPurpose);
    expect(deadDwarf.need_beauty).toBe(originalBeauty);

    expect(ctx.state.dirtyDwarfIds.has(deadDwarf.id)).toBe(false);
  });

  it("needs clamp at zero", async () => {
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
