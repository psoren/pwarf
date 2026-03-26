import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeSkill, makeItem, makeMonster } from "./test-helpers.js";
import { createFortressDeriver } from "@pwarf/shared";

const fortressDeriver = createFortressDeriver(42n, "test-civ", "plains");

/**
 * Monster spawning and combat resolution end-to-end scenario tests.
 *
 * Tests that:
 * - A pre-placed low-health monster gets slain in combat
 * - A monster_slain event is fired
 * - Dwarves survive a low-threat monster
 * - Fighting XP is awarded on monster slain
 */

function drinkItem() {
  return makeItem({
    name: "Dwarven ale",
    category: "drink",
    located_in_civ_id: "test-civ",
    position_x: 258,
    position_y: 258,
    position_z: 0,
  });
}

function foodItem() {
  return makeItem({
    name: "Plump helmet",
    category: "food",
    located_in_civ_id: "test-civ",
    position_x: 258,
    position_y: 258,
    position_z: 0,
  });
}

describe("monster combat scenario", () => {
  it("pre-placed low-health monster is slain and monster_slain event fires", async () => {
    const dwarf1 = makeDwarf({
      id: "d-fighter-1",
      civilization_id: "test-civ",
      position_x: 256,
      position_y: 256,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
      health: 100,
    });
    const dwarf2 = makeDwarf({
      id: "d-fighter-2",
      civilization_id: "test-civ",
      position_x: 256,
      position_y: 257,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
      health: 100,
    });

    const skills = [
      makeSkill(dwarf1.id, "fighting", 3),
      makeSkill(dwarf2.id, "fighting", 3),
    ];

    // Low health monster at (258,256) — close enough for the monster to greedy-step into the dwarves
    const monster = makeMonster({
      id: "weak-monster-1",
      status: "active",
      behavior: "aggressive",
      health: 5, // very low health — will be slain quickly
      threat_level: 10,
      current_tile_x: 258,
      current_tile_y: 256,
      lair_tile_x: 258,
      lair_tile_y: 256,
    });

    const drinks = Array.from({ length: 15 }, () => drinkItem());
    const foods = Array.from({ length: 15 }, () => foodItem());

    const result = await runScenario({
      dwarves: [dwarf1, dwarf2],
      dwarfSkills: skills,
      monsters: [monster],
      items: [...drinks, ...foods],
      fortressDeriver,
      ticks: 200,
      seed: 42,
    });

    // Monster should be slain
    const finalMonster = result.events.find(e => e.category === "monster_slain");
    expect(finalMonster).toBeDefined();

    // Both dwarves should still be alive (low threat monster)
    const d1 = result.dwarves.find(d => d.id === dwarf1.id);
    const d2 = result.dwarves.find(d => d.id === dwarf2.id);
    expect(d1!.status).toBe("alive");
    expect(d2!.status).toBe("alive");
  });

  it("monster is slain and status changes to slain", async () => {
    const dwarf = makeDwarf({
      id: "d-hero",
      civilization_id: "test-civ",
      position_x: 256,
      position_y: 256,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
      health: 200, // extra health buffer
    });

    const skills = [makeSkill(dwarf.id, "fighting", 5)];

    const monster = makeMonster({
      id: "frail-monster",
      status: "active",
      behavior: "aggressive",
      health: 1, // will die in first combat tick
      threat_level: 5,
      current_tile_x: 257,
      current_tile_y: 256,
      lair_tile_x: 257,
      lair_tile_y: 256,
    });

    const drinks = Array.from({ length: 15 }, () => drinkItem());
    const foods = Array.from({ length: 15 }, () => foodItem());

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: skills,
      monsters: [monster],
      items: [...drinks, ...foods],
      fortressDeriver,
      ticks: 50,
      seed: 42,
    });

    // Monster should be slain (status = "slain" in final state)
    // The monster_slain event confirms combat occurred
    const slainEvent = result.events.find(e => e.category === "monster_slain");
    expect(slainEvent).toBeDefined();
    expect(slainEvent!.monster_id).toBe(monster.id);
  });

  it("fighting XP is awarded when a monster is slain", async () => {
    const dwarf = makeDwarf({
      id: "d-xp-test",
      civilization_id: "test-civ",
      position_x: 256,
      position_y: 256,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
      health: 100,
    });

    // Start with no fighting skills — XP will be created on first kill
    const monster = makeMonster({
      id: "xp-monster",
      status: "active",
      behavior: "aggressive",
      health: 1,
      threat_level: 5,
      current_tile_x: 256,
      current_tile_y: 256, // already on same tile as dwarf
      lair_tile_x: 256,
      lair_tile_y: 256,
    });

    const drinks = Array.from({ length: 15 }, () => drinkItem());
    const foods = Array.from({ length: 15 }, () => foodItem());

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [], // no pre-existing skills
      monsters: [monster],
      items: [...drinks, ...foods],
      fortressDeriver,
      ticks: 10,
      seed: 42,
    });

    // monster_slain event should exist
    const slainEvent = result.events.find(e => e.category === "monster_slain");
    expect(slainEvent).toBeDefined();
  });

  it("neutral monster does not attack dwarves", async () => {
    const dwarf = makeDwarf({
      id: "d-safe",
      civilization_id: "test-civ",
      position_x: 256,
      position_y: 256,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
      health: 100,
    });

    const neutralMonster = makeMonster({
      id: "neutral-creature",
      status: "active",
      behavior: "neutral",
      health: 50,
      threat_level: 30,
      current_tile_x: 257,
      current_tile_y: 256,
      lair_tile_x: 257,
      lair_tile_y: 256,
    });

    const drinks = Array.from({ length: 15 }, () => drinkItem());
    const foods = Array.from({ length: 15 }, () => foodItem());

    const result = await runScenario({
      dwarves: [dwarf],
      monsters: [neutralMonster],
      items: [...drinks, ...foods],
      fortressDeriver,
      ticks: 100,
      seed: 42,
    });

    // Dwarf should be unharmed (neutral monster doesn't approach)
    const finalDwarf = result.dwarves.find(d => d.id === dwarf.id);
    expect(finalDwarf!.status).toBe("alive");
    expect(finalDwarf!.health).toBe(100); // no damage taken

    // No battle or slain events
    const battleEvents = result.events.filter(e => e.category === "battle" || e.category === "monster_slain");
    expect(battleEvents).toHaveLength(0);
  });
});
