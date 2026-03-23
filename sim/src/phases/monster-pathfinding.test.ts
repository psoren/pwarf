import { describe, it, expect } from "vitest";
import { makeDwarf, makeMonster, makeContext } from "../__tests__/test-helpers.js";
import { monsterPathfinding, findNearestDwarf, stepToward } from "./monster-pathfinding.js";

describe("stepToward", () => {
  it("moves toward target on the X axis when dx > dy", () => {
    const result = stepToward(0, 0, 5, 2);
    expect(result).toEqual({ newX: 1, newY: 0 });
  });

  it("moves toward target on the Y axis when dy > dx", () => {
    const result = stepToward(0, 0, 2, 5);
    expect(result).toEqual({ newX: 0, newY: 1 });
  });

  it("does not move when already at target", () => {
    const result = stepToward(3, 3, 3, 3);
    expect(result).toEqual({ newX: 3, newY: 3 });
  });

  it("moves in negative direction when target is behind", () => {
    const result = stepToward(5, 5, 0, 0);
    expect(result).toEqual({ newX: 4, newY: 5 });
  });

  it("flees away from target when fleeing=true", () => {
    const result = stepToward(3, 3, 5, 3, true);
    expect(result).toEqual({ newX: 2, newY: 3 }); // Moves away on X
  });

  it("handles equal axis differences by preferring X", () => {
    const result = stepToward(0, 0, 3, 3);
    expect(result).toEqual({ newX: 1, newY: 0 }); // abs(dx) >= abs(dy) → moves X
  });
});

describe("findNearestDwarf", () => {
  it("finds the closest alive dwarf by Manhattan distance", () => {
    const monster = { current_tile_x: 10, current_tile_y: 10 };
    const dwarves = [
      { position_x: 15, position_y: 10, status: "alive" as const },
      { position_x: 11, position_y: 10, status: "alive" as const },
    ];

    const nearest = findNearestDwarf(monster, dwarves);
    expect(nearest?.position_x).toBe(11);
  });

  it("ignores dead dwarves", () => {
    const monster = { current_tile_x: 10, current_tile_y: 10 };
    const dwarves = [
      { position_x: 11, position_y: 10, status: "dead" as const },
      { position_x: 20, position_y: 10, status: "alive" as const },
    ];

    const nearest = findNearestDwarf(monster, dwarves);
    expect(nearest?.position_x).toBe(20);
  });

  it("returns null if no alive dwarves", () => {
    const monster = { current_tile_x: 10, current_tile_y: 10 };
    const dwarves = [
      { position_x: 11, position_y: 10, status: "dead" as const },
    ];

    expect(findNearestDwarf(monster, dwarves)).toBeNull();
  });

  it("returns null if monster has null position", () => {
    const monster = { current_tile_x: null, current_tile_y: null };
    const dwarves = [
      { position_x: 11, position_y: 10, status: "alive" as const },
    ];

    expect(findNearestDwarf(monster, dwarves)).toBeNull();
  });
});

describe("monsterPathfinding", () => {
  it("moves aggressive monster toward nearest dwarf", async () => {
    const dwarf = makeDwarf({ position_x: 10, position_y: 10 });
    const monster = makeMonster({
      current_tile_x: 20,
      current_tile_y: 10,
      behavior: "aggressive",
    });

    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.monsters.push(monster);

    await monsterPathfinding(ctx);

    // Should have moved one step toward dwarf (dx=10, dy=0 → moves X)
    expect(monster.current_tile_x).toBe(19);
    expect(monster.current_tile_y).toBe(10);
  });

  it("does not move neutral monsters", async () => {
    const dwarf = makeDwarf({ position_x: 10, position_y: 10 });
    const monster = makeMonster({
      current_tile_x: 20,
      current_tile_y: 10,
      behavior: "neutral",
    });

    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.monsters.push(monster);

    await monsterPathfinding(ctx);

    expect(monster.current_tile_x).toBe(20);
    expect(monster.current_tile_y).toBe(10);
  });

  it("does not move hibernating monsters", async () => {
    const dwarf = makeDwarf({ position_x: 10, position_y: 10 });
    const monster = makeMonster({
      current_tile_x: 20,
      current_tile_y: 10,
      behavior: "hibernating",
    });

    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.monsters.push(monster);

    await monsterPathfinding(ctx);

    expect(monster.current_tile_x).toBe(20);
  });

  it("fleeing monster moves away from nearest dwarf", async () => {
    const dwarf = makeDwarf({ position_x: 10, position_y: 10 });
    const monster = makeMonster({
      current_tile_x: 15,
      current_tile_y: 10,
      behavior: "fleeing",
    });

    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.monsters.push(monster);

    await monsterPathfinding(ctx);

    // Should move AWAY from dwarf
    expect(monster.current_tile_x).toBe(16);
    expect(monster.current_tile_y).toBe(10);
  });

  it("skips non-active monsters", async () => {
    const dwarf = makeDwarf({ position_x: 10, position_y: 10 });
    const monster = makeMonster({
      current_tile_x: 20,
      current_tile_y: 10,
      status: "slain",
    });

    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.monsters.push(monster);

    await monsterPathfinding(ctx);

    expect(monster.current_tile_x).toBe(20);
  });

  it("does nothing when no alive dwarves exist", async () => {
    const dwarf = makeDwarf({ status: "dead", position_x: 10, position_y: 10 });
    const monster = makeMonster({
      current_tile_x: 20,
      current_tile_y: 10,
    });

    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.monsters.push(monster);

    await monsterPathfinding(ctx);

    expect(monster.current_tile_x).toBe(20);
  });

  it("moves toward the closest of multiple dwarves", async () => {
    const farDwarf = makeDwarf({ position_x: 0, position_y: 0 });
    const nearDwarf = makeDwarf({ position_x: 18, position_y: 10 });
    const monster = makeMonster({
      current_tile_x: 20,
      current_tile_y: 10,
    });

    const ctx = makeContext({ dwarves: [farDwarf, nearDwarf] });
    ctx.state.monsters.push(monster);

    await monsterPathfinding(ctx);

    // Should move toward nearDwarf (dx=2) not farDwarf (dx=20)
    expect(monster.current_tile_x).toBe(19);
  });

  it("skips monsters with null position", async () => {
    const dwarf = makeDwarf({ position_x: 10, position_y: 10 });
    const monster = makeMonster({
      current_tile_x: null,
      current_tile_y: null,
    });

    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.monsters.push(monster);

    await monsterPathfinding(ctx);

    expect(monster.current_tile_x).toBeNull();
  });
});
