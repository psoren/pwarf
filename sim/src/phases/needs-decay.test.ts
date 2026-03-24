import { describe, it, expect } from "vitest";
import { needsDecay } from "./needs-decay.js";
import { makeDwarf, makeContext } from "../__tests__/test-helpers.js";
import { SOCIAL_DECAY_PER_TICK } from "@pwarf/shared";

describe("needsDecay", () => {
  describe("baseline (no traits)", () => {
    it("decays all needs each tick", async () => {
      const dwarf = makeDwarf({
        need_food: 80,
        need_drink: 80,
        need_sleep: 80,
        need_social: 80,
        need_purpose: 80,
        need_beauty: 80,
      });
      const ctx = makeContext({ dwarves: [dwarf] });

      await needsDecay(ctx);

      expect(dwarf.need_food).toBeLessThan(80);
      expect(dwarf.need_drink).toBeLessThan(80);
      expect(dwarf.need_sleep).toBeLessThan(80);
      expect(dwarf.need_social).toBeLessThan(80);
      // Idle dwarves have PURPOSE_RESTORE_IDLE = PURPOSE_DECAY_PER_TICK, so net change is 0
      expect(dwarf.need_purpose).toBeLessThanOrEqual(80);
      expect(dwarf.need_beauty).toBeLessThan(80);
    });

    it("clamps needs at MIN_NEED (0)", async () => {
      const dwarf = makeDwarf({ need_food: 0, need_drink: 0 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await needsDecay(ctx);

      expect(dwarf.need_food).toBe(0);
      expect(dwarf.need_drink).toBe(0);
    });

    it("does not affect dead dwarves", async () => {
      const dwarf = makeDwarf({ status: "dead", need_food: 80 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await needsDecay(ctx);

      expect(dwarf.need_food).toBe(80);
    });
  });

  describe("extraversion trait", () => {
    it("extravert's social need decays faster than no-trait baseline", async () => {
      const extravert = makeDwarf({ need_social: 80, trait_extraversion: 1.0 });
      const baseline = makeDwarf({ need_social: 80, trait_extraversion: null });

      const ctxExtravert = makeContext({ dwarves: [extravert] });
      const ctxBaseline = makeContext({ dwarves: [baseline] });

      await needsDecay(ctxExtravert);
      await needsDecay(ctxBaseline);

      expect(extravert.need_social).toBeLessThan(baseline.need_social);
    });

    it("introvert's social need decays slower than no-trait baseline", async () => {
      const introvert = makeDwarf({ need_social: 80, trait_extraversion: 0.0 });
      const baseline = makeDwarf({ need_social: 80, trait_extraversion: null });

      const ctxIntrovert = makeContext({ dwarves: [introvert] });
      const ctxBaseline = makeContext({ dwarves: [baseline] });

      await needsDecay(ctxIntrovert);
      await needsDecay(ctxBaseline);

      expect(introvert.need_social).toBeGreaterThan(baseline.need_social);
    });

    it("average extraversion (0.5) matches null trait behavior", async () => {
      const average = makeDwarf({ need_social: 80, trait_extraversion: 0.5 });
      const noTrait = makeDwarf({ need_social: 80, trait_extraversion: null });

      const ctxAverage = makeContext({ dwarves: [average] });
      const ctxNoTrait = makeContext({ dwarves: [noTrait] });

      await needsDecay(ctxAverage);
      await needsDecay(ctxNoTrait);

      expect(average.need_social).toBeCloseTo(noTrait.need_social);
    });

    it("extraversion (1.0) applies 1.5× decay multiplier to social", async () => {
      const extravert = makeDwarf({ need_social: 80, trait_extraversion: 1.0 });
      const ctx = makeContext({ dwarves: [extravert] });

      await needsDecay(ctx);

      // Expected: 80 - SOCIAL_DECAY_PER_TICK * 1.5
      expect(extravert.need_social).toBeCloseTo(80 - SOCIAL_DECAY_PER_TICK * 1.5);
    });

    it("introversion (0.0) applies 0.5× decay multiplier to social", async () => {
      const introvert = makeDwarf({ need_social: 80, trait_extraversion: 0.0 });
      const ctx = makeContext({ dwarves: [introvert] });

      await needsDecay(ctx);

      // Expected: 80 - SOCIAL_DECAY_PER_TICK * 0.5
      expect(introvert.need_social).toBeCloseTo(80 - SOCIAL_DECAY_PER_TICK * 0.5);
    });

    it("extraversion does not affect non-social needs", async () => {
      const extravert = makeDwarf({ need_food: 80, need_drink: 80, trait_extraversion: 1.0 });
      const noTrait = makeDwarf({ need_food: 80, need_drink: 80, trait_extraversion: null });

      const ctxExtravert = makeContext({ dwarves: [extravert] });
      const ctxNoTrait = makeContext({ dwarves: [noTrait] });

      await needsDecay(ctxExtravert);
      await needsDecay(ctxNoTrait);

      expect(extravert.need_food).toBeCloseTo(noTrait.need_food);
      expect(extravert.need_drink).toBeCloseTo(noTrait.need_drink);
    });
  });
});
