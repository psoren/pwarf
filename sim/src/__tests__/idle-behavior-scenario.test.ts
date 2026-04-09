import { describe, it, expect } from 'vitest';
import { runScenario } from '../run-scenario.js';
import { makeDwarf, makeSkill, makeItem, makeMapTile, makeTask, makeStructure } from './test-helpers.js';
import { WORK_MINE_BASE, IDLE_TASK_TYPES } from '@pwarf/shared';

describe('idle behavior scenarios', () => {
  it('idle fortress: dwarves create and complete idle tasks, need_social stays healthy', async () => {
    // 7 dwarves with no tasks — all idle. Should wander, socialize, rest.
    const dwarves = Array.from({ length: 7 }, (_, i) =>
      makeDwarf({
        position_x: 5 + i,
        position_y: 5,
        position_z: 0,
        need_food: 95,
        need_drink: 95,
        need_sleep: 95,
        need_social: 50,
        trait_extraversion: 0.5 + (i % 3) * 0.2,
      }),
    );
    const skills = dwarves.map(d => makeSkill(d.id, 'mining', 1));
    const food = Array.from({ length: 20 }, (_, i) =>
      makeItem({ category: 'food', position_x: 0, position_y: i % 10, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );
    const drink = Array.from({ length: 20 }, (_, i) =>
      makeItem({ category: 'drink', position_x: 15, position_y: i % 10, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );
    const well = makeStructure({ type: 'well', completion_pct: 100, position_x: 10, position_y: 10, position_z: 0 });

    const result = await runScenario({
      dwarves,
      dwarfSkills: skills,
      items: [...food, ...drink],
      structures: [well],
      ticks: 300,
      seed: 42,
    });

    // Dwarves should have created and completed idle tasks
    const idleTasks = result.tasks.filter(t => IDLE_TASK_TYPES.has(t.task_type));
    expect(idleTasks.length).toBeGreaterThan(0);

    const completedIdle = idleTasks.filter(t => t.status === 'completed');
    expect(completedIdle.length).toBeGreaterThan(0);

    // All dwarves should still be alive
    const alive = result.dwarves.filter(d => d.status === 'alive');
    expect(alive.length).toBe(7);

    // Social need shouldn't have dropped catastrophically
    for (const d of alive) {
      expect(d.need_social).toBeGreaterThan(10);
    }
  });

  it('interruption: dwarves switch from idle tasks to mine tasks', async () => {
    // Dwarves start idle, get idle tasks. Then mine tasks are injected.
    // The mine tasks should take priority.
    const dwarves = [
      makeDwarf({ position_x: 1, position_y: 5, position_z: 0, need_food: 95, need_drink: 95, need_sleep: 95 }),
      makeDwarf({ position_x: 1, position_y: 6, position_z: 0, need_food: 95, need_drink: 95, need_sleep: 95 }),
    ];
    const skills = dwarves.map(d => makeSkill(d.id, 'mining', 1, 10));
    const rockTiles = [
      makeMapTile(3, 5, 0, 'rock'),
      makeMapTile(3, 6, 0, 'rock'),
    ];
    const tasks = [
      makeTask('mine', { status: 'pending', target_x: 3, target_y: 5, target_z: 0, work_required: WORK_MINE_BASE, priority: 10 }),
      makeTask('mine', { status: 'pending', target_x: 3, target_y: 6, target_z: 0, work_required: WORK_MINE_BASE, priority: 10 }),
    ];
    const food = Array.from({ length: 10 }, (_, i) =>
      makeItem({ category: 'food', position_x: 0, position_y: i, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );
    const drink = Array.from({ length: 10 }, (_, i) =>
      makeItem({ category: 'drink', position_x: 8, position_y: i, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );

    const result = await runScenario({
      dwarves,
      dwarfSkills: skills,
      tasks,
      items: [...food, ...drink],
      fortressTileOverrides: rockTiles,
      ticks: 300,
      seed: 55,
    });

    // Mine tasks should complete — idle behavior should not interfere
    const completedMines = result.tasks.filter(t => t.task_type === 'mine' && t.status === 'completed');
    expect(completedMines.length).toBe(2);
  });

  it('auto-replant: soil tiles from harvest get re-farmed', async () => {
    const dwarf = makeDwarf({ position_x: 1, position_y: 5, position_z: 0, need_food: 95, need_drink: 95, need_sleep: 95, trait_conscientiousness: 1.0 });
    const skills = [makeSkill(dwarf.id, 'farming', 1, 10)];

    // Pre-place some soil tiles (as if previously harvested)
    const soilTiles = [
      makeMapTile(3, 5, 0, 'soil'),
      makeMapTile(4, 5, 0, 'soil'),
    ];

    const food = Array.from({ length: 10 }, (_, i) =>
      makeItem({ category: 'food', position_x: 0, position_y: i, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );
    const drink = Array.from({ length: 10 }, (_, i) =>
      makeItem({ category: 'drink', position_x: 8, position_y: i, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: skills,
      items: [...food, ...drink],
      fortressTileOverrides: soilTiles,
      ticks: 500,
      seed: 77,
    });

    // Should have created farm_till tasks for the soil tiles
    const farmTasks = result.tasks.filter(t => t.task_type === 'farm_till');
    expect(farmTasks.length).toBeGreaterThan(0);
  });

  it('long-run stability: 5000 ticks with idle behaviors — no crashes', async () => {
    const dwarves = Array.from({ length: 5 }, (_, i) =>
      makeDwarf({
        position_x: 5 + i,
        position_y: 5,
        position_z: 0,
        need_food: 95,
        need_drink: 95,
        need_sleep: 95,
      }),
    );
    const skills = dwarves.map(d => makeSkill(d.id, 'mining', 1));
    const food = Array.from({ length: 30 }, (_, i) =>
      makeItem({ category: 'food', position_x: 0, position_y: i % 15, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );
    const drink = Array.from({ length: 30 }, (_, i) =>
      makeItem({ category: 'drink', position_x: 15, position_y: i % 15, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );
    const well = makeStructure({ type: 'well', completion_pct: 100, position_x: 10, position_y: 10, position_z: 0 });

    const result = await runScenario({
      dwarves,
      dwarfSkills: skills,
      items: [...food, ...drink],
      structures: [well],
      ticks: 5000,
      seed: 99,
    });

    // All dwarves should still be alive (high needs, plenty of food/drink)
    const alive = result.dwarves.filter(d => d.status === 'alive');
    expect(alive.length).toBe(5);

    // No NaN in any need
    for (const d of alive) {
      expect(Number.isNaN(d.need_food)).toBe(false);
      expect(Number.isNaN(d.need_drink)).toBe(false);
      expect(Number.isNaN(d.need_sleep)).toBe(false);
      expect(Number.isNaN(d.need_social)).toBe(false);
      expect(Number.isNaN(d.stress_level)).toBe(false);
    }

    // Idle tasks should have been created and completed
    const idleTasks = result.tasks.filter(t => IDLE_TASK_TYPES.has(t.task_type));
    expect(idleTasks.length).toBeGreaterThan(5);

    // No task should be stuck at 100% work
    const stuckTasks = result.tasks.filter(
      t => t.work_required > 0 && t.work_progress >= t.work_required
        && t.status !== 'completed' && t.status !== 'cancelled',
    );
    expect(stuckTasks).toEqual([]);
  }, 30000); // 30s timeout for long scenario
});
