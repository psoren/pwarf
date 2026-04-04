import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeItem, makeSkill, makeStructure } from "./test-helpers.js";
import { STOCKPILE_TILE_CAPACITY, SKILL_NAMES, createFortressDeriver } from "@pwarf/shared";
import type { StockpileTile } from "@pwarf/shared";

const fortressDeriver = createFortressDeriver(42n, "test-civ", "plains");

function makeStockpileTile(
  x: number, y: number, z = 0, overrides?: Partial<StockpileTile>,
): StockpileTile {
  return {
    id: `stockpile-${x}-${y}-${z}`,
    civilization_id: "test-civ",
    x, y, z,
    accepts_categories: null,
    priority: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/** Dwarf with high needs to suppress autonomous distractions */
function satDwarf(x: number, y: number, overrides?: Partial<ReturnType<typeof makeDwarf>>) {
  return makeDwarf({
    civilization_id: "test-civ",
    position_x: x, position_y: y, position_z: 0,
    need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80,
    ...overrides,
  });
}

/** Food/drink items placed near dwarves so autonomous eating/drinking resolves fast */
function survivalItems(x: number, y: number, count = 10) {
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push(makeItem({
      name: "Plump helmet", category: "food", material: "plant",
      located_in_civ_id: "test-civ", position_x: x, position_y: y, position_z: 0,
    }));
    items.push(makeItem({
      name: "Dwarven ale", category: "drink", material: "plant",
      located_in_civ_id: "test-civ", position_x: x, position_y: y, position_z: 0,
    }));
  }
  return items;
}

function beds(count: number, x: number, y: number) {
  return Array.from({ length: count }, (_, i) =>
    makeStructure({
      civilization_id: "test-civ", type: "bed", completion_pct: 100,
      position_x: x + i, position_y: y, position_z: 0,
    }),
  );
}

describe("stockpile designation scenarios", () => {
  it("category-filtered stockpiles route items correctly", { timeout: 30_000 }, async () => {
    const dwarf = satDwarf(256, 256);
    const skills = SKILL_NAMES.map(s => makeSkill(dwarf.id, s, 2));

    const rawItem = makeItem({
      name: "Stone block", category: "raw_material", material: "stone",
      located_in_civ_id: "test-civ", position_x: 257, position_y: 256, position_z: 0,
    });
    const foodItem = makeItem({
      name: "Plump helmet", category: "food", material: "plant",
      located_in_civ_id: "test-civ", position_x: 258, position_y: 256, position_z: 0,
    });

    const rawPile = makeStockpileTile(262, 256, 0, {
      id: "raw-pile", accepts_categories: ["raw_material"],
    });
    const foodPile = makeStockpileTile(262, 258, 0, {
      id: "food-pile", accepts_categories: ["food"],
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: skills,
      items: [rawItem, foodItem, ...survivalItems(256, 258)],
      structures: [...beds(1, 260, 260)],
      stockpileTiles: [rawPile, foodPile],
      fortressDeriver,
      ticks: 800,
    });

    const rawHauls = result.tasks.filter(
      t => t.task_type === "haul" && t.target_item_id === rawItem.id && t.status === "completed",
    );
    const foodHauls = result.tasks.filter(
      t => t.task_type === "haul" && t.target_item_id === foodItem.id && t.status === "completed",
    );

    expect(rawHauls.length).toBeGreaterThanOrEqual(1);
    expect(rawHauls[0]!.target_x).toBe(262);
    expect(rawHauls[0]!.target_y).toBe(256);

    expect(foodHauls.length).toBeGreaterThanOrEqual(1);
    expect(foodHauls[0]!.target_x).toBe(262);
    expect(foodHauls[0]!.target_y).toBe(258);
  });

  it("priority-based selection prefers higher-priority stockpile", { timeout: 30_000 }, async () => {
    const dwarf = satDwarf(256, 256);
    const skills = SKILL_NAMES.map(s => makeSkill(dwarf.id, s, 2));

    const item = makeItem({
      name: "Stone block", category: "raw_material", material: "stone",
      located_in_civ_id: "test-civ", position_x: 257, position_y: 256, position_z: 0,
    });

    // Low-priority closer, high-priority farther
    const closePile = makeStockpileTile(260, 256, 0, { id: "close-low", priority: 0 });
    const farPile = makeStockpileTile(270, 256, 0, { id: "far-high", priority: 5 });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: skills,
      items: [item, ...survivalItems(256, 258)],
      structures: [...beds(1, 260, 260)],
      stockpileTiles: [closePile, farPile],
      fortressDeriver,
      ticks: 800,
    });

    const hauls = result.tasks.filter(
      t => t.task_type === "haul" && t.target_item_id === item.id && t.status === "completed",
    );
    expect(hauls.length).toBeGreaterThanOrEqual(1);
    // Should target the high-priority far pile
    expect(hauls[0]!.target_x).toBe(270);
    expect(hauls[0]!.target_y).toBe(256);
  });

  it("capacity overflow: items beyond STOCKPILE_TILE_CAPACITY use overflow tile", { timeout: 60_000 }, async () => {
    const dwarf = satDwarf(256, 256);
    const skills = SKILL_NAMES.map(s => makeSkill(dwarf.id, s, 2));

    // Drop more items than one tile can hold
    const itemCount = STOCKPILE_TILE_CAPACITY + 2;
    const items = Array.from({ length: itemCount }, (_, i) => makeItem({
      name: `Stone block ${i}`, category: "raw_material", material: "stone",
      located_in_civ_id: "test-civ", position_x: 257 + (i % 2), position_y: 256, position_z: 0,
    }));

    // Primary tile + overflow tile
    const mainPile = makeStockpileTile(262, 256, 0, { id: "main-pile" });
    const overflowPile = makeStockpileTile(263, 256, 0, { id: "overflow-pile" });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: skills,
      items: [...items, ...survivalItems(256, 258)],
      structures: [...beds(1, 260, 260)],
      stockpileTiles: [mainPile, overflowPile],
      fortressDeriver,
      ticks: 1500,
    });

    const completedHauls = result.tasks.filter(
      t => t.task_type === "haul" && t.status === "completed"
        && items.some(it => it.id === t.target_item_id),
    );
    expect(completedHauls.length).toBe(itemCount);

    const toMain = completedHauls.filter(t => t.target_x === 262 && t.target_y === 256);
    const toOverflow = completedHauls.filter(t => t.target_x === 263 && t.target_y === 256);

    expect(toMain.length).toBeLessThanOrEqual(STOCKPILE_TILE_CAPACITY);
    expect(toOverflow.length).toBeGreaterThanOrEqual(1);
  });

  it("multi-tile stockpile distributes items across tiles", { timeout: 60_000 }, async () => {
    const dwarves = [satDwarf(256, 256), satDwarf(257, 256)];
    const skills = dwarves.flatMap(d => SKILL_NAMES.map(s => makeSkill(d.id, s, 2)));

    // 6 items to spread across 2x2 = 4 tiles (capacity 3 each = 12 slots)
    const items = Array.from({ length: 6 }, (_, i) => makeItem({
      name: `Stone block ${i}`, category: "raw_material", material: "stone",
      located_in_civ_id: "test-civ", position_x: 254 + (i % 3), position_y: 256, position_z: 0,
    }));

    // 2x2 stockpile area
    const piles = [
      makeStockpileTile(262, 262, 0, { id: "pile-0-0" }),
      makeStockpileTile(263, 262, 0, { id: "pile-1-0" }),
      makeStockpileTile(262, 263, 0, { id: "pile-0-1" }),
      makeStockpileTile(263, 263, 0, { id: "pile-1-1" }),
    ];

    const result = await runScenario({
      dwarves,
      dwarfSkills: skills,
      items: [...items, ...survivalItems(256, 258)],
      structures: [...beds(2, 260, 260)],
      stockpileTiles: piles,
      fortressDeriver,
      ticks: 1500,
    });

    const completedHauls = result.tasks.filter(
      t => t.task_type === "haul" && t.status === "completed"
        && items.some(it => it.id === t.target_item_id),
    );
    expect(completedHauls.length).toBe(6);

    // No single tile should exceed STOCKPILE_TILE_CAPACITY
    for (const pile of piles) {
      const toThisTile = completedHauls.filter(
        t => t.target_x === pile.x && t.target_y === pile.y,
      );
      expect(toThisTile.length).toBeLessThanOrEqual(STOCKPILE_TILE_CAPACITY);
    }

    // Items should use at least 2 different tiles
    const usedTiles = new Set(completedHauls.map(t => `${t.target_x},${t.target_y}`));
    expect(usedTiles.size).toBeGreaterThanOrEqual(2);
  });

  it("full lifecycle: 3 dwarves, mixed categories, 2 stockpile zones", { timeout: 60_000 }, async () => {
    const dwarves = [satDwarf(256, 256), satDwarf(257, 256), satDwarf(258, 256)];
    const skills = dwarves.flatMap(d => SKILL_NAMES.map(s => makeSkill(d.id, s, 2)));

    // 3 raw_material + 3 food items to haul
    const rawItems = Array.from({ length: 3 }, (_, i) => makeItem({
      name: `Stone block ${i}`, category: "raw_material", material: "stone",
      located_in_civ_id: "test-civ", position_x: 254 + i, position_y: 254, position_z: 0,
    }));
    const foodItems = Array.from({ length: 3 }, (_, i) => makeItem({
      name: `Plump helmet ${i}`, category: "food", material: "plant",
      located_in_civ_id: "test-civ", position_x: 254 + i, position_y: 255, position_z: 0,
    }));

    // Raw stockpile zone (2 tiles)
    const rawPiles = [
      makeStockpileTile(262, 256, 0, { id: "raw-0", accepts_categories: ["raw_material"] }),
      makeStockpileTile(263, 256, 0, { id: "raw-1", accepts_categories: ["raw_material"] }),
    ];
    // Food stockpile zone (2 tiles)
    const foodPiles = [
      makeStockpileTile(262, 258, 0, { id: "food-0", accepts_categories: ["food"] }),
      makeStockpileTile(263, 258, 0, { id: "food-1", accepts_categories: ["food"] }),
    ];

    const result = await runScenario({
      dwarves,
      dwarfSkills: skills,
      items: [...rawItems, ...foodItems, ...survivalItems(256, 258)],
      structures: [
        ...beds(3, 260, 260),
        makeStructure({
          civilization_id: "test-civ", type: "well", completion_pct: 100,
          position_x: 260, position_y: 258, position_z: 0,
        }),
      ],
      stockpileTiles: [...rawPiles, ...foodPiles],
      fortressDeriver,
      ticks: 1500,
    });

    const allHaulItems = [...rawItems, ...foodItems];
    const completedHauls = result.tasks.filter(
      t => t.task_type === "haul" && t.status === "completed"
        && allHaulItems.some(it => it.id === t.target_item_id),
    );
    expect(completedHauls.length).toBe(6);

    // Raw items went to raw zone (y=256)
    const rawHauls = completedHauls.filter(
      t => rawItems.some(it => it.id === t.target_item_id),
    );
    for (const h of rawHauls) {
      expect(h.target_y).toBe(256);
    }

    // Food items went to food zone (y=258)
    const foodHauls = completedHauls.filter(
      t => foodItems.some(it => it.id === t.target_item_id),
    );
    for (const h of foodHauls) {
      expect(h.target_y).toBe(258);
    }

    // Stuck detection: no alive dwarf should be idle with pending haul tasks
    const pendingHauls = result.tasks.filter(
      t => t.task_type === "haul" && t.status === "pending"
        && allHaulItems.some(it => it.id === t.target_item_id),
    );
    const aliveDwarves = result.dwarves.filter(d => d.status === "alive");
    if (pendingHauls.length > 0) {
      const idleDwarves = aliveDwarves.filter(d => d.current_task_id === null);
      expect(idleDwarves.length).toBe(0);
    }
  });
});
