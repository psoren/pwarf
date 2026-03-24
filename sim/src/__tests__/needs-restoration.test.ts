import { describe, it, expect } from "vitest";
import { restoreMorale } from "../phases/need-satisfaction.js";
import { restoreMoraleOnTaskComplete } from "../phases/task-completion.js";
import { makeDwarf, makeStructure } from "./test-helpers.js";
import {
  MORALE_RESTORE_PER_NEARBY_DWARF,
  SOCIAL_PROXIMITY_MAX_DWARVES,
  SOCIAL_PROXIMITY_RADIUS,
  MORALE_RESTORE_SKILLED_TASK,
  MORALE_RESTORE_HAUL_TASK,
  MAX_NEED,
} from "@pwarf/shared";

// ============================================================
// Morale restoration (from proximity)
// ============================================================

describe("restoreMorale", () => {
  const emptyStructures: any[] = [];
  const emptyTiles = new Map();

  it("does nothing when no other dwarves are nearby", () => {
    const dwarf = makeDwarf({ need_social: 50, position_x: 0, position_y: 0, position_z: 0 });
    const far = makeDwarf({ position_x: 100, position_y: 100, position_z: 0 });
    restoreMorale(dwarf, [dwarf, far], emptyStructures, emptyTiles);
    expect(dwarf.need_social).toBe(50);
  });

  it("restores morale when a dwarf is nearby", () => {
    const dwarf = makeDwarf({ need_social: 50, position_x: 0, position_y: 0, position_z: 0, trait_extraversion: null });
    const neighbor = makeDwarf({ position_x: 3, position_y: 3, position_z: 0 });
    restoreMorale(dwarf, [dwarf, neighbor], emptyStructures, emptyTiles);
    expect(dwarf.need_social).toBeCloseTo(50 + MORALE_RESTORE_PER_NEARBY_DWARF);
  });

  it("restoration scales with nearby dwarf count up to max", () => {
    const dwarf = makeDwarf({ need_social: 30, position_x: 0, position_y: 0, position_z: 0, trait_extraversion: null });
    const neighbors = Array.from({ length: SOCIAL_PROXIMITY_MAX_DWARVES + 2 }, (_, i) =>
      makeDwarf({ position_x: i, position_y: 0, position_z: 0 }),
    );
    restoreMorale(dwarf, [dwarf, ...neighbors], emptyStructures, emptyTiles);
    const expected = 30 + SOCIAL_PROXIMITY_MAX_DWARVES * MORALE_RESTORE_PER_NEARBY_DWARF;
    expect(dwarf.need_social).toBeCloseTo(expected);
  });

  it("ignores dwarves on different z-levels", () => {
    const dwarf = makeDwarf({ need_social: 50, position_x: 0, position_y: 0, position_z: 0 });
    const other = makeDwarf({ position_x: 1, position_y: 1, position_z: -1 });
    restoreMorale(dwarf, [dwarf, other], emptyStructures, emptyTiles);
    expect(dwarf.need_social).toBe(50);
  });

  it("ignores dead dwarves", () => {
    const dwarf = makeDwarf({ need_social: 50, position_x: 0, position_y: 0, position_z: 0 });
    const dead = makeDwarf({ status: "dead", position_x: 1, position_y: 1, position_z: 0 });
    restoreMorale(dwarf, [dwarf, dead], emptyStructures, emptyTiles);
    expect(dwarf.need_social).toBe(50);
  });

  it("ignores dwarves beyond SOCIAL_PROXIMITY_RADIUS", () => {
    const dwarf = makeDwarf({ need_social: 50, position_x: 0, position_y: 0, position_z: 0 });
    const far = makeDwarf({ position_x: SOCIAL_PROXIMITY_RADIUS + 1, position_y: 0, position_z: 0 });
    restoreMorale(dwarf, [dwarf, far], emptyStructures, emptyTiles);
    expect(dwarf.need_social).toBe(50);
  });

  it("does not exceed MAX_NEED", () => {
    const dwarf = makeDwarf({ need_social: MAX_NEED, position_x: 0, position_y: 0, position_z: 0 });
    const neighbors = Array.from({ length: 3 }, () =>
      makeDwarf({ position_x: 1, position_y: 1, position_z: 0 }),
    );
    restoreMorale(dwarf, [dwarf, ...neighbors], emptyStructures, emptyTiles);
    expect(dwarf.need_social).toBe(MAX_NEED);
  });
});

// ============================================================
// Morale restoration from task completion
// ============================================================

describe("restoreMoraleOnTaskComplete", () => {
  it("restores morale on skilled tasks", () => {
    const dwarf = makeDwarf({ need_social: 50, trait_conscientiousness: null });
    restoreMoraleOnTaskComplete(dwarf, "mine");
    expect(dwarf.need_social).toBe(50 + MORALE_RESTORE_SKILLED_TASK);
  });

  it("restores less morale on haul tasks", () => {
    const dwarf = makeDwarf({ need_social: 50, trait_conscientiousness: null });
    restoreMoraleOnTaskComplete(dwarf, "haul");
    expect(dwarf.need_social).toBe(50 + MORALE_RESTORE_HAUL_TASK);
  });

  it("restores no morale on autonomous tasks (eat/drink/sleep)", () => {
    for (const taskType of ["eat", "drink", "sleep"]) {
      const dwarf = makeDwarf({ need_social: 50 });
      restoreMoraleOnTaskComplete(dwarf, taskType);
      expect(dwarf.need_social).toBe(50);
    }
  });

  it("restores morale on all skilled task types", () => {
    const skilled = ["mine", "build_wall", "build_floor", "build_bed", "farm_till", "farm_plant", "farm_harvest"];
    for (const taskType of skilled) {
      const dwarf = makeDwarf({ need_social: 0, trait_conscientiousness: null });
      restoreMoraleOnTaskComplete(dwarf, taskType);
      expect(dwarf.need_social).toBe(MORALE_RESTORE_SKILLED_TASK);
    }
  });

  it("does not exceed MAX_NEED", () => {
    const dwarf = makeDwarf({ need_social: MAX_NEED, trait_conscientiousness: null });
    restoreMoraleOnTaskComplete(dwarf, "mine");
    expect(dwarf.need_social).toBe(MAX_NEED);
  });

  it("conscientiousness modifier scales restore amount", () => {
    const diligent = makeDwarf({ need_social: 50, trait_conscientiousness: 1.0 });
    restoreMoraleOnTaskComplete(diligent, "mine");
    // 10 * (1 + (1.0 - 0.5) * 0.5) = 10 * 1.25 = 12.5
    expect(diligent.need_social).toBeCloseTo(50 + MORALE_RESTORE_SKILLED_TASK * 1.25);
  });
});
