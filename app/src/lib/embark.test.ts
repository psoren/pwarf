import { describe, it, expect } from "vitest";
import { pickUniqueNames, DWARF_NAMES, SURNAMES } from "./dwarf-names";

describe("pickUniqueNames", () => {
  it("returns the requested number of names", () => {
    const names = pickUniqueNames(7);
    expect(names).toHaveLength(7);
  });

  it("returns unique names (no duplicates)", () => {
    const names = pickUniqueNames(7);
    const unique = new Set(names);
    expect(unique.size).toBe(7);
  });

  it("never exceeds the pool size", () => {
    const names = pickUniqueNames(100);
    expect(names.length).toBe(DWARF_NAMES.length);
  });

  it("all returned names come from DWARF_NAMES", () => {
    const names = pickUniqueNames(7);
    for (const name of names) {
      expect(DWARF_NAMES).toContain(name);
    }
  });

  it("returns empty array for count 0", () => {
    expect(pickUniqueNames(0)).toHaveLength(0);
  });
});

describe("name constants", () => {
  it("DWARF_NAMES has at least 7 entries", () => {
    expect(DWARF_NAMES.length).toBeGreaterThanOrEqual(7);
  });

  it("SURNAMES has at least 1 entry", () => {
    expect(SURNAMES.length).toBeGreaterThanOrEqual(1);
  });

  it("all names are non-empty strings", () => {
    for (const name of DWARF_NAMES) {
      expect(name.length).toBeGreaterThan(0);
    }
    for (const name of SURNAMES) {
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
