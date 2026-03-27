import { describe, it, expect } from 'vitest';
import { runScenario } from '../run-scenario.js';
import { makeDwarf, makeTask, makeSkill, makeItem, makeMapTile } from './test-helpers.js';
import { MAX_TASK_FAILURES, WORK_MINE_BASE } from '@pwarf/shared';

/**
 * Unreachable mine task scenario tests.
 *
 * When a mine task targets a tile that is completely surrounded by
 * non-walkable tiles, dwarves cannot path to it. After MAX_TASK_FAILURES
 * failed attempts, the task should be auto-cancelled instead of looping
 * forever in a fail-pending-reclaim cycle.
 */
describe('unreachable mine task cancellation', () => {
  it('cancels a mine task after MAX_TASK_FAILURES failed pathfinding attempts', async () => {
    // Layout: dwarf at (0,0) on open_air. Target cavern_wall at (5,5)
    // completely surrounded by cavern_wall overrides on all 4 cardinal
    // neighbors, blocking adjacency-based pathfinding.
    //
    // Without a fortress deriver, non-overridden tiles are open_air (walkable).
    // We place cavern_wall at (4,5), (6,5), (5,4), (5,6) to block all
    // adjacent tiles to the target.

    const dwarf = makeDwarf({
      position_x: 0,
      position_y: 0,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const skills = [makeSkill(dwarf.id, 'mining', 5, 100)];

    // Target surrounded by walls — no adjacent walkable tile
    const tiles = [
      makeMapTile(5, 5, 0, 'cavern_wall'),  // target
      makeMapTile(4, 5, 0, 'cavern_wall'),   // left
      makeMapTile(6, 5, 0, 'cavern_wall'),   // right
      makeMapTile(5, 4, 0, 'cavern_wall'),   // up
      makeMapTile(5, 6, 0, 'cavern_wall'),   // down
    ];

    const mineTask = makeTask('mine', {
      status: 'pending',
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: WORK_MINE_BASE,
      priority: 10,
    });

    // Plenty of food/drink to prevent autonomous interruptions
    const food = Array.from({ length: 10 }, () =>
      makeItem({ category: 'food', position_x: 0, position_y: 0, position_z: 0, held_by_dwarf_id: null }),
    );
    const drink = Array.from({ length: 10 }, () =>
      makeItem({ category: 'drink', position_x: 0, position_y: 0, position_z: 0, held_by_dwarf_id: null }),
    );

    // Run enough ticks for the task to be claimed, fail, re-queue, and
    // eventually hit MAX_TASK_FAILURES. Each cycle takes a few ticks
    // (claim + pathfind attempt + fail). 200 ticks is more than enough.
    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: skills,
      tasks: [mineTask],
      items: [...food, ...drink],
      fortressTileOverrides: tiles,
      ticks: 200,
      seed: 42,
    });

    const task = result.tasks.find(t => t.id === mineTask.id);
    expect(task).toBeDefined();
    expect(task!.status).toBe('cancelled');
    // Work progress should be 0 — the dwarf never reached the tile
    expect(task!.work_progress).toBe(0);
  });

  it('does NOT cancel a reachable mine task within MAX_TASK_FAILURES attempts', async () => {
    // Reachable layout: dwarf at (0,0), mine target at (2,0),
    // with cavern_floor at (1,0) providing a walkable path.
    const dwarf = makeDwarf({
      position_x: 0,
      position_y: 0,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const skills = [makeSkill(dwarf.id, 'mining', 5, 100)];

    const tiles = [
      makeMapTile(0, 0, 0, 'cavern_floor'),
      makeMapTile(1, 0, 0, 'cavern_floor'),
      makeMapTile(2, 0, 0, 'rock'),
    ];

    const mineTask = makeTask('mine', {
      status: 'pending',
      target_x: 2,
      target_y: 0,
      target_z: 0,
      work_required: WORK_MINE_BASE,
      priority: 10,
    });

    const food = Array.from({ length: 10 }, () =>
      makeItem({ category: 'food', position_x: 0, position_y: 0, position_z: 0, held_by_dwarf_id: null }),
    );
    const drink = Array.from({ length: 10 }, () =>
      makeItem({ category: 'drink', position_x: 0, position_y: 0, position_z: 0, held_by_dwarf_id: null }),
    );

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: skills,
      tasks: [mineTask],
      items: [...food, ...drink],
      fortressTileOverrides: tiles,
      ticks: 300,
      seed: 42,
    });

    const task = result.tasks.find(t => t.id === mineTask.id);
    expect(task).toBeDefined();
    // Reachable task should complete, not get cancelled
    expect(task!.status).toBe('completed');
  });

  it('MAX_TASK_FAILURES is exactly 3', () => {
    expect(MAX_TASK_FAILURES).toBe(3);
  });
});
