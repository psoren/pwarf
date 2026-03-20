import { describe, it, expect } from "vitest";
import { calcStressDelta } from "./stress-update.js";

// All needs comfortable — no stress gains, just recovery
const COMFORTABLE_NEEDS = [80, 80, 80, 80, 80, 80];

// One need critically low (food=10)
const ONE_NEED_CRITICAL = [10, 80, 80, 80, 80, 80];

// All needs zero
const ALL_NEEDS_ZERO = [0, 0, 0, 0, 0, 0];

describe("calcStressDelta", () => {
  describe("baseline (no traits)", () => {
    const noTraits = { trait_neuroticism: null, trait_agreeableness: null };

    it("returns negative delta when all needs are comfortable", () => {
      const delta = calcStressDelta(noTraits, COMFORTABLE_NEEDS);
      expect(delta).toBeCloseTo(-0.1);
    });

    it("returns positive delta when a need is critically low", () => {
      // food=10 → gain=(20-10)*0.02=0.2; food<50 so all-needs-comfortable fails → no recovery
      const delta = calcStressDelta(noTraits, ONE_NEED_CRITICAL);
      expect(delta).toBeCloseTo(0.2);
    });

    it("adds deprivation penalty when a need is at zero", () => {
      // need=0: (20-0)*0.02 = 0.4 + 0.5 penalty = 0.9 per need × 6
      const delta = calcStressDelta(noTraits, ALL_NEEDS_ZERO);
      expect(delta).toBeCloseTo(6 * (0.4 + 0.5));
    });

    it("returns zero when needs are just below comfortable but not critical", () => {
      // needs=55, all above 50 threshold, none below 20 — should recover
      const midNeeds = [55, 55, 55, 55, 55, 55];
      const delta = calcStressDelta(noTraits, midNeeds);
      expect(delta).toBeCloseTo(-0.1);
    });

    it("no recovery when some needs are below 50", () => {
      // need_social=40 — not triggering stress (>20) but below 50 comfort threshold
      const mixedNeeds = [80, 80, 80, 40, 80, 80];
      const delta = calcStressDelta(noTraits, mixedNeeds);
      expect(delta).toBe(0); // no gain, no recovery
    });
  });

  describe("neuroticism", () => {
    it("amplifies stress gains at high neuroticism (1.0)", () => {
      const neurotic = { trait_neuroticism: 1.0, trait_agreeableness: null };
      const stable = { trait_neuroticism: 0.0, trait_agreeableness: null };
      const noTrait = { trait_neuroticism: null, trait_agreeableness: null };

      const deltaNeurotic = calcStressDelta(neurotic, ONE_NEED_CRITICAL);
      const deltaStable = calcStressDelta(stable, ONE_NEED_CRITICAL);
      const deltaNoTrait = calcStressDelta(noTrait, ONE_NEED_CRITICAL);

      // Neurotic gains more stress than stable
      expect(deltaNeurotic).toBeGreaterThan(deltaStable);

      // At 0.5 trait (average), effect equals null — but 0.5 is exact neutral
      const neutral = { trait_neuroticism: 0.5, trait_agreeableness: null };
      const deltaNeutral = calcStressDelta(neutral, ONE_NEED_CRITICAL);
      expect(deltaNeutral).toBeCloseTo(deltaNoTrait);
    });

    it("neurotic dwarf gains 1.5× stress at trait=1.0", () => {
      const neurotic = { trait_neuroticism: 1.0, trait_agreeableness: null };
      const noTrait = { trait_neuroticism: null, trait_agreeableness: null };

      // Use needs that have no recovery (some need below 50 but none critical)
      // Food=10 → gain=0.2, social=40 → no gain, no recovery since not all>50
      const needs = [10, 80, 80, 40, 80, 80];

      const deltaNeurotic = calcStressDelta(neurotic, needs);
      const deltaNoTrait = calcStressDelta(noTrait, needs);

      // Neurotic multiplier: 1 + (1.0 - 0.5) * 1.0 = 1.5
      expect(deltaNeurotic).toBeCloseTo(deltaNoTrait * 1.5);
    });

    it("stable dwarf gains 0.5× stress at trait=0.0", () => {
      const stable = { trait_neuroticism: 0.0, trait_agreeableness: null };
      const noTrait = { trait_neuroticism: null, trait_agreeableness: null };

      // Same setup — food critical, social low (no recovery)
      const needs = [10, 80, 80, 40, 80, 80];

      const deltaStable = calcStressDelta(stable, needs);
      const deltaNoTrait = calcStressDelta(noTrait, needs);

      // Stable multiplier: 1 + (0.0 - 0.5) * 1.0 = 0.5
      expect(deltaStable).toBeCloseTo(deltaNoTrait * 0.5);
    });

    it("neuroticism does not affect recovery (negative delta)", () => {
      const neurotic = { trait_neuroticism: 1.0, trait_agreeableness: null };
      const noTrait = { trait_neuroticism: null, trait_agreeableness: null };

      // All comfortable — gainDelta=0, so neuroticism has nothing to multiply
      const deltaNeurotic = calcStressDelta(neurotic, COMFORTABLE_NEEDS);
      const deltaNoTrait = calcStressDelta(noTrait, COMFORTABLE_NEEDS);

      expect(deltaNeurotic).toBeCloseTo(deltaNoTrait);
    });
  });

  describe("agreeableness", () => {
    it("agreeable dwarf recovers faster when comfortable", () => {
      const agreeable = { trait_neuroticism: null, trait_agreeableness: 1.0 };
      const noTrait = { trait_neuroticism: null, trait_agreeableness: null };

      const deltaAgreeable = calcStressDelta(agreeable, COMFORTABLE_NEEDS);
      const deltaNoTrait = calcStressDelta(noTrait, COMFORTABLE_NEEDS);

      // Agreeable should recover more (more negative delta)
      expect(deltaAgreeable).toBeLessThan(deltaNoTrait);
    });

    it("agreeable dwarf at trait=1.0 recovers base+bonus per tick", () => {
      const agreeable = { trait_neuroticism: null, trait_agreeableness: 1.0 };
      const delta = calcStressDelta(agreeable, COMFORTABLE_NEEDS);
      // base -0.1 + agreeableness bonus -0.1 = -0.2
      expect(delta).toBeCloseTo(-0.2);
    });

    it("agreeableness has no effect when needs are not all comfortable", () => {
      const agreeable = { trait_neuroticism: null, trait_agreeableness: 1.0 };
      const noTrait = { trait_neuroticism: null, trait_agreeableness: null };

      // social=40 — not all needs above 50, so no recovery at all
      const mixedNeeds = [80, 80, 80, 40, 80, 80];

      const deltaAgreeable = calcStressDelta(agreeable, mixedNeeds);
      const deltaNoTrait = calcStressDelta(noTrait, mixedNeeds);

      expect(deltaAgreeable).toBeCloseTo(deltaNoTrait);
    });
  });

  describe("recovery requires all 6 needs comfortable", () => {
    it("does not recover if only food/drink/sleep are good but social is low", () => {
      const noTrait = { trait_neuroticism: null, trait_agreeableness: null };

      // Old behavior (3-need check) would recover here; new behavior should not
      const needs = [80, 80, 80, 40, 80, 80]; // social=40
      const delta = calcStressDelta(noTrait, needs);
      expect(delta).toBe(0);
    });

    it("recovers when all 6 needs are above 50", () => {
      const noTrait = { trait_neuroticism: null, trait_agreeableness: null };
      const needs = [60, 60, 60, 60, 60, 60];
      const delta = calcStressDelta(noTrait, needs);
      expect(delta).toBeCloseTo(-0.1);
    });
  });
});
