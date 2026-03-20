import { describe, it, expect } from "vitest";
import { stressColor, stressBarColor } from "./LeftPanel";

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

describe("stressBarColor", () => {
  it("returns green for low stress (0)", () => {
    expect(stressBarColor(0)).toBe("var(--green)");
  });

  it("returns green at boundary (30)", () => {
    expect(stressBarColor(30)).toBe("var(--green)");
  });

  it("returns amber for moderate stress (31)", () => {
    expect(stressBarColor(31)).toBe("var(--amber)");
  });

  it("returns amber at boundary (60)", () => {
    expect(stressBarColor(60)).toBe("var(--amber)");
  });

  it("returns orange for elevated stress (61)", () => {
    expect(stressBarColor(61)).toBe("#f97316");
  });

  it("returns orange at boundary (80)", () => {
    expect(stressBarColor(80)).toBe("#f97316");
  });

  it("returns red for high stress (81)", () => {
    expect(stressBarColor(81)).toBe("var(--red)");
  });

  it("returns red for max stress (100)", () => {
    expect(stressBarColor(100)).toBe("var(--red)");
  });
});
