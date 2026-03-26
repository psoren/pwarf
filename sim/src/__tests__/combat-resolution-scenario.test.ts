import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeRealisticScenario, makeMonster } from "./test-helpers.js";

/**
 * Combat Resolution scenario tests
 *
 * Tests that:
 * - A weak monster placed near dwarves is slain
 * - monster_slain event fires and fighting XP is awarded
 * - A strong monster can kill a dwarf, producing a death event
 */

describe("combat resolution scenario", () => {
  it("weak monster is slain and monster_slain event fires with XP awarded", async () => {
    const config = makeRealisticScenario({
      dwarfCount: 3,
      foodCount: 20,
      drinkCount: 20,
    });

    // Place a very weak monster on the same tile as first dwarf (256, 256)
    const weakMonster = makeMonster({
      status: "active",
      behavior: "aggressive",
      health: 3,
      threat_level: 5,
      current_tile_x: 256,
      current_tile_y: 256,
      lair_tile_x: 256,
      lair_tile_y: 256,
    });

    config.monsters = [weakMonster];
    config.ticks = 300;

    const result = await runScenario(config);

    // Monster should be slain
    const finalMonster = result.monsters.find(m => m.id === weakMonster.id);
    expect(finalMonster).toBeDefined();
    expect(finalMonster!.status).toBe("slain");

    // monster_slain event should exist
    const slainEvent = result.events.find(e => e.category === "monster_slain");
    expect(slainEvent).toBeDefined();
    expect(slainEvent!.monster_id).toBe(weakMonster.id);

    // The killing dwarf should have fighting XP
    const killerDwarfId = finalMonster!.slain_by_dwarf_id;
    expect(killerDwarfId).toBeTruthy();
    const fightingSkill = result.dwarfSkills.find(
      s => s.dwarf_id === killerDwarfId && s.skill_name === "fighting",
    );
    expect(fightingSkill).toBeDefined();
    expect(fightingSkill!.xp).toBeGreaterThan(0);
  });

  it("strong monster kills a dwarf and death event fires", async () => {
    const config = makeRealisticScenario({
      dwarfCount: 1,
      foodCount: 20,
      drinkCount: 20,
    });

    // Place a powerful monster on the same tile as the dwarf
    const strongMonster = makeMonster({
      status: "active",
      behavior: "aggressive",
      health: 500,
      threat_level: 100,
      current_tile_x: 256,
      current_tile_y: 256,
      lair_tile_x: 256,
      lair_tile_y: 256,
    });

    config.monsters = [strongMonster];
    config.ticks = 300;

    const result = await runScenario(config);

    // The dwarf should be dead from monster attack
    const deadDwarves = result.dwarves.filter(d => d.status === "dead");
    expect(deadDwarves.length).toBeGreaterThanOrEqual(1);

    const killedDwarf = deadDwarves.find(d => d.cause_of_death === "monster attack");
    expect(killedDwarf).toBeDefined();

    // fortress_fallen event should fire since the last dwarf died
    const fallenEvent = result.events.find(e => e.category === "fortress_fallen");
    expect(fallenEvent).toBeDefined();
  });
});
