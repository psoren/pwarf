import { describe, it, expect } from "vitest";
import { findNearestDwarf, stepToward } from "../phases/monster-pathfinding.js";
import { rollDamage } from "../phases/combat-resolution.js";
import { generateMonsterName, monsterSpawning } from "../phases/monster-spawning.js";
import { createRng } from "../rng.js";
import { monsterPathfinding } from "../phases/monster-pathfinding.js";
import { combatResolution } from "../phases/combat-resolution.js";
import { makeDwarf } from "./test-helpers.js";
import { createTestContext } from "../sim-context.js";
import { MONSTER_SPAWN_INTERVAL, MONSTER_PEACE_PERIOD_TICKS, MONSTER_MAX_ACTIVE } from "@pwarf/shared";
import type { Monster } from "@pwarf/shared";

/** A step value past the peace period AND on a spawn interval. */
const SPAWN_TICK = Math.ceil(MONSTER_PEACE_PERIOD_TICKS / MONSTER_SPAWN_INTERVAL) * MONSTER_SPAWN_INTERVAL;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMonster(overrides?: Partial<Monster>): Monster {
  return {
    id: "monster-1",
    world_id: "world-1",
    name: "Graksha",
    epithet: null,
    type: "night_creature",
    status: "active",
    behavior: "aggressive",
    is_named: false,
    lair_tile_x: 0,
    lair_tile_y: 0,
    current_tile_x: 0,
    current_tile_y: 0,
    threat_level: 30,
    health: 50,
    size_category: "medium",
    body_parts: [],
    attacks: [],
    abilities: [],
    weaknesses: [],
    lore: null,
    origin_myth: null,
    properties: {},
    first_seen_year: 1,
    slain_year: null,
    slain_by_dwarf_id: null,
    slain_in_civ_id: null,
    slain_in_ruin_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// findNearestDwarf
// ---------------------------------------------------------------------------

describe("findNearestDwarf", () => {
  it("returns null with no dwarves", () => {
    const monster = makeMonster({ current_tile_x: 5, current_tile_y: 5 });
    expect(findNearestDwarf(monster, [])).toBeNull();
  });

  it("returns null for monster without position", () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5 });
    const monster = makeMonster({ current_tile_x: null, current_tile_y: null });
    expect(findNearestDwarf(monster, [dwarf])).toBeNull();
  });

  it("finds the single dwarf", () => {
    const dwarf = makeDwarf({ position_x: 10, position_y: 10 });
    const monster = makeMonster({ current_tile_x: 0, current_tile_y: 0 });
    const result = findNearestDwarf(monster, [dwarf]);
    expect(result).toBeDefined();
    expect(result?.position_x).toBe(10);
  });

  it("picks the closer of two dwarves", () => {
    const near = makeDwarf({ position_x: 3, position_y: 0 });
    const far = makeDwarf({ position_x: 20, position_y: 0 });
    const monster = makeMonster({ current_tile_x: 0, current_tile_y: 0 });
    const result = findNearestDwarf(monster, [near, far]);
    expect(result?.position_x).toBe(3);
  });

  it("skips dead dwarves", () => {
    const alive = makeDwarf({ position_x: 20, position_y: 0 });
    const dead = makeDwarf({ position_x: 1, position_y: 0, status: "dead" });
    const monster = makeMonster({ current_tile_x: 0, current_tile_y: 0 });
    const result = findNearestDwarf(monster, [alive, dead]);
    expect(result?.position_x).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// stepToward
// ---------------------------------------------------------------------------

describe("stepToward", () => {
  it("moves right when target is to the right", () => {
    expect(stepToward(0, 0, 5, 0)).toEqual({ newX: 1, newY: 0 });
  });

  it("moves left when target is to the left", () => {
    expect(stepToward(5, 0, 0, 0)).toEqual({ newX: 4, newY: 0 });
  });

  it("moves down when target is below", () => {
    expect(stepToward(0, 0, 0, 3)).toEqual({ newX: 0, newY: 1 });
  });

  it("moves up when target is above", () => {
    expect(stepToward(0, 5, 0, 0)).toEqual({ newX: 0, newY: 4 });
  });

  it("prioritizes larger axis gap", () => {
    // dx=3, dy=1 → should move along x
    expect(stepToward(0, 0, 3, 1)).toEqual({ newX: 1, newY: 0 });
    // dx=1, dy=3 → should move along y
    expect(stepToward(0, 0, 1, 3)).toEqual({ newX: 0, newY: 1 });
  });

  it("stays in place when already at target", () => {
    expect(stepToward(5, 5, 5, 5)).toEqual({ newX: 5, newY: 5 });
  });

  it("moves away when fleeing=true", () => {
    // Target at (5,0), fleeing → move left away from target
    expect(stepToward(0, 0, 5, 0, true)).toEqual({ newX: -1, newY: 0 });
  });
});

// ---------------------------------------------------------------------------
// rollDamage
// ---------------------------------------------------------------------------

describe("rollDamage", () => {
  it("always returns at least 1", () => {
    // With seed 0, vary spread — should never produce 0
    const rng = createRng(0);
    for (let i = 0; i < 100; i++) {
      expect(rollDamage(rng, 1, 0)).toBeGreaterThanOrEqual(1);
    }
  });

  it("stays within base ± spread (plus min 1 clamp)", () => {
    const rng = createRng(42);
    const base = 10;
    const spread = 5;
    for (let i = 0; i < 200; i++) {
      const dmg = rollDamage(rng, base, spread);
      expect(dmg).toBeGreaterThanOrEqual(1);
      expect(dmg).toBeLessThanOrEqual(base + spread);
    }
  });
});

// ---------------------------------------------------------------------------
// generateMonsterName
// ---------------------------------------------------------------------------

describe("generateMonsterName", () => {
  it("returns a non-empty capitalized string", () => {
    const rng = createRng(1);
    const name = generateMonsterName(rng);
    expect(name.length).toBeGreaterThan(0);
    expect(name[0]).toBe(name[0]?.toUpperCase());
  });
});

// ---------------------------------------------------------------------------
// monsterSpawning phase
// ---------------------------------------------------------------------------

describe("monsterSpawning", () => {
  it("spawns no monster on non-interval ticks", async () => {
    const ctx = createTestContext();
    ctx.state.dwarves = [makeDwarf()];
    ctx.step = 1; // not a multiple of MONSTER_SPAWN_INTERVAL
    await monsterSpawning(ctx);
    expect(ctx.state.monsters).toHaveLength(0);
  });

  it("spawns a monster on the interval tick when dwarves are present", async () => {
    const ctx = createTestContext();
    ctx.state.dwarves = [makeDwarf({ position_x: 100, position_y: 100 })];
    ctx.step = SPAWN_TICK;
    await monsterSpawning(ctx);
    expect(ctx.state.monsters).toHaveLength(1);
    expect(ctx.state.monsters[0]?.status).toBe("active");
    expect(ctx.state.monsters[0]?.type).toBe("night_creature");
  });

  it("fires a monster_sighting event on spawn", async () => {
    const ctx = createTestContext();
    ctx.state.dwarves = [makeDwarf({ position_x: 100, position_y: 100 })];
    ctx.step = SPAWN_TICK;
    await monsterSpawning(ctx);
    const evt = ctx.state.pendingEvents.find(e => e.category === "monster_sighting");
    expect(evt).toBeDefined();
  });

  it("does not spawn when no dwarves are alive", async () => {
    const ctx = createTestContext();
    ctx.step = SPAWN_TICK;
    await monsterSpawning(ctx);
    expect(ctx.state.monsters).toHaveLength(0);
  });

  it(`does not spawn beyond MONSTER_MAX_ACTIVE (${MONSTER_MAX_ACTIVE})`, async () => {
    const ctx = createTestContext();
    ctx.state.dwarves = [makeDwarf({ position_x: 100, position_y: 100 })];
    // Pre-fill with active monsters
    for (let i = 0; i < MONSTER_MAX_ACTIVE; i++) {
      ctx.state.monsters.push(makeMonster({ id: `existing-${i}` }));
    }
    ctx.step = SPAWN_TICK;
    await monsterSpawning(ctx);
    expect(ctx.state.monsters).toHaveLength(MONSTER_MAX_ACTIVE);
  });
});

// ---------------------------------------------------------------------------
// monsterPathfinding phase
// ---------------------------------------------------------------------------

describe("monsterPathfinding", () => {
  it("does nothing when no active monsters", async () => {
    const ctx = createTestContext();
    ctx.state.dwarves = [makeDwarf({ position_x: 100, position_y: 100 })];
    await monsterPathfinding(ctx);
    // No error — just a no-op
  });

  it("moves aggressive monster toward nearest dwarf", async () => {
    const ctx = createTestContext();
    ctx.state.dwarves = [makeDwarf({ position_x: 5, position_y: 0 })];
    ctx.state.monsters = [makeMonster({ current_tile_x: 0, current_tile_y: 0, behavior: "aggressive" })];
    await monsterPathfinding(ctx);
    expect(ctx.state.monsters[0]?.current_tile_x).toBe(1); // moved right toward dwarf
  });

  it("does not move neutral monsters", async () => {
    const ctx = createTestContext();
    ctx.state.dwarves = [makeDwarf({ position_x: 5, position_y: 0 })];
    ctx.state.monsters = [makeMonster({ current_tile_x: 0, current_tile_y: 0, behavior: "neutral" })];
    await monsterPathfinding(ctx);
    expect(ctx.state.monsters[0]?.current_tile_x).toBe(0); // did not move
  });

  it("does not move slain monsters", async () => {
    const ctx = createTestContext();
    ctx.state.dwarves = [makeDwarf({ position_x: 5, position_y: 0 })];
    ctx.state.monsters = [makeMonster({ current_tile_x: 0, current_tile_y: 0, status: "slain" })];
    await monsterPathfinding(ctx);
    expect(ctx.state.monsters[0]?.current_tile_x).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// combatResolution phase
// ---------------------------------------------------------------------------

describe("combatResolution", () => {
  it("does nothing when no active monsters", async () => {
    const ctx = createTestContext();
    ctx.state.dwarves = [makeDwarf({ position_x: 0, position_y: 0 })];
    await combatResolution(ctx);
    // No damage dealt
    expect(ctx.state.dwarves[0]?.health).toBe(100);
  });

  it("deals damage to dwarf when sharing a tile", async () => {
    const ctx = createTestContext();
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, health: 100 });
    ctx.state.dwarves = [dwarf];
    ctx.state.monsters = [makeMonster({ current_tile_x: 5, current_tile_y: 5, health: 100 })];
    await combatResolution(ctx);
    expect(dwarf.health).toBeLessThan(100);
  });

  it("deals damage to monster when sharing a tile", async () => {
    const ctx = createTestContext();
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, health: 100 });
    ctx.state.dwarves = [dwarf];
    const monster = makeMonster({ current_tile_x: 5, current_tile_y: 5, health: 100 });
    ctx.state.monsters = [monster];
    await combatResolution(ctx);
    expect(monster.health).toBeLessThan(100);
  });

  it("kills dwarf when health reaches 0", async () => {
    const ctx = createTestContext();
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, health: 1 });
    ctx.state.dwarves = [dwarf];
    ctx.state.monsters = [makeMonster({ current_tile_x: 5, current_tile_y: 5, health: 100 })];
    await combatResolution(ctx);
    expect(dwarf.status).toBe("dead");
    expect(dwarf.cause_of_death).toBe("monster attack");
  });

  it("slays monster when health reaches 0 and fires event", async () => {
    const ctx = createTestContext();
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, health: 100 });
    ctx.state.dwarves = [dwarf];
    const monster = makeMonster({ current_tile_x: 5, current_tile_y: 5, health: 1 });
    ctx.state.monsters = [monster];
    await combatResolution(ctx);
    expect(monster.status).toBe("slain");
    expect(monster.slain_by_dwarf_id).toBe(dwarf.id);
    const evt = ctx.state.pendingEvents.find(e => e.category === "monster_slain");
    expect(evt).toBeDefined();
  });

  it("awards fighting XP when monster is slain", async () => {
    const ctx = createTestContext();
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, health: 100 });
    ctx.state.dwarves = [dwarf];
    ctx.state.monsters = [makeMonster({ current_tile_x: 5, current_tile_y: 5, health: 1 })];
    await combatResolution(ctx);
    const skill = ctx.state.dwarfSkills.find(s => s.dwarf_id === dwarf.id && s.skill_name === "fighting");
    expect(skill).toBeDefined();
    expect(skill?.xp).toBeGreaterThan(0);
  });

  it("does not attack when monster is on a different tile", async () => {
    const ctx = createTestContext();
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, health: 100 });
    ctx.state.dwarves = [dwarf];
    ctx.state.monsters = [makeMonster({ current_tile_x: 10, current_tile_y: 10, health: 100 })];
    await combatResolution(ctx);
    expect(dwarf.health).toBe(100);
  });

  it("fires a battle event on first contact", async () => {
    const ctx = createTestContext();
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, health: 100 });
    ctx.state.dwarves = [dwarf];
    ctx.state.monsters = [makeMonster({ current_tile_x: 5, current_tile_y: 5, health: 100 })];
    await combatResolution(ctx);
    const evt = ctx.state.pendingEvents.find(e => e.category === "battle");
    expect(evt).toBeDefined();
    expect(evt?.dwarf_id).toBe(dwarf.id);
    expect(evt?.monster_id).toBe("monster-1");
  });

  it("fires battle event only once per pair across multiple ticks", async () => {
    const ctx = createTestContext();
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, health: 100 });
    ctx.state.dwarves = [dwarf];
    ctx.state.monsters = [makeMonster({ current_tile_x: 5, current_tile_y: 5, health: 100 })];
    await combatResolution(ctx);
    await combatResolution(ctx);
    await combatResolution(ctx);
    const battleEvents = ctx.state.pendingEvents.filter(e => e.category === "battle");
    expect(battleEvents.length).toBe(1);
  });

  it("fires monster_siege on first contact with any dwarf", async () => {
    const ctx = createTestContext();
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, health: 100 });
    ctx.state.dwarves = [dwarf];
    ctx.state.monsters = [makeMonster({ current_tile_x: 5, current_tile_y: 5, health: 100 })];
    await combatResolution(ctx);
    const evt = ctx.state.pendingEvents.find(e => e.category === "monster_siege");
    expect(evt).toBeDefined();
    expect(evt?.monster_id).toBe("monster-1");
  });

  it("fires monster_siege only once even across multiple dwarves", async () => {
    const ctx = createTestContext();
    const dwarf1 = makeDwarf({ id: "d1", position_x: 5, position_y: 5, health: 100 });
    const dwarf2 = makeDwarf({ id: "d2", position_x: 5, position_y: 5, health: 100 });
    ctx.state.dwarves = [dwarf1, dwarf2];
    ctx.state.monsters = [makeMonster({ current_tile_x: 5, current_tile_y: 5, health: 100 })];
    // Pre-seed one combat pair so the monster is already in combat
    ctx.state.activeCombatPairs.add(`monster-1:d1`);
    await combatResolution(ctx);
    const siegeEvents = ctx.state.pendingEvents.filter(e => e.category === "monster_siege");
    expect(siegeEvents.length).toBe(0);
  });

  it("clears combat pair when monster is slain", async () => {
    const ctx = createTestContext();
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, health: 100 });
    ctx.state.dwarves = [dwarf];
    const monster = makeMonster({ id: "m1", current_tile_x: 5, current_tile_y: 5, health: 1 });
    ctx.state.monsters = [monster];
    await combatResolution(ctx);
    expect(monster.status).toBe("slain");
    expect(ctx.state.activeCombatPairs.has(`m1:${dwarf.id}`)).toBe(false);
  });

  it("clears combat pair when dwarf dies", async () => {
    const ctx = createTestContext();
    const dwarf = makeDwarf({ id: "d1", position_x: 5, position_y: 5, health: 1 });
    ctx.state.dwarves = [dwarf];
    const monster = makeMonster({ id: "m1", current_tile_x: 5, current_tile_y: 5, health: 100 });
    ctx.state.monsters = [monster];
    await combatResolution(ctx);
    expect(dwarf.status).toBe("dead");
    expect(ctx.state.activeCombatPairs.has(`m1:d1`)).toBe(false);
  });
});
