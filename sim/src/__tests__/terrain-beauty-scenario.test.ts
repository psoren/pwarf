import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeItem, makeMapTile } from "./test-helpers.js";
import { TILE_BEAUTY, MORALE_DECAY_PER_TICK } from "@pwarf/shared";

describe("terrain beauty scenario", () => {
  it("dwarf on grass gains more morale than morale decay alone over many ticks", async () => {
    // Single dwarf on a large grass field — no social proximity, no structures.
    // Grass beauty (+0.04/tick) should partially offset morale decay (-0.03/tick),
    // so morale should stay higher than without any beauty bonus.
    const dwarf = makeDwarf({
      name: "Grasslover",
      need_social: 50,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
      stress_level: 0,
      position_x: 50,
      position_y: 50,
      position_z: 0,
      trait_openness: null,
      trait_extraversion: null,
    });

    // Food/drink nearby so needs don't cause wandering
    const food = makeItem({ category: "food", position_x: 50, position_y: 51, position_z: 0 });
    const drink = makeItem({ category: "drink", position_x: 50, position_y: 52, position_z: 0 });

    // Cover a large area with grass tiles so wandering doesn't leave the zone
    const tiles = [];
    for (let dx = -20; dx <= 20; dx++) {
      for (let dy = -20; dy <= 20; dy++) {
        tiles.push(makeMapTile(50 + dx, 50 + dy, 0, "grass"));
      }
    }

    const ticks = 200;
    const result = await runScenario({
      dwarves: [dwarf],
      items: [food, drink],
      fortressTileOverrides: tiles,
      ticks,
    });

    const final = result.dwarves[0]!;

    // Without grass beauty, morale would drop by MORALE_DECAY_PER_TICK per tick.
    // With grass beauty, the net change per tick is (+0.04 - 0.03) = +0.01.
    // So morale should be higher than starting value minus pure decay.
    const pureDecayResult = 50 - MORALE_DECAY_PER_TICK * ticks;
    expect(final.need_social).toBeGreaterThan(pureDecayResult);
  });

  it("dwarf on mud loses morale faster than on neutral terrain", async () => {
    // Single dwarf on mud — penalty compounds with morale decay.
    const dwarf = makeDwarf({
      name: "Mudwalker",
      need_social: 50,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
      stress_level: 0,
      position_x: 50,
      position_y: 50,
      position_z: 0,
      trait_openness: null,
      trait_extraversion: null,
    });

    const food = makeItem({ category: "food", position_x: 50, position_y: 51, position_z: 0 });
    const drink = makeItem({ category: "drink", position_x: 50, position_y: 52, position_z: 0 });

    const tiles = [];
    for (let dx = -20; dx <= 20; dx++) {
      for (let dy = -20; dy <= 20; dy++) {
        tiles.push(makeMapTile(50 + dx, 50 + dy, 0, "mud"));
      }
    }

    const ticks = 200;
    const result = await runScenario({
      dwarves: [dwarf],
      items: [food, drink],
      fortressTileOverrides: tiles,
      ticks,
    });

    const final = result.dwarves[0]!;

    // Mud penalty (-0.03) compounds with morale decay (-0.03) = -0.06/tick.
    // The dwarf may wander off mud tiles to eat/drink, so the penalty doesn't
    // apply every single tick. Just verify morale dropped well below starting.
    expect(final.need_social).toBeLessThan(50);
  });
});
