import { describe, it, expect } from "vitest";
import { levelToStars } from "../lib/dwarf-skills.js";

describe("levelToStars", () => {
  it("returns 0 stars for level 0", () => {
    expect(levelToStars(0)).toBe(0);
  });

  it("returns 1 star for levels 1–4", () => {
    expect(levelToStars(1)).toBe(1);
    expect(levelToStars(4)).toBe(1);
  });

  it("returns 2 stars for levels 5–8", () => {
    expect(levelToStars(5)).toBe(2);
    expect(levelToStars(8)).toBe(2);
  });

  it("returns 3 stars for levels 9–12", () => {
    expect(levelToStars(9)).toBe(3);
    expect(levelToStars(12)).toBe(3);
  });

  it("returns 4 stars for levels 13–15", () => {
    expect(levelToStars(13)).toBe(4);
    expect(levelToStars(15)).toBe(4);
  });

  it("returns 5 stars for levels 16–20", () => {
    expect(levelToStars(16)).toBe(5);
    expect(levelToStars(20)).toBe(5);
  });
});
