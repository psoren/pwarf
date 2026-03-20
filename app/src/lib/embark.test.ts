import { describe, it, expect } from "vitest";
import { generateFortressName } from "./civ-names.js";
import { FORTRESS_NAME_MATERIALS, FORTRESS_NAME_NOUNS } from "@pwarf/shared";

describe("generateFortressName", () => {
  it("returns a non-empty string", () => {
    const name = generateFortressName();
    expect(typeof name).toBe("string");
    expect(name.length).toBeGreaterThan(0);
  });

  it("starts with a material and ends with a noun", () => {
    // Run many times to cover randomness
    for (let i = 0; i < 50; i++) {
      const name = generateFortressName();
      const startsWithMaterial = FORTRESS_NAME_MATERIALS.some((m: string) => name.startsWith(m));
      const endsWithNoun = FORTRESS_NAME_NOUNS.some((n: string) => name.endsWith(n));
      expect(startsWithMaterial).toBe(true);
      expect(endsWithNoun).toBe(true);
    }
  });
});
