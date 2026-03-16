import { describe, it, expect } from "vitest";
import { FORTRESS_DWARVES, DWARF_POSITION_MAP } from "./fortressDwarves";

describe("fortress dwarves", () => {
  it("all dwarves are inside the fortress room (2–12, 2–8)", () => {
    for (const d of FORTRESS_DWARVES) {
      expect(d.x).toBeGreaterThanOrEqual(2);
      expect(d.x).toBeLessThanOrEqual(12);
      expect(d.y).toBeGreaterThanOrEqual(2);
      expect(d.y).toBeLessThanOrEqual(8);
    }
  });

  it("no two dwarves share the same position", () => {
    const keys = FORTRESS_DWARVES.map((d) => `${d.x},${d.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("no dwarf occupies the stairs at (7,5)", () => {
    expect(DWARF_POSITION_MAP.has("7,5")).toBe(false);
  });

  it("no dwarf occupies the door gap at (7,2)", () => {
    expect(DWARF_POSITION_MAP.has("7,2")).toBe(false);
  });

  it("position map has same count as array", () => {
    expect(DWARF_POSITION_MAP.size).toBe(FORTRESS_DWARVES.length);
  });

  it("each dwarf has a non-empty name and job", () => {
    for (const d of FORTRESS_DWARVES) {
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.job.length).toBeGreaterThan(0);
    }
  });
});
