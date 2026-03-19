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

  it("grass is walkable", () => {
    expect(isWalkable("grass")).toBe(true);
  });

  it("sand is walkable", () => {
    expect(isWalkable("sand")).toBe(true);
  });

  it("mud is walkable", () => {
    expect(isWalkable("mud")).toBe(true);
  });

  it("ice is walkable", () => {
    expect(isWalkable("ice")).toBe(true);
  });

  it("cave_entrance is walkable", () => {
    expect(isWalkable("cave_entrance")).toBe(true);
  });

  it("tree is walkable (surface feature)", () => {
    expect(isWalkable("tree")).toBe(true);
  });

  it("bush is walkable (surface feature)", () => {
    expect(isWalkable("bush")).toBe(true);
  });

  it("rock is walkable (surface feature)", () => {
    expect(isWalkable("rock")).toBe(true);
  });

  it("ore is not walkable (underground wall)", () => {
    expect(isWalkable("ore")).toBe(false);
  });

  it("gem is not walkable (underground wall)", () => {
    expect(isWalkable("gem")).toBe(false);
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

describe("getNeighbors — cave entrance transitions", () => {
  it("cave_entrance at z=0 connects to walkable tile at z=-1", () => {
    const lookup: TileLookup = (x, y, z) => {
      if (x === 5 && y === 5 && z === 0) return "cave_entrance";
      if (x === 5 && y === 5 && z === -1) return "cavern_floor";
      if (z === 0) return "grass";
      return null;
    };

    const neighbors = getNeighbors({ x: 5, y: 5, z: 0 }, lookup);
    const zMinus1 = neighbors.find((n) => n.z === -1);
    expect(zMinus1).toEqual({ x: 5, y: 5, z: -1 });
  });

  it("cavern_floor at z=-1 connects up through cave_entrance at z=0", () => {
    const lookup: TileLookup = (x, y, z) => {
      if (x === 5 && y === 5 && z === 0) return "cave_entrance";
      if (x === 5 && y === 5 && z === -1) return "cavern_floor";
      if (z === -1) return "cavern_wall";
      return null;
    };

    const neighbors = getNeighbors({ x: 5, y: 5, z: -1 }, lookup);
    const z0 = neighbors.find((n) => n.z === 0);
    expect(z0).toEqual({ x: 5, y: 5, z: 0 });
  });

  it("regular tile at z=-1 without cave_entrance above does not connect up", () => {
    const lookup: TileLookup = (x, y, z) => {
      if (z === 0) return "grass";
      if (z === -1) return "cavern_floor";
      return null;
    };

    const neighbors = getNeighbors({ x: 5, y: 5, z: -1 }, lookup);
    const z0 = neighbors.find((n) => n.z === 0);
    expect(z0).toBeUndefined();
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

  it("finds path through trees (surface features are walkable)", () => {
    const grid: FortressTileType[][] = [
      ["grass", "tree", "tree", "rock", "grass"],
    ];
    const lookup = gridLookup(grid);

    const result = bfsNextStep({ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, lookup);
    expect(result).toEqual({ x: 1, y: 0, z: 0 });
  });

  it("finds path across grass tiles (surface wandering)", () => {
    const grid: FortressTileType[][] = [
      ["grass", "grass", "grass", "grass", "grass"],
    ];
    const lookup = gridLookup(grid);

    const result = bfsNextStep({ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, lookup);
    expect(result).toEqual({ x: 1, y: 0, z: 0 });
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

  it("finds path through cave entrance from surface to cave", () => {
    const lookup: TileLookup = (x, y, z) => {
      // Surface: grass with a cave entrance at (2,0)
      if (z === 0) {
        if (x >= 0 && x <= 4 && y === 0) {
          return x === 2 ? "cave_entrance" : "grass";
        }
        return null;
      }
      // Cave: cavern_floor at z=-1
      if (z === -1) {
        if (x >= 0 && x <= 4 && y === 0) return "cavern_floor";
        return null;
      }
      return null;
    };

    // Start at surface (0,0,0), goal at cave (4,0,-1)
    const result = bfsNextStep(
      { x: 0, y: 0, z: 0 },
      { x: 4, y: 0, z: -1 },
      lookup,
    );
    // First step should move toward the cave entrance at (2,0)
    expect(result).toEqual({ x: 1, y: 0, z: 0 });
  });

  it("returns null instead of crashing when search space is huge", () => {
    // Simulate a large open plane with an unreachable goal (different z)
    const lookup: TileLookup = (x, y, z) => {
      if (z !== 0) return null;
      if (x < 0 || x > 200 || y < 0 || y > 200) return null;
      return "open_air";
    };

    // Goal at z=-1 is unreachable from z=0 (no cave entrance)
    const result = bfsNextStep(
      { x: 100, y: 100, z: 0 },
      { x: 100, y: 100, z: -1 },
      lookup,
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
