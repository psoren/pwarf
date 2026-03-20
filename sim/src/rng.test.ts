import { describe, it, expect } from "vitest";
import { createRng, DEFAULT_TEST_SEED } from "./rng.js";

describe("createRng", () => {
  it("produces values in [0, 1)", () => {
    const rng = createRng(DEFAULT_TEST_SEED);
    for (let i = 0; i < 100; i++) {
      const v = rng.random();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("produces the same sequence for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 50; i++) {
      expect(a.random()).toBe(b.random());
    }
  });

  it("produces different sequences for different seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    const aVals = Array.from({ length: 10 }, () => a.random());
    const bVals = Array.from({ length: 10 }, () => b.random());
    expect(aVals).not.toEqual(bVals);
  });

  it("int returns values in [min, max] inclusive", () => {
    const rng = createRng(DEFAULT_TEST_SEED);
    for (let i = 0; i < 200; i++) {
      const v = rng.int(-5, 5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it("uuid produces valid v4-like UUIDs", () => {
    const rng = createRng(DEFAULT_TEST_SEED);
    const uuid = rng.uuid();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("uuid produces unique values", () => {
    const rng = createRng(DEFAULT_TEST_SEED);
    const ids = new Set(Array.from({ length: 100 }, () => rng.uuid()));
    expect(ids.size).toBe(100);
  });

  it("uuid is deterministic with the same seed", () => {
    const a = createRng(99);
    const b = createRng(99);
    expect(a.uuid()).toBe(b.uuid());
    expect(a.uuid()).toBe(b.uuid());
  });
});
