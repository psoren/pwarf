import { describe, it, expect } from 'vitest';
import { runScenario } from '../run-scenario.js';
import { makeDwarf, makeSkill, makeItem, makeMapTile } from './test-helpers.js';
import type { StockpileTile } from '@pwarf/shared';

describe('stockpile designation and haul behavior', () => {
  function makeStockpile(x: number, y: number, z: number, opts?: Partial<StockpileTile>): StockpileTile {
    return {
      id: `sp-${x}-${y}-${z}`,
      civilization_id: 'test-civ',
      x, y, z,
      accepts_categories: null,
      priority: 1,
      created_at: new Date().toISOString(),
      ...opts,
    };
  }

  it('items on the ground are hauled to a designated stockpile', async () => {
    const dwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      need_food: 95, need_drink: 95, need_sleep: 95,
    });
    const skill = makeSkill(dwarf.id, 'hauling', 1);

    // Open grass area
    const tiles = [];
    for (let x = 0; x <= 12; x++) {
      for (let y = 0; y <= 12; y++) {
        tiles.push(makeMapTile(x, y, 0, 'grass'));
      }
    }

    // Items on the ground at (2,2)
    const groundItems = [
      makeItem({ name: 'Stone block', category: 'raw_material', material: 'stone', position_x: 2, position_y: 2, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
      makeItem({ name: 'Wood log', category: 'raw_material', material: 'wood', position_x: 2, position_y: 3, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    ];

    // Stockpile at (10,10)
    const stockpiles = [
      makeStockpile(10, 10, 0),
      makeStockpile(10, 11, 0),
      makeStockpile(11, 10, 0),
    ];

    // Food/drink so the dwarf doesn't get distracted
    const food = Array.from({ length: 10 }, (_, i) =>
      makeItem({ category: 'food', position_x: 0, position_y: i, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );
    const drink = Array.from({ length: 10 }, (_, i) =>
      makeItem({ category: 'drink', position_x: 12, position_y: i, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      items: [...groundItems, ...food, ...drink],
      fortressTileOverrides: tiles,
      stockpileTiles: stockpiles,
      ticks: 500,
      seed: 42,
    });

    // Haul tasks should have been created
    const haulTasks = result.tasks.filter(t => t.task_type === 'haul');
    expect(haulTasks.length).toBeGreaterThan(0);

    // At least one haul should complete or one item should have moved
    const completedHauls = haulTasks.filter(t => t.status === 'completed');
    const stoneBlock = result.items.find(i => i.name === 'Stone block');
    const woodLog = result.items.find(i => i.name === 'Wood log');
    const stoneHauled = stoneBlock && (stoneBlock.held_by_dwarf_id !== null || stoneBlock.position_x !== 2 || stoneBlock.position_y !== 2);
    const woodHauled = woodLog && (woodLog.held_by_dwarf_id !== null || woodLog.position_x !== 2 || woodLog.position_y !== 3);

    // Either a completed haul or an item that's been moved
    expect(completedHauls.length > 0 || stoneHauled || woodHauled).toBe(true);
  });

  it('items are hauled to higher-priority stockpile first', async () => {
    const dwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      need_food: 95, need_drink: 95, need_sleep: 95,
    });
    const skill = makeSkill(dwarf.id, 'hauling', 1);

    const tiles = [];
    for (let x = 0; x <= 15; x++) {
      for (let y = 0; y <= 15; y++) {
        tiles.push(makeMapTile(x, y, 0, 'grass'));
      }
    }

    // One item on the ground
    const groundItem = makeItem({
      name: 'Stone block', category: 'raw_material', material: 'stone',
      position_x: 5, position_y: 5, position_z: 0,
      held_by_dwarf_id: null, located_in_civ_id: 'test-civ',
    });

    // Two stockpiles: low priority (closer) and high priority (farther)
    const lowPriority = makeStockpile(6, 5, 0, { priority: 1, id: 'sp-low' });
    const highPriority = makeStockpile(14, 14, 0, { priority: 5, id: 'sp-high' });

    const food = Array.from({ length: 10 }, (_, i) =>
      makeItem({ category: 'food', position_x: 0, position_y: i, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );
    const drink = Array.from({ length: 10 }, (_, i) =>
      makeItem({ category: 'drink', position_x: 15, position_y: i, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      items: [groundItem, ...food, ...drink],
      fortressTileOverrides: tiles,
      stockpileTiles: [lowPriority, highPriority],
      ticks: 400,
      seed: 55,
    });

    // The haul task should target the high-priority stockpile (14,14) over low-priority (6,5)
    const completedHauls = result.tasks.filter(t => t.task_type === 'haul' && t.status === 'completed');
    if (completedHauls.length > 0) {
      // The first completed haul should target the high-priority stockpile
      expect(completedHauls[0].target_x).toBe(14);
      expect(completedHauls[0].target_y).toBe(14);
    } else {
      // If no hauls completed, at least verify the task was created targeting high priority
      const pendingHauls = result.tasks.filter(t => t.task_type === 'haul');
      expect(pendingHauls.length).toBeGreaterThan(0);
      const hiPriTargets = pendingHauls.filter(t => t.target_x === 14 && t.target_y === 14);
      expect(hiPriTargets.length).toBeGreaterThan(0);
    }
  });

  it('multiple dwarves haul items without conflict', async () => {
    const dwarves = [
      makeDwarf({ position_x: 3, position_y: 5, position_z: 0, need_food: 95, need_drink: 95, need_sleep: 95, name: 'Hauler1' }),
      makeDwarf({ position_x: 3, position_y: 6, position_z: 0, need_food: 95, need_drink: 95, need_sleep: 95, name: 'Hauler2' }),
    ];
    const skills = dwarves.map(d => makeSkill(d.id, 'hauling', 1));

    const tiles = [];
    for (let x = 0; x <= 12; x++) {
      for (let y = 0; y <= 12; y++) {
        tiles.push(makeMapTile(x, y, 0, 'grass'));
      }
    }

    // Multiple items scattered
    const items = [
      makeItem({ name: 'Stone block', category: 'raw_material', material: 'stone', position_x: 1, position_y: 1, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
      makeItem({ name: 'Wood log', category: 'raw_material', material: 'wood', position_x: 1, position_y: 2, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
      makeItem({ name: 'Stone block', category: 'raw_material', material: 'stone', position_x: 2, position_y: 1, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    ];

    const stockpiles = [
      makeStockpile(10, 5, 0),
      makeStockpile(10, 6, 0),
      makeStockpile(10, 7, 0),
    ];

    const food = Array.from({ length: 15 }, (_, i) =>
      makeItem({ category: 'food', position_x: 0, position_y: i % 12, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );
    const drink = Array.from({ length: 15 }, (_, i) =>
      makeItem({ category: 'drink', position_x: 12, position_y: i % 12, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );

    const result = await runScenario({
      dwarves,
      dwarfSkills: skills,
      items: [...items, ...food, ...drink],
      fortressTileOverrides: tiles,
      stockpileTiles: stockpiles,
      ticks: 400,
      seed: 77,
    });

    // At least 2 of the 3 items should be hauled to stockpile
    const stockpileKeys = new Set(stockpiles.map(s => `${s.x},${s.y},${s.z}`));
    const hauledItems = result.items.filter(
      i => i.held_by_dwarf_id === null
        && i.position_x !== null && i.position_y !== null && i.position_z !== null
        && stockpileKeys.has(`${i.position_x},${i.position_y},${i.position_z}`)
        && (i.name === 'Stone block' || i.name === 'Wood log'),
    );
    expect(hauledItems.length).toBeGreaterThanOrEqual(2);
  });
});
