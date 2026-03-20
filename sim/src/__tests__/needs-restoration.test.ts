import { describe, it, expect } from "vitest";
import { restoreSocialNeed } from "../phases/need-satisfaction.js";
import { restorePurposeNeed } from "../phases/task-completion.js";
import { makeDwarf, makeContext, makeStructure } from "./test-helpers.js";
import { beautyRestoration } from "../phases/beauty-restoration.js";
import {
  SOCIAL_RESTORE_PER_NEARBY_DWARF,
  SOCIAL_PROXIMITY_MAX_DWARVES,
  SOCIAL_PROXIMITY_RADIUS,
  PURPOSE_RESTORE_SKILLED,
  PURPOSE_RESTORE_HAUL,
  BEAUTY_RESTORE_PASSIVE,
  BEAUTY_RESTORE_NEAR_STRUCTURE,
  MAX_NEED,
} from "@pwarf/shared";

// ============================================================
// Social need restoration
// ============================================================

describe("restoreSocialNeed", () => {
  it("does nothing when no other dwarves are nearby", () => {
    const dwarf = makeDwarf({ need_social: 50, position_x: 0, position_y: 0, position_z: 0 });
    const far = makeDwarf({ position_x: 100, position_y: 100, position_z: 0 });
    restoreSocialNeed(dwarf, [dwarf, far]);
    expect(dwarf.need_social).toBe(50);
  });

  it("restores social need when a dwarf is nearby", () => {
    const dwarf = makeDwarf({ need_social: 50, position_x: 0, position_y: 0, position_z: 0 });
    const neighbor = makeDwarf({ position_x: 3, position_y: 3, position_z: 0 });
    restoreSocialNeed(dwarf, [dwarf, neighbor]);
    expect(dwarf.need_social).toBeCloseTo(50 + SOCIAL_RESTORE_PER_NEARBY_DWARF);
  });

  it("restoration scales with nearby dwarf count up to max", () => {
    const dwarf = makeDwarf({ need_social: 30, position_x: 0, position_y: 0, position_z: 0 });
    const neighbors = Array.from({ length: SOCIAL_PROXIMITY_MAX_DWARVES + 2 }, (_, i) =>
      makeDwarf({ position_x: i, position_y: 0, position_z: 0 }),
    );
    restoreSocialNeed(dwarf, [dwarf, ...neighbors]);
    const expected = 30 + SOCIAL_PROXIMITY_MAX_DWARVES * SOCIAL_RESTORE_PER_NEARBY_DWARF;
    expect(dwarf.need_social).toBeCloseTo(expected);
  });

  it("ignores dwarves on different z-levels", () => {
    const dwarf = makeDwarf({ need_social: 50, position_x: 0, position_y: 0, position_z: 0 });
    const other = makeDwarf({ position_x: 1, position_y: 1, position_z: -1 });
    restoreSocialNeed(dwarf, [dwarf, other]);
    expect(dwarf.need_social).toBe(50);
  });

  it("ignores dead dwarves", () => {
    const dwarf = makeDwarf({ need_social: 50, position_x: 0, position_y: 0, position_z: 0 });
    const dead = makeDwarf({ status: "dead", position_x: 1, position_y: 1, position_z: 0 });
    restoreSocialNeed(dwarf, [dwarf, dead]);
    expect(dwarf.need_social).toBe(50);
  });

  it("ignores dwarves beyond SOCIAL_PROXIMITY_RADIUS", () => {
    const dwarf = makeDwarf({ need_social: 50, position_x: 0, position_y: 0, position_z: 0 });
    const far = makeDwarf({ position_x: SOCIAL_PROXIMITY_RADIUS + 1, position_y: 0, position_z: 0 });
    restoreSocialNeed(dwarf, [dwarf, far]);
    expect(dwarf.need_social).toBe(50);
  });

  it("does not exceed MAX_NEED", () => {
    const dwarf = makeDwarf({ need_social: MAX_NEED, position_x: 0, position_y: 0, position_z: 0 });
    const neighbors = Array.from({ length: 3 }, () =>
      makeDwarf({ position_x: 1, position_y: 1, position_z: 0 }),
    );
    restoreSocialNeed(dwarf, [dwarf, ...neighbors]);
    expect(dwarf.need_social).toBe(MAX_NEED);
  });
});

