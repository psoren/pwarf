import { describe, it, expect } from "vitest";
import { calcStressDelta } from "./stress-update.js";
import { MEMORY_STRESS_PER_TICK } from "@pwarf/shared";
import type { DwarfMemory } from "@pwarf/shared";

// All needs comfortable — no stress gains, just recovery (4 needs: food, drink, sleep, morale)
const COMFORTABLE_NEEDS = [80, 80, 80, 80];

// One need critically low (food=10)
const ONE_NEED_CRITICAL = [10, 80, 80, 80];

// All needs zero
const ALL_NEEDS_ZERO = [0, 0, 0, 0];

describe("calcStressDelta", () => {
  describe("baseline (no traits)", () => {
    const noTraits = { trait_neuroticism: null, trait_agreeableness: null };

    it("returns negative delta when all needs are comfortable", () => {
      const delta = calcStressDelta(noTraits, COMFORTABLE_NEEDS);
      expect(delta).toBeCloseTo(-0.1);
    });

    it("returns positive delta when a need is critically low", () => {
      const delta = calcStressDelta(noTraits, ONE_NEED_CRITICAL);
      expect(delta).toBeCloseTo(0.2);
    });

    it("adds deprivation penalty when a need is at zero", () => {
      // need=0: (20-0)*0.02 = 0.4 + 0.5 penalty = 0.9 per need x 4
      const delta = calcStressDelta(noTraits, ALL_NEEDS_ZERO);
      expect(delta).toBeCloseTo(4 * (0.4 + 0.5));
    });

    it("returns recovery when needs are just below comfortable but not critical", () => {
      const midNeeds = [55, 55, 55, 55];
      const delta = calcStressDelta(noTraits, midNeeds);
      expect(delta).toBeCloseTo(-0.1);
    });

    it("no recovery when some needs are below 50", () => {
      const mixedNeeds = [80, 80, 80, 40];
      const delta = calcStressDelta(noTraits, mixedNeeds);
      expect(delta).toBe(0);
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

      expect(deltaNeurotic).toBeGreaterThan(deltaStable);

      const neutral = { trait_neuroticism: 0.5, trait_agreeableness: null };
      const deltaNeutral = calcStressDelta(neutral, ONE_NEED_CRITICAL);
      expect(deltaNeutral).toBeCloseTo(deltaNoTrait);
    });

    it("neurotic dwarf gains 1.5x stress at trait=1.0", () => {
      const neurotic = { trait_neuroticism: 1.0, trait_agreeableness: null };
      const noTrait = { trait_neuroticism: null, trait_agreeableness: null };

      const needs = [10, 80, 80, 40];

      const deltaNeurotic = calcStressDelta(neurotic, needs);
      const deltaNoTrait = calcStressDelta(noTrait, needs);

      expect(deltaNeurotic).toBeCloseTo(deltaNoTrait * 1.5);
    });

    it("stable dwarf gains 0.5x stress at trait=0.0", () => {
      const stable = { trait_neuroticism: 0.0, trait_agreeableness: null };
      const noTrait = { trait_neuroticism: null, trait_agreeableness: null };

      const needs = [10, 80, 80, 40];

      const deltaStable = calcStressDelta(stable, needs);
      const deltaNoTrait = calcStressDelta(noTrait, needs);

      expect(deltaStable).toBeCloseTo(deltaNoTrait * 0.5);
    });

    it("neuroticism does not affect recovery (negative delta)", () => {
      const neurotic = { trait_neuroticism: 1.0, trait_agreeableness: null };
      const noTrait = { trait_neuroticism: null, trait_agreeableness: null };

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

      const mixedNeeds = [80, 80, 80, 40];

      const deltaAgreeable = calcStressDelta(agreeable, mixedNeeds);
      const deltaNoTrait = calcStressDelta(noTrait, mixedNeeds);

      expect(deltaAgreeable).toBeCloseTo(deltaNoTrait);
    });
  });

  describe("memories", () => {
    const noTraits = { trait_neuroticism: null, trait_agreeableness: null };

    it("positive-intensity memory increases stress delta", () => {
      const deathMemory: DwarfMemory = { type: 'witnessed_death', intensity: 15, year: 1, expires_year: 4 };
      const deltaWithMemory = calcStressDelta(noTraits, COMFORTABLE_NEEDS, [deathMemory]);
      const deltaWithout = calcStressDelta(noTraits, COMFORTABLE_NEEDS);
      expect(deltaWithMemory).toBeCloseTo(deltaWithout + 15 * MEMORY_STRESS_PER_TICK);
    });

    it("negative-intensity memory decreases stress delta", () => {
      const artifactMemory: DwarfMemory = { type: 'created_artifact', intensity: -20, year: 1, expires_year: 6 };
      const deltaWithMemory = calcStressDelta(noTraits, COMFORTABLE_NEEDS, [artifactMemory]);
      const deltaWithout = calcStressDelta(noTraits, COMFORTABLE_NEEDS);
      expect(deltaWithMemory).toBeCloseTo(deltaWithout + (-20) * MEMORY_STRESS_PER_TICK);
    });

    it("multiple memories stack", () => {
      const mems: DwarfMemory[] = [
        { type: 'witnessed_death', intensity: 15, year: 1, expires_year: 4 },
        { type: 'witnessed_death', intensity: 15, year: 1, expires_year: 4 },
      ];
      const deltaWithMemory = calcStressDelta(noTraits, COMFORTABLE_NEEDS, mems);
      const deltaWithout = calcStressDelta(noTraits, COMFORTABLE_NEEDS);
      expect(deltaWithMemory).toBeCloseTo(deltaWithout + 2 * 15 * MEMORY_STRESS_PER_TICK);
    });

    it("empty memories array behaves same as no memories", () => {
      const withEmpty = calcStressDelta(noTraits, COMFORTABLE_NEEDS, []);
      const withUndefined = calcStressDelta(noTraits, COMFORTABLE_NEEDS);
      expect(withEmpty).toBeCloseTo(withUndefined);
    });
  });

  describe("recovery requires all 4 needs comfortable", () => {
    it("does not recover if morale is low", () => {
      const noTrait = { trait_neuroticism: null, trait_agreeableness: null };
      const needs = [80, 80, 80, 40]; // morale=40
      const delta = calcStressDelta(noTrait, needs);
      expect(delta).toBe(0);
    });

    it("recovers when all 4 needs are above 50", () => {
      const noTrait = { trait_neuroticism: null, trait_agreeableness: null };
      const needs = [60, 60, 60, 60];
      const delta = calcStressDelta(noTrait, needs);
      expect(delta).toBeCloseTo(-0.1);
    });
  });
});
