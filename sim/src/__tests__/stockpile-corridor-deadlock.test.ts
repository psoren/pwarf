import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeSkill, makeItem, makeMapTile } from "./test-helpers.js";
import { SKILL_NAMES } from "@pwarf/shared";
import type { FortressDeriver, StockpileTile } from "@pwarf/shared";

/** Wall-only deriver — only explicit tile overrides are walkable, keeping pathfinding fast. */
const wallDeriver: FortressDeriver = {
  deriveTile: () => ({ tileType: 'constructed_wall' as const, material: 'stone', isMined: false }),
  baseTileType: 'constructed_wall' as any,
  getZForEntrance: () => null,
  getEntranceForZ: () => null,
  getCaveName: () => null,
} as any;

/**
 * Deadlock scenario: dwarves in a narrow corridor can't reach a dead-end stockpile.
 *
 * Layout (z=0):
 *   x: 5   6   7
 * y=0: wall wall wall       <- dead end
 * y=1: wall [SP] wall       <- stockpile
 * y=2: wall  .  wall        <- corridor
 * y=3: wall  .  wall        <- corridor
 * y=4: wall  .  wall        <- corridor
 * y=5: floor floor floor    <- open area
 * y=6: floor floor floor
 */
describe("stockpile corridor deadlock", () => {
  function makeCorridorTiles() {
    return [
      makeMapTile(5, 0, 0, "stone"),
      makeMapTile(6, 0, 0, "stone"),
      makeMapTile(7, 0, 0, "stone"),
      ...[1, 2, 3, 4].flatMap(y => [
        makeMapTile(5, y, 0, "stone"),
        makeMapTile(6, y, 0, "constructed_floor"),
        makeMapTile(7, y, 0, "stone"),
      ]),
      ...[5, 6, 7, 8].flatMap(x => [
        makeMapTile(x, 5, 0, "constructed_floor"),
        makeMapTile(x, 6, 0, "constructed_floor"),
      ]),
    ];
  }

  function makeStockpile(): StockpileTile[] {
    return [{
      id: "sp-deadend",
      civilization_id: "test-civ",
      x: 6, y: 1, z: 0,
      accepts_categories: null,
      priority: 1,
      created_at: new Date().toISOString(),
    }];
  }

  it("dwarves in a narrow corridor can deposit items at a dead-end stockpile", async () => {
    const dwarves = [
      makeDwarf({ name: "A", civilization_id: "test-civ", position_x: 6, position_y: 2, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100 }),
      makeDwarf({ name: "B", civilization_id: "test-civ", position_x: 6, position_y: 3, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100 }),
      makeDwarf({ name: "C", civilization_id: "test-civ", position_x: 6, position_y: 4, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100 }),
    ];

    const items = dwarves.map(d => makeItem({
      name: "Stone block",
      category: "raw_material",
      material: "stone",
      located_in_civ_id: "test-civ",
      held_by_dwarf_id: d.id,
      position_x: d.position_x,
      position_y: d.position_y,
      position_z: d.position_z,
    }));

    const dwarfSkills = dwarves.flatMap(d =>
      SKILL_NAMES.map(skill => makeSkill(d.id, skill, 2))
    );

    const supplies = [];
    for (let i = 0; i < 10; i++) {
      supplies.push(makeItem({ name: "Plump helmet", category: "food", material: "plant", located_in_civ_id: "test-civ", position_x: 8, position_y: 6, position_z: 0 }));
      supplies.push(makeItem({ name: "Dwarven ale", category: "drink", material: "plant", located_in_civ_id: "test-civ", position_x: 8, position_y: 6, position_z: 0 }));
    }

    const result = await runScenario({
      dwarves,
      dwarfSkills,
      items: [...items, ...supplies],
      fortressTileOverrides: makeCorridorTiles(),
      stockpileTiles: makeStockpile(),
      fortressDeriver: wallDeriver,
      ticks: 400,
      seed: 42,
    });

    const stoneBlocks = result.items.filter(i => i.name === "Stone block");
    const deposited = stoneBlocks.filter(i =>
      i.held_by_dwarf_id === null &&
      i.position_x === 6 && i.position_y === 1 && i.position_z === 0
    );
    expect(deposited.length).toBe(3);
  });

  it("dwarf blocked by two idle dwarves can still deposit at stockpile", async () => {
    const blocker1 = makeDwarf({ name: "B1", civilization_id: "test-civ", position_x: 6, position_y: 2, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100 });
    const blocker2 = makeDwarf({ name: "B2", civilization_id: "test-civ", position_x: 6, position_y: 3, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100 });
    const hauler = makeDwarf({ name: "A", civilization_id: "test-civ", position_x: 6, position_y: 4, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100 });

    const item = makeItem({
      name: "Stone block",
      category: "raw_material",
      material: "stone",
      located_in_civ_id: "test-civ",
      held_by_dwarf_id: hauler.id,
      position_x: hauler.position_x,
      position_y: hauler.position_y,
      position_z: hauler.position_z,
    });

    const allDwarves = [blocker1, blocker2, hauler];
    const dwarfSkills = allDwarves.flatMap(d =>
      SKILL_NAMES.map(skill => makeSkill(d.id, skill, 2))
    );

    const supplies = [];
    for (let i = 0; i < 10; i++) {
      supplies.push(makeItem({ name: "Plump helmet", category: "food", material: "plant", located_in_civ_id: "test-civ", position_x: 8, position_y: 6, position_z: 0 }));
      supplies.push(makeItem({ name: "Dwarven ale", category: "drink", material: "plant", located_in_civ_id: "test-civ", position_x: 8, position_y: 6, position_z: 0 }));
    }

    const result = await runScenario({
      dwarves: allDwarves,
      dwarfSkills,
      items: [item, ...supplies],
      fortressTileOverrides: makeCorridorTiles(),
      stockpileTiles: makeStockpile(),
      fortressDeriver: wallDeriver,
      ticks: 100,
      seed: 42,
    });

    const stoneBlock = result.items.find(i => i.name === "Stone block");
    expect(stoneBlock?.held_by_dwarf_id).toBeNull();
    expect(stoneBlock?.position_x).toBe(6);
    expect(stoneBlock?.position_y).toBe(1);
    expect(stoneBlock?.position_z).toBe(0);
  });
});
