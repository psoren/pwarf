import { describe, it, expect } from "vitest";
import { skillStars } from "./skillStars";

describe("skillStars", () => {
  it("level 0 → all empty", () => {
    expect(skillStars(0)).toBe("☆☆☆☆☆");
  });

  it("level 1 → 1 star", () => {
    expect(skillStars(1)).toBe("★☆☆☆☆");
  });

  it("level 4 → 1 star (boundary)", () => {
    expect(skillStars(4)).toBe("★☆☆☆☆");
  });

  it("level 5 → 2 stars", () => {
    expect(skillStars(5)).toBe("★★☆☆☆");
  });

  it("level 8 → 2 stars (boundary)", () => {
    expect(skillStars(8)).toBe("★★☆☆☆");
  });

  it("level 12 → 3 stars", () => {
    expect(skillStars(12)).toBe("★★★☆☆");
  });

  it("level 16 → 4 stars", () => {
    expect(skillStars(16)).toBe("★★★★☆");
  });

  it("level 17 → 5 stars", () => {
    expect(skillStars(17)).toBe("★★★★★");
  });

  it("level 20 → 5 stars (max)", () => {
    expect(skillStars(20)).toBe("★★★★★");
  });

  it("always returns exactly 5 characters", () => {
    for (let i = 0; i <= 20; i++) {
      expect([...skillStars(i)].length).toBe(5);
    }
  });
});
