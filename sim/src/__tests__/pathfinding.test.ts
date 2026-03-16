import { describe, it, expect } from "vitest";
import type { FortressTileType } from "@pwarf/shared";
import {
  bfsNextStep,
  isWalkable,
  getNeighbors,
  manhattanDistance,
} from "../pathfinding.js";
import type { TileLookup } from "../pathfinding.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a tile lookup from a simple 2D grid (z=0 only). */
function gridLookup(grid: FortressTileType[][]): TileLookup {
  return (x, y, z) => {
    if (z !== 0) return null;
    if (y < 0 || y >= grid.length) return null;
    if (x < 0 || x >= grid[0]!.length) return null;
    return grid[y]![x]!;
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("isWalkable", () => {
  it("open_air is walkable", () => {
    expect(isWalkable("open_air")).toBe(true);
  });

  it("constructed_floor is walkable", () => {
    expect(isWalkable("constructed_floor")).toBe(true);
  });

  it("stone is not walkable", () => {
    expect(isWalkable("stone")).toBe(false);
  });

  it("null is not walkable", () => {
    expect(isWalkable(null)).toBe(false);
  });

  it("soil is walkable", () => {
    expect(isWalkable("soil")).toBe(true);
  });
});

describe("getNeighbors", () => {
  it("returns walkable cardinal neighbors", () => {
    // 3x3 grid, all open_air
    const grid: FortressTileType[][] = [
      ["open_air", "open_air", "open_air"],
      ["open_air", "open_air", "open_air"],
      ["open_air", "open_air", "open_air"],
    ];
    const lookup = gridLookup(grid);

    const neighbors = getNeighbors({ x: 1, y: 1, z: 0 }, lookup);
    expect(neighbors).toHaveLength(4);
  });

  it("excludes unwalkable neighbors", () => {
    const grid: FortressTileType[][] = [
      ["stone", "open_air", "stone"],
      ["open_air", "open_air", "stone"],
      ["stone", "stone", "stone"],
    ];
    const lookup = gridLookup(grid);

    const neighbors = getNeighbors({ x: 1, y: 1, z: 0 }, lookup);
    // Up (1,0)=open_air, Down (1,2)=stone, Left (0,1)=open_air, Right (2,1)=stone
    expect(neighbors).toHaveLength(2);
  });

  it("corner has fewer neighbors", () => {
    const grid: FortressTileType[][] = [
      ["open_air", "open_air"],
      ["open_air", "open_air"],
    ];
    const lookup = gridLookup(grid);

    const neighbors = getNeighbors({ x: 0, y: 0, z: 0 }, lookup);
    expect(neighbors).toHaveLength(2); // right and down
  });
});

describe("bfsNextStep", () => {
  it("returns null when already at goal", () => {
    const grid: FortressTileType[][] = [["open_air"]];
    const lookup = gridLookup(grid);

    const result = bfsNextStep({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, lookup);
    expect(result).toBeNull();
  });

  it("finds direct path on open grid", () => {
    const grid: FortressTileType[][] = [
      ["open_air", "open_air", "open_air", "open_air", "open_air"],
    ];
    const lookup = gridLookup(grid);

    const result = bfsNextStep({ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, lookup);
    expect(result).toEqual({ x: 1, y: 0, z: 0 });
  });

  it("navigates around walls", () => {
    // . = open_air, # = stone
    // Layout:
    //  . # .
    //  . # .
    //  . . .
    const grid: FortressTileType[][] = [
      ["open_air", "stone", "open_air"],
      ["open_air", "stone", "open_air"],
      ["open_air", "open_air", "open_air"],
    ];
    const lookup = gridLookup(grid);

    // Start at (0,0), goal at (2,0) — must go around the wall
    const result = bfsNextStep({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, lookup);
    // First step should be downward (0,1) to go around
    expect(result).toEqual({ x: 0, y: 1, z: 0 });
  });

  it("returns null when no path exists", () => {
    // Completely walled off
    const grid: FortressTileType[][] = [
      ["open_air", "stone", "open_air"],
    ];
    const lookup = gridLookup(grid);

    const result = bfsNextStep({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, lookup);
    expect(result).toBeNull();
  });

  it("adjacentToGoal stops next to the goal tile", () => {
    const grid: FortressTileType[][] = [
      ["open_air", "open_air", "stone"],
    ];
    const lookup = gridLookup(grid);

    // Goal is (2,0) which is stone (unwalkable). With adjacentToGoal=true,
    // should stop at (1,0).
    const result = bfsNextStep(
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      lookup,
      true,
    );
    // First step toward adjacent tile (1,0)
    expect(result).toEqual({ x: 1, y: 0, z: 0 });
  });

  it("adjacentToGoal returns null when already adjacent", () => {
    const grid: FortressTileType[][] = [
      ["open_air", "stone"],
    ];
    const lookup = gridLookup(grid);

    const result = bfsNextStep(
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      lookup,
      true,
    );
    expect(result).toBeNull();
  });
});

describe("manhattanDistance", () => {
  it("same position is 0", () => {
    expect(manhattanDistance({ x: 5, y: 5, z: 0 }, { x: 5, y: 5, z: 0 })).toBe(0);
  });

  it("calculates 2D distance", () => {
    expect(manhattanDistance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBe(7);
  });

  it("z-levels add 10 per level", () => {
    expect(manhattanDistance({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 2 })).toBe(20);
  });
});