// ============================================================
// Purpose need restoration
// ============================================================

describe("restorePurposeNeed", () => {
  it("restores purpose on skilled tasks", () => {
    const dwarf = makeDwarf({ need_purpose: 50 });
    restorePurposeNeed(dwarf, "mine");
    expect(dwarf.need_purpose).toBe(50 + PURPOSE_RESTORE_SKILLED);
  });

  it("restores less purpose on haul tasks", () => {
    const dwarf = makeDwarf({ need_purpose: 50 });
    restorePurposeNeed(dwarf, "haul");
    expect(dwarf.need_purpose).toBe(50 + PURPOSE_RESTORE_HAUL);
  });

  it("restores no purpose on autonomous tasks (eat/drink/sleep/wander)", () => {
    for (const taskType of ["eat", "drink", "sleep", "wander"]) {
      const dwarf = makeDwarf({ need_purpose: 50 });
      restorePurposeNeed(dwarf, taskType);
      expect(dwarf.need_purpose).toBe(50);
    }
  });

  it("restores purpose on all skilled task types", () => {
    const skilled = ["mine", "build_wall", "build_floor", "build_bed", "farm_till", "farm_plant", "farm_harvest"];
    for (const taskType of skilled) {
      const dwarf = makeDwarf({ need_purpose: 0 });
      restorePurposeNeed(dwarf, taskType);
      expect(dwarf.need_purpose).toBe(PURPOSE_RESTORE_SKILLED);
    }
  });

  it("does not exceed MAX_NEED", () => {
    const dwarf = makeDwarf({ need_purpose: MAX_NEED });
    restorePurposeNeed(dwarf, "mine");
    expect(dwarf.need_purpose).toBe(MAX_NEED);
  });
});

// ============================================================
// Beauty need restoration
// ============================================================

describe("beautyRestoration", () => {
  it("applies passive restoration every tick to alive dwarves", async () => {
    const dwarf = makeDwarf({ need_beauty: 50 });
    const ctx = makeContext({ dwarves: [dwarf] });
    await beautyRestoration(ctx);
    expect(ctx.state.dwarves[0].need_beauty).toBeCloseTo(50 + BEAUTY_RESTORE_PASSIVE);
  });

  it("applies bonus restoration near a completed well", async () => {
    const dwarf = makeDwarf({ need_beauty: 50, position_x: 10, position_y: 10, position_z: 0 });
    const well = makeStructure({
      type: "well",
      completion_pct: 100,
      position_x: 12,
      position_y: 12,
      position_z: 0,
    });
    const ctx = makeContext({ dwarves: [dwarf], structures: [well] });
    await beautyRestoration(ctx);
    expect(ctx.state.dwarves[0].need_beauty).toBeCloseTo(50 + BEAUTY_RESTORE_PASSIVE + BEAUTY_RESTORE_NEAR_STRUCTURE);
  });

  it("no bonus from incomplete structure", async () => {
    const dwarf = makeDwarf({ need_beauty: 50, position_x: 10, position_y: 10, position_z: 0 });
    const well = makeStructure({ type: "well", completion_pct: 50, position_x: 10, position_y: 10, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf], structures: [well] });
    await beautyRestoration(ctx);
    expect(ctx.state.dwarves[0].need_beauty).toBeCloseTo(50 + BEAUTY_RESTORE_PASSIVE);
  });

  it("skips dead dwarves", async () => {
    const dead = makeDwarf({ status: "dead", need_beauty: 50 });
    const ctx = makeContext({ dwarves: [dead] });
    await beautyRestoration(ctx);
    expect(ctx.state.dwarves[0].need_beauty).toBe(50);
  });

  it("does not exceed MAX_NEED", async () => {
    const dwarf = makeDwarf({ need_beauty: MAX_NEED });
    const ctx = makeContext({ dwarves: [dwarf] });
    await beautyRestoration(ctx);
    expect(ctx.state.dwarves[0].need_beauty).toBe(MAX_NEED);
  });
});
