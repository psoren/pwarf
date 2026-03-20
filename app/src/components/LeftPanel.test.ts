import { describe, it, expect } from "vitest";
import { stressColor } from "./LeftPanel";

describe("stressColor", () => {
  it("returns green for low stress (0)", () => {
    expect(stressColor(0)).toBe("var(--green)");
  });

  it("returns green for stress at upper low boundary (33)", () => {
    expect(stressColor(33)).toBe("var(--green)");
  });

  it("returns amber for medium stress (34)", () => {
    expect(stressColor(34)).toBe("var(--amber)");
  });

  it("returns amber for stress at upper medium boundary (66)", () => {
    expect(stressColor(66)).toBe("var(--amber)");
  });

  it("returns red for high stress (67)", () => {
    expect(stressColor(67)).toBe("var(--red)");
  });

  it("returns red for max stress (100)", () => {
    expect(stressColor(100)).toBe("var(--red)");
  });
});
