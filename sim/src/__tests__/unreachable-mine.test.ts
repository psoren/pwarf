import { describe, it, expect } from 'vitest';
import { runScenario } from '../run-scenario.js';
import { makeDwarf, makeSkill, makeTask, makeItem, makeMapTile } from './test-helpers.js';
import { WORK_MINE_BASE } from '@pwarf/shared';

describe('unreachable mine task cancellation', () => {
  it('mine task targeting unreachable tile gets cancelled after repeated failures', async () => {
    // Dwarf at (1,5), surrounded by grass. Mine task at (10,10) which is
    // surrounded by cavern_wall with no adjacent walkable tiles — unreachable.
    const dwarf = makeDwarf({
      position_x: 1,
      position_y: 5,
      position_z: 0,
      need_food: 95,
      need_drink: 95,
      need_sleep: 95,
    });
    const skill = makeSkill(dwarf.id, 'mining', 1, 10);

    // Make a small walkable area for the dwarf
    const tiles = [];
    for (let x = 0; x <= 5; x++) {
      for (let y = 3; y <= 7; y++) {
        tiles.push(makeMapTile(x, y, 0, 'grass'));
      }
    }

    // Put a rock tile surrounded by walls at (20,20) — reachable by looking at it
    // but no walkable adjacent tile to stand on. This makes it unreachable for mining
    // (mine requires adjacent position).
    tiles.push(makeMapTile(20, 20, 0, 'rock'));
    // Surround it with walls (not walkable)
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      tiles.push(makeMapTile(20+dx, 20+dy, 0, 'constructed_wall'));
    }

    const mineTask = makeTask('mine', {
      status: 'pending',
      target_x: 20,
      target_y: 20,
      target_z: 0,
      work_required: WORK_MINE_BASE,
      priority: 10,
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
      ticks: 300,
      seed: 42,
    });

    // The unreachable mine task should eventually be cancelled (not stuck pending forever)
    const mine = result.tasks.find(t => t.task_type === 'mine');
    expect(mine).toBeDefined();
    expect(mine!.status).toBe('cancelled');
  });

  it('reachable mine task is NOT cancelled', async () => {
    // Verify normal mine tasks still complete successfully
    const dwarf = makeDwarf({
      position_x: 1,
      position_y: 5,
      position_z: 0,
      need_food: 95,
      need_drink: 95,
      need_sleep: 95,
    });
    const skill = makeSkill(dwarf.id, 'mining', 1, 10);

    const tiles = [];
    for (let x = 0; x <= 5; x++) {
      for (let y = 3; y <= 7; y++) {
        tiles.push(makeMapTile(x, y, 0, 'grass'));
      }
    }
    tiles.push(makeMapTile(3, 5, 0, 'rock'));

    const mineTask = makeTask('mine', {
      status: 'pending',
      target_x: 3,
      target_y: 5,
      target_z: 0,
      work_required: WORK_MINE_BASE,
      priority: 10,
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
      ticks: 300,
      seed: 55,
    });

    const mine = result.tasks.find(t => t.task_type === 'mine');
    expect(mine).toBeDefined();
    expect(mine!.status).toBe('completed');
  });
});
