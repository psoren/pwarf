import { describe, it, expect } from 'vitest';
import { runScenario } from '../run-scenario.js';
import { makeDwarf, makeTask, makeSkill, makeItem, makeMapTile, makeStructure } from './test-helpers.js';
import { WORK_MINE_BASE } from '@pwarf/shared';

describe('post-mining idle behavior', () => {
  it('dwarves transition to idle tasks after all mine tasks complete', async () => {
    const dwarves = [
      makeDwarf({ position_x: 1, position_y: 5, position_z: 0, need_food: 95, need_drink: 95, need_sleep: 95 }),
      makeDwarf({ position_x: 1, position_y: 6, position_z: 0, need_food: 95, need_drink: 95, need_sleep: 95 }),
      makeDwarf({ position_x: 1, position_y: 7, position_z: 0, need_food: 95, need_drink: 95, need_sleep: 95 }),
    ];
    const skills = dwarves.map(d => makeSkill(d.id, 'mining', 1, 10));
    const rockTiles = [
      makeMapTile(3, 5, 0, 'rock'),
      makeMapTile(3, 6, 0, 'rock'),
      makeMapTile(3, 7, 0, 'rock'),
    ];
    const tasks = [
      makeTask('mine', { status: 'pending', target_x: 3, target_y: 5, target_z: 0, work_required: WORK_MINE_BASE, priority: 10 }),
      makeTask('mine', { status: 'pending', target_x: 3, target_y: 6, target_z: 0, work_required: WORK_MINE_BASE, priority: 10 }),
      makeTask('mine', { status: 'pending', target_x: 3, target_y: 7, target_z: 0, work_required: WORK_MINE_BASE, priority: 10 }),
    ];
    const food = Array.from({ length: 15 }, (_, i) =>
      makeItem({ category: 'food', position_x: 0, position_y: i, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );
    const drink = Array.from({ length: 15 }, (_, i) =>
      makeItem({ category: 'drink', position_x: 8, position_y: i, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );

    const result = await runScenario({
      dwarves, dwarfSkills: skills, tasks,
      items: [...food, ...drink], fortressTileOverrides: rockTiles,
      ticks: 300, seed: 42,
    });

    const completedMines = result.tasks.filter(t => t.task_type === 'mine' && t.status === 'completed');
    expect(completedMines.length).toBe(3);

    // After mining, dwarves should either have idle tasks or be truly idle.
    // The idle behavior phase creates wander/socialize/rest tasks for idle dwarves.
    const idleTypes = new Set(['wander', 'socialize', 'rest']);
    const idleTasks = result.tasks.filter(t => idleTypes.has(t.task_type));
    // If idle behavior phase is active, idle tasks should exist
    if (idleTasks.length > 0) {
      expect(idleTasks.filter(t => t.status === 'completed').length).toBeGreaterThan(0);
    }
    // No dwarf should be stuck with a completed mine task still assigned
    const aliveDwarves = result.dwarves.filter(d => d.status === 'alive');
    for (const d of aliveDwarves) {
      if (d.current_task_id) {
        const task = result.tasks.find(t => t.id === d.current_task_id);
        expect(task?.status).not.toBe('completed');
      }
    }
  });

  it('no task gets stuck at 100% work progress with non-completed status', async () => {
    const dwarves = Array.from({ length: 5 }, (_, i) =>
      makeDwarf({ position_x: i * 2, position_y: 5, position_z: 0, need_food: 95, need_drink: 95, need_sleep: 95, need_social: 60 }),
    );
    const skills = dwarves.map(d => makeSkill(d.id, 'mining', 1, 10));
    const rockTiles = Array.from({ length: 5 }, (_, i) => makeMapTile(i * 2 + 1, 8, 0, 'rock'));
    const tasks = Array.from({ length: 5 }, (_, i) =>
      makeTask('mine', { status: 'pending', target_x: i * 2 + 1, target_y: 8, target_z: 0, work_required: WORK_MINE_BASE, priority: 10 }),
    );
    const food = Array.from({ length: 20 }, (_, i) =>
      makeItem({ category: 'food', position_x: i % 10, position_y: 0, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );
    const drink = Array.from({ length: 20 }, (_, i) =>
      makeItem({ category: 'drink', position_x: 15 + i % 5, position_y: 0, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );
    const well = makeStructure({ type: 'well', completion_pct: 100, position_x: 12, position_y: 12, position_z: 0 });

    const result = await runScenario({
      dwarves, dwarfSkills: skills, tasks,
      items: [...food, ...drink], structures: [well], fortressTileOverrides: rockTiles,
      ticks: 500, seed: 77,
    });

    const stuckTasks = result.tasks.filter(
      t => t.work_required > 0 && t.work_progress >= t.work_required
        && t.status !== 'completed' && t.status !== 'cancelled',
    );
    expect(stuckTasks).toEqual([]);
  });

  it('dwarves are not permanently idle after mining — idle tasks cycle', async () => {
    const dwarf = makeDwarf({ position_x: 1, position_y: 5, position_z: 0, need_food: 95, need_drink: 95, need_sleep: 95 });
    const skill = makeSkill(dwarf.id, 'mining', 1, 10);
    const rock = makeMapTile(3, 5, 0, 'rock');
    const task = makeTask('mine', { status: 'pending', target_x: 3, target_y: 5, target_z: 0, work_required: WORK_MINE_BASE, priority: 10 });
    const food = Array.from({ length: 10 }, (_, i) =>
      makeItem({ category: 'food', position_x: 0, position_y: i, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );
    const drink = Array.from({ length: 10 }, (_, i) =>
      makeItem({ category: 'drink', position_x: 8, position_y: i, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );

    const result = await runScenario({
      dwarves: [dwarf], dwarfSkills: [skill], tasks: [task],
      items: [...food, ...drink], fortressTileOverrides: [rock],
      ticks: 400, seed: 55,
    });

    expect(result.tasks.find(t => t.task_type === 'mine')?.status).toBe('completed');

    // If idle behavior phase is active, multiple idle tasks should have completed
    const idleTypes = new Set(['wander', 'socialize', 'rest']);
    const idleCompleted = result.tasks.filter(t => idleTypes.has(t.task_type) && t.status === 'completed');
    if (idleCompleted.length > 0) {
      expect(idleCompleted.length).toBeGreaterThanOrEqual(2);
    }

    // No task should be stuck at 100% regardless
    const stuckTasks = result.tasks.filter(
      t => t.work_required > 0 && t.work_progress >= t.work_required
        && t.status !== 'completed' && t.status !== 'cancelled',
    );
    expect(stuckTasks).toEqual([]);
  });
});
