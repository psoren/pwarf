import { describe, it, expect } from "vitest";
import type { FortressTile } from "@pwarf/shared";
import { overridesEqual } from "./tile-override-helpers";

function makeOverride(x: number, y: number, tile_type: string, is_mined = false, material: string | null = null): Partial<FortressTile> {
  return { x, y, tile_type: tile_type as FortressTile["tile_type"], is_mined, material };
}

describe("overridesEqual", () => {
  it("returns true for two empty maps", () => {
    expect(overridesEqual(new Map(), new Map())).toBe(true);
  });

  it("returns true when maps have identical entries", () => {
    const a = new Map([["1,2", makeOverride(1, 2, "constructed_floor")]]);
    const b = new Map([["1,2", makeOverride(1, 2, "constructed_floor")]]);
    expect(overridesEqual(a, b)).toBe(true);
  });

  it("returns false when sizes differ", () => {
    const a = new Map([["1,2", makeOverride(1, 2, "constructed_floor")]]);
    const b = new Map();
    expect(overridesEqual(a, b)).toBe(false);
  });

  it("returns false when tile_type differs", () => {
    const a = new Map([["1,2", makeOverride(1, 2, "constructed_floor")]]);
    const b = new Map([["1,2", makeOverride(1, 2, "constructed_wall")]]);
    expect(overridesEqual(a, b)).toBe(false);
  });

  it("returns false when is_mined differs", () => {
    const a = new Map([["1,2", makeOverride(1, 2, "soil", false)]]);
    const b = new Map([["1,2", makeOverride(1, 2, "soil", true)]]);
    expect(overridesEqual(a, b)).toBe(false);
  });

  it("returns false when material differs", () => {
    const a = new Map([["1,2", makeOverride(1, 2, "rock", false, "stone")]]);
    const b = new Map([["1,2", makeOverride(1, 2, "rock", false, "iron")]]);
    expect(overridesEqual(a, b)).toBe(false);
  });

  it("returns false when keys differ", () => {
    const a = new Map([["1,2", makeOverride(1, 2, "soil")]]);
    const b = new Map([["3,4", makeOverride(3, 4, "soil")]]);
    expect(overridesEqual(a, b)).toBe(false);
  });

  it("handles multiple entries correctly", () => {
    const a = new Map([
      ["1,2", makeOverride(1, 2, "constructed_floor")],
      ["3,4", makeOverride(3, 4, "constructed_wall", true, "stone")],
    ]);
    const b = new Map([
      ["1,2", makeOverride(1, 2, "constructed_floor")],
      ["3,4", makeOverride(3, 4, "constructed_wall", true, "stone")],
    ]);
    expect(overridesEqual(a, b)).toBe(true);
  });
});
