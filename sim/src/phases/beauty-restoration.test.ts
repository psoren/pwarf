import { describe, it, expect } from "vitest";
import { beautyRestoration } from "./beauty-restoration.js";
import { makeDwarf, makeStructure, makeContext } from "../__tests__/test-helpers.js";
import {
  BEAUTY_RESTORE_PASSIVE,
  BEAUTY_RESTORE_NEAR_STRUCTURE,
} from "@pwarf/shared";

describe("beautyRestoration", () => {
  describe("baseline (no traits, no structures)", () => {
    it("applies passive restoration each tick", async () => {
      const dwarf = makeDwarf({ need_beauty: 50 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await beautyRestoration(ctx);

      expect(dwarf.need_beauty).toBeCloseTo(50 + BEAUTY_RESTORE_PASSIVE);
    });

    it("clamps beauty at MAX_NEED", async () => {
      const dwarf = makeDwarf({ need_beauty: 100 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await beautyRestoration(ctx);

      expect(dwarf.need_beauty).toBe(100);
    });

    it("does not affect dead dwarves", async () => {
      const dwarf = makeDwarf({ status: "dead", need_beauty: 50 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await beautyRestoration(ctx);

      expect(dwarf.need_beauty).toBe(50);
    });
  });

  describe("structure bonus", () => {
    it("applies structure bonus when near a well", async () => {
      const dwarf = makeDwarf({ need_beauty: 50, position_x: 5, position_y: 5, position_z: 0 });
      const well = makeStructure({ type: "well", completion_pct: 100, position_x: 5, position_y: 5, position_z: 0 });
      const ctx = makeContext({ dwarves: [dwarf], structures: [well] });

      await beautyRestoration(ctx);

      expect(dwarf.need_beauty).toBeCloseTo(50 + BEAUTY_RESTORE_PASSIVE + BEAUTY_RESTORE_NEAR_STRUCTURE);
    });

    it("no structure bonus when too far away", async () => {
      const dwarf = makeDwarf({ need_beauty: 50, position_x: 0, position_y: 0, position_z: 0 });
      const well = makeStructure({ type: "well", completion_pct: 100, position_x: 20, position_y: 20, position_z: 0 });
      const ctx = makeContext({ dwarves: [dwarf], structures: [well] });

      await beautyRestoration(ctx);

      expect(dwarf.need_beauty).toBeCloseTo(50 + BEAUTY_RESTORE_PASSIVE);
    });

    it("no structure bonus from incomplete structure", async () => {
      const dwarf = makeDwarf({ need_beauty: 50, position_x: 5, position_y: 5, position_z: 0 });
      const well = makeStructure({ type: "well", completion_pct: 50, position_x: 5, position_y: 5, position_z: 0 });
      const ctx = makeContext({ dwarves: [dwarf], structures: [well] });

      await beautyRestoration(ctx);

      expect(dwarf.need_beauty).toBeCloseTo(50 + BEAUTY_RESTORE_PASSIVE);
    });
  });

  describe("openness trait", () => {
    const NEARBY_WELL_POS = { position_x: 5, position_y: 5, position_z: 0 };

    it("open dwarf (1.0) gets larger structure bonus", async () => {
      const openDwarf = makeDwarf({ need_beauty: 50, trait_openness: 1.0, ...NEARBY_WELL_POS });
      const baseline = makeDwarf({ need_beauty: 50, trait_openness: null, ...NEARBY_WELL_POS });
      const well = makeStructure({ type: "well", completion_pct: 100, ...NEARBY_WELL_POS });

      const ctxOpen = makeContext({ dwarves: [openDwarf], structures: [well] });
      const ctxBase = makeContext({ dwarves: [baseline], structures: [makeStructure({ type: "well", completion_pct: 100, ...NEARBY_WELL_POS })] });

      await beautyRestoration(ctxOpen);
      await beautyRestoration(ctxBase);

      expect(openDwarf.need_beauty).toBeGreaterThan(baseline.need_beauty);
    });

    it("open dwarf (1.0) gets 1.5× structure bonus", async () => {
      const openDwarf = makeDwarf({ need_beauty: 50, trait_openness: 1.0, ...NEARBY_WELL_POS });
      const well = makeStructure({ type: "well", completion_pct: 100, ...NEARBY_WELL_POS });
      const ctx = makeContext({ dwarves: [openDwarf], structures: [well] });

      await beautyRestoration(ctx);

      expect(openDwarf.need_beauty).toBeCloseTo(
        50 + BEAUTY_RESTORE_PASSIVE + BEAUTY_RESTORE_NEAR_STRUCTURE * 1.5
      );
    });

    it("philistine dwarf (0.0) gets 0.5× structure bonus", async () => {
      const philistine = makeDwarf({ need_beauty: 50, trait_openness: 0.0, ...NEARBY_WELL_POS });
      const well = makeStructure({ type: "well", completion_pct: 100, ...NEARBY_WELL_POS });
      const ctx = makeContext({ dwarves: [philistine], structures: [well] });

      await beautyRestoration(ctx);

      expect(philistine.need_beauty).toBeCloseTo(
        50 + BEAUTY_RESTORE_PASSIVE + BEAUTY_RESTORE_NEAR_STRUCTURE * 0.5
      );
    });

    it("average openness (0.5) matches null trait behavior", async () => {
      const average = makeDwarf({ need_beauty: 50, trait_openness: 0.5, ...NEARBY_WELL_POS });
      const noTrait = makeDwarf({ need_beauty: 50, trait_openness: null, ...NEARBY_WELL_POS });
      const well1 = makeStructure({ type: "well", completion_pct: 100, ...NEARBY_WELL_POS });
      const well2 = makeStructure({ type: "well", completion_pct: 100, ...NEARBY_WELL_POS });

      const ctxAverage = makeContext({ dwarves: [average], structures: [well1] });
      const ctxNoTrait = makeContext({ dwarves: [noTrait], structures: [well2] });

      await beautyRestoration(ctxAverage);
      await beautyRestoration(ctxNoTrait);

      expect(average.need_beauty).toBeCloseTo(noTrait.need_beauty);
    });

    it("openness does not affect passive beauty restoration (only structure bonus)", async () => {
      const openDwarf = makeDwarf({ need_beauty: 50, trait_openness: 1.0, position_x: 50, position_y: 50, position_z: 0 });
      const ctx = makeContext({ dwarves: [openDwarf] }); // no structures

      await beautyRestoration(ctx);

      // Only passive restoration applies
      expect(openDwarf.need_beauty).toBeCloseTo(50 + BEAUTY_RESTORE_PASSIVE);
    });
  });
});
