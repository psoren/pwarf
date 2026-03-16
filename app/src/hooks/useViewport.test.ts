import { describe, it, expect } from "vitest";
import { WORLD_WIDTH, WORLD_HEIGHT } from "@pwarf/shared";
import { clampCoord } from "./useViewport";

describe("clampCoord", () => {
  it("returns value unchanged when within bounds", () => {
    expect(clampCoord(100, WORLD_WIDTH - 1)).toBe(100);
    expect(clampCoord(0, WORLD_WIDTH - 1)).toBe(0);
    expect(clampCoord(WORLD_WIDTH - 1, WORLD_WIDTH - 1)).toBe(WORLD_WIDTH - 1);
  });

  it("clamps negative values to 0", () => {
    expect(clampCoord(-1, WORLD_WIDTH - 1)).toBe(0);
    expect(clampCoord(-999, WORLD_HEIGHT - 1)).toBe(0);
  });

  it("clamps values exceeding WORLD_WIDTH - 1", () => {
    expect(clampCoord(WORLD_WIDTH, WORLD_WIDTH - 1)).toBe(WORLD_WIDTH - 1);
    expect(clampCoord(9999, WORLD_WIDTH - 1)).toBe(WORLD_WIDTH - 1);
  });

  it("clamps values exceeding WORLD_HEIGHT - 1", () => {
    expect(clampCoord(WORLD_HEIGHT, WORLD_HEIGHT - 1)).toBe(WORLD_HEIGHT - 1);
    expect(clampCoord(9999, WORLD_HEIGHT - 1)).toBe(WORLD_HEIGHT - 1);
  });
});

describe("viewport clamping (pan)", () => {
  it("pan does not produce offsets below 0", () => {
    // Simulate: starting at (0,0) and panning left/up
    const offsetX = 0;
    const offsetY = 0;
    expect(clampCoord(offsetX + -5, WORLD_WIDTH - 1)).toBe(0);
    expect(clampCoord(offsetY + -10, WORLD_HEIGHT - 1)).toBe(0);
  });

  it("pan does not exceed WORLD_WIDTH/HEIGHT - 1", () => {
    const offsetX = WORLD_WIDTH - 2;
    const offsetY = WORLD_HEIGHT - 2;
    expect(clampCoord(offsetX + 5, WORLD_WIDTH - 1)).toBe(WORLD_WIDTH - 1);
    expect(clampCoord(offsetY + 10, WORLD_HEIGHT - 1)).toBe(WORLD_HEIGHT - 1);
  });
});

describe("viewport clamping (cursor)", () => {
  it("cursor is clamped to valid range", () => {
    expect(clampCoord(-1, WORLD_WIDTH - 1)).toBe(0);
    expect(clampCoord(WORLD_WIDTH, WORLD_WIDTH - 1)).toBe(WORLD_WIDTH - 1);
    expect(clampCoord(-1, WORLD_HEIGHT - 1)).toBe(0);
    expect(clampCoord(WORLD_HEIGHT, WORLD_HEIGHT - 1)).toBe(WORLD_HEIGHT - 1);
  });

  it("cursor at boundary values is unchanged", () => {
    expect(clampCoord(0, WORLD_WIDTH - 1)).toBe(0);
    expect(clampCoord(WORLD_WIDTH - 1, WORLD_WIDTH - 1)).toBe(WORLD_WIDTH - 1);
  });
});
