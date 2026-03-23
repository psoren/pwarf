import { describe, it, expect } from "vitest";
import {
  MONSTER_SPAWN_INTERVAL,
  MONSTER_MAX_ACTIVE,
  MONSTER_NIGHT_CREATURE_HEALTH,
  MONSTER_NIGHT_CREATURE_THREAT,
} from "@pwarf/shared";
import { makeDwarf, makeMonster, makeContext } from "../__tests__/test-helpers.js";
import { monsterSpawning, generateMonsterName } from "./monster-spawning.js";

describe("generateMonsterName", () => {
  it("returns a capitalized two-syllable name", () => {
    const rng = { int: (min: number, max: number) => min };
    const name = generateMonsterName(rng);
    expect(name.length).toBeGreaterThan(2);
    expect(name[0]).toBe(name[0].toUpperCase());
  });

  it("produces different names with different RNG values", () => {
    const rng1 = { int: () => 0 };
    const rng2 = { int: () => 3 };
    expect(generateMonsterName(rng1)).not.toBe(generateMonsterName(rng2));
  });
});

describe("monsterSpawning", () => {
  it("does not spawn on non-interval ticks", async () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = 1; // Not a multiple of MONSTER_SPAWN_INTERVAL

    await monsterSpawning(ctx);

    expect(ctx.state.monsters.length).toBe(0);
  });

  it("spawns a monster on interval ticks when dwarves are alive", async () => {
    const dwarf = makeDwarf({ position_x: 50, position_y: 50 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = MONSTER_SPAWN_INTERVAL;

    await monsterSpawning(ctx);

    expect(ctx.state.monsters.length).toBe(1);
    const monster = ctx.state.monsters[0];
    expect(monster.type).toBe("night_creature");
    expect(monster.status).toBe("active");
    expect(monster.health).toBe(MONSTER_NIGHT_CREATURE_HEALTH);
    expect(monster.threat_level).toBe(MONSTER_NIGHT_CREATURE_THREAT);
  });

  it("does not spawn when no dwarves are alive", async () => {
    const dwarf = makeDwarf({ status: "dead" });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = MONSTER_SPAWN_INTERVAL;

    await monsterSpawning(ctx);

    expect(ctx.state.monsters.length).toBe(0);
  });

  it("does not spawn when at max active monster count", async () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = MONSTER_SPAWN_INTERVAL;

    // Fill up to max
    for (let i = 0; i < MONSTER_MAX_ACTIVE; i++) {
      ctx.state.monsters.push(makeMonster());
    }

    const countBefore = ctx.state.monsters.length;
    await monsterSpawning(ctx);

    expect(ctx.state.monsters.length).toBe(countBefore);
  });

  it("spawns near the centroid of alive dwarves", async () => {
    const d1 = makeDwarf({ position_x: 40, position_y: 40 });
    const d2 = makeDwarf({ position_x: 60, position_y: 60 });
    const ctx = makeContext({ dwarves: [d1, d2] });
    ctx.step = MONSTER_SPAWN_INTERVAL;

    await monsterSpawning(ctx);

    const monster = ctx.state.monsters[0];
    // Centroid is (50, 50), spawn radius is 20
    // Monster should be within radius of centroid
    const dx = Math.abs(monster.current_tile_x! - 50);
    const dy = Math.abs(monster.current_tile_y! - 50);
    expect(dx).toBeLessThanOrEqual(21); // Rounding tolerance
    expect(dy).toBeLessThanOrEqual(21);
  });

  it("emits a monster_sighting event on spawn", async () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = MONSTER_SPAWN_INTERVAL;

    await monsterSpawning(ctx);

    expect(ctx.state.pendingEvents.length).toBe(1);
    expect(ctx.state.pendingEvents[0].category).toBe("monster_sighting");
    expect(ctx.state.pendingEvents[0].monster_id).toBe(ctx.state.monsters[0].id);
  });

  it("ignores dead monsters when counting active monsters", async () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.step = MONSTER_SPAWN_INTERVAL;

    // Add a dead monster — should not count toward the cap
    ctx.state.monsters.push(makeMonster({ status: "slain" }));

    await monsterSpawning(ctx);

    // Should still spawn (dead monster doesn't count)
    const activeCount = ctx.state.monsters.filter(m => m.status === "active").length;
    expect(activeCount).toBe(1);
  });
});
