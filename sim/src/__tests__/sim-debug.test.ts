import { describe, it, expect } from 'vitest';
import { runScenario } from '../run-scenario.js';
import { makeDwarf, makeSkill, makeItem, makeMapTile, makeTask } from './test-helpers.js';
import { WORK_MINE_BASE } from '@pwarf/shared';

describe('sim debug mode', () => {
  it('debug=true captures pathfinding and task failure logs', async () => {
    const dwarf = makeDwarf({
      position_x: 1, position_y: 5, position_z: 0,
      need_food: 95, need_drink: 95, need_sleep: 95,
    });
    const skill = makeSkill(dwarf.id, 'mining', 1);

    const tiles = [];
    for (let x = 0; x <= 5; x++) {
      for (let y = 3; y <= 7; y++) {
        tiles.push(makeMapTile(x, y, 0, 'grass'));
      }
    }
    // Unreachable mine target — surrounded by walls
    tiles.push(makeMapTile(20, 20, 0, 'rock'));
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      tiles.push(makeMapTile(20+dx, 20+dy, 0, 'constructed_wall'));
    }

    const mineTask = makeTask('mine', {
      status: 'pending', target_x: 20, target_y: 20, target_z: 0,
      work_required: WORK_MINE_BASE, priority: 10,
    });

    const food = Array.from({ length: 10 }, (_, i) =>
      makeItem({ category: 'food', position_x: 0, position_y: i + 3, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );
    const drink = Array.from({ length: 10 }, (_, i) =>
      makeItem({ category: 'drink', position_x: 5, position_y: i + 3, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [mineTask],
      items: [...food, ...drink],
      fortressTileOverrides: tiles,
      ticks: 200,
      seed: 42,
      debug: true,
    });

    // Debug log should contain pathfinding failure entries
    expect(result.debugLog).toBeDefined();
    expect(result.debugLog!.length).toBeGreaterThan(0);

    const pathLogs = result.debugLog!.filter(e => e.category === 'pathfinding');
    expect(pathLogs.length).toBeGreaterThan(0);
    expect(pathLogs[0].message).toContain('no path');

    const taskLogs = result.debugLog!.filter(e => e.category === 'task');
    expect(taskLogs.length).toBeGreaterThan(0);
    expect(taskLogs.some(e => e.message.includes('failed') || e.message.includes('cancelled'))).toBe(true);
  });

  it('debug=false produces no debug log', async () => {
    const dwarf = makeDwarf({ position_x: 1, position_y: 5, position_z: 0, need_food: 95, need_drink: 95, need_sleep: 95 });
    const food = Array.from({ length: 5 }, (_, i) =>
      makeItem({ category: 'food', position_x: 0, position_y: i, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );
    const drink = Array.from({ length: 5 }, (_, i) =>
      makeItem({ category: 'drink', position_x: 5, position_y: i, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );

    const result = await runScenario({
      dwarves: [dwarf],
      items: [...food, ...drink],
      ticks: 100,
      seed: 55,
    });

    expect(result.debugLog).toBeUndefined();
  });

  it('timing logs are captured every 100 ticks', async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, need_food: 95, need_drink: 95, need_sleep: 95 });
    const food = Array.from({ length: 10 }, (_, i) =>
      makeItem({ category: 'food', position_x: 0, position_y: i, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );
    const drink = Array.from({ length: 10 }, (_, i) =>
      makeItem({ category: 'drink', position_x: 8, position_y: i, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );

    const result = await runScenario({
      dwarves: [dwarf],
      items: [...food, ...drink],
      ticks: 200,
      seed: 77,
      debug: true,
    });

    const timingLogs = result.debugLog!.filter(e => e.category === 'timing');
    // Should have timing entries from tick 0 and tick 100
    expect(timingLogs.length).toBeGreaterThan(0);
    expect(timingLogs.some(e => e.message.includes('tick'))).toBe(true);
  });
});
