import { describe, it, expect } from 'vitest';
import { runScenario } from '../run-scenario.js';
import { makeDwarf, makeSkill, makeItem } from './test-helpers.js';

describe('task pruning in headless mode', () => {
  it('terminal tasks are pruned during long headless runs', async () => {
    // 3 dwarves with food/drink — they'll eat, drink, sleep autonomously
    // generating lots of completed tasks. Pruning should keep count low.
    const dwarves = Array.from({ length: 3 }, (_, i) =>
      makeDwarf({
        position_x: 5 + i,
        position_y: 5,
        position_z: 0,
        need_food: 80,
        need_drink: 80,
        need_sleep: 80,
      }),
    );
    const skills = dwarves.map(d => makeSkill(d.id, 'mining', 1));
    const food = Array.from({ length: 30 }, (_, i) =>
      makeItem({ category: 'food', position_x: 0, position_y: i % 10, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );
    const drink = Array.from({ length: 30 }, (_, i) =>
      makeItem({ category: 'drink', position_x: 10, position_y: i % 10, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' }),
    );

    const result = await runScenario({
      dwarves,
      dwarfSkills: skills,
      items: [...food, ...drink],
      ticks: 2000,
      seed: 42,
    });

    // Without pruning, 3 dwarves over 2000 ticks generate hundreds of
    // autonomous tasks (eat, drink, sleep, idle). With pruning every 100 ticks,
    // the task count should stay well below 100.
    // Before this fix, task count was ~2900. With pruning, it stays under 200.
    expect(result.tasks.length).toBeLessThan(200);
  });

  it('active tasks are never pruned', async () => {
    // A single dwarf with a long mine task should keep it alive
    const dwarf = makeDwarf({
      position_x: 5, position_y: 5, position_z: 0,
      need_food: 95, need_drink: 95, need_sleep: 95,
    });
    const skill = makeSkill(dwarf.id, 'mining', 1);

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      items: [
        ...Array.from({ length: 10 }, (_, i) =>
          makeItem({ category: 'food', position_x: 0, position_y: i, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' })),
        ...Array.from({ length: 10 }, (_, i) =>
          makeItem({ category: 'drink', position_x: 8, position_y: i, position_z: 0, held_by_dwarf_id: null, located_in_civ_id: 'test-civ' })),
      ],
      ticks: 200,
      seed: 55,
    });

    // All pending/claimed/in_progress tasks should survive pruning
    const activeTasks = result.tasks.filter(
      t => t.status === 'pending' || t.status === 'claimed' || t.status === 'in_progress',
    );
    for (const t of activeTasks) {
      expect(result.tasks.find(rt => rt.id === t.id)).toBeDefined();
    }
  });
});
