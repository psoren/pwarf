#!/usr/bin/env node
/**
 * Runs a short baseline sim scenario and prints JSON stats to stdout.
 * Used by the hourly digest to embed a "fortress health check" in each post.
 *
 * Outputs JSON:
 * {
 *   "ticks": 500,
 *   "days": 10,
 *   "dwarves_alive": 3,
 *   "dwarves_total": 3,
 *   "deaths": [],
 *   "avg_stress": 0.0,
 *   "tasks_completed": 12
 * }
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

// Import the pre-built packages (requires npm run build first)
const { runScenario } = await import(`file://${REPO_ROOT}/sim/dist/index.js`);
const { STEPS_PER_DAY } = await import(`file://${REPO_ROOT}/shared/dist/index.js`);

const TICKS = 500;
const SEED = 47891; // fixed seed for reproducible baseline

function makeBaseDwarf(name, id) {
  return {
    id,
    civilization_id: 'baseline',
    name,
    surname: 'McFortress',
    status: 'alive',
    age: 25,
    gender: 'male',
    need_food: 90,
    need_drink: 90,
    need_sleep: 80,
    need_social: 60,
    need_purpose: 50,
    need_beauty: 50,
    stress_level: 0,
    is_in_tantrum: false,
    health: 100,
    injuries: [],
    memories: [],
    trait_openness: null,
    trait_conscientiousness: null,
    trait_extraversion: null,
    trait_agreeableness: null,
    trait_neuroticism: null,
    religious_devotion: 0,
    faction_id: null,
    born_year: null,
    died_year: null,
    cause_of_death: null,
    current_task_id: null,
    position_x: 5,
    position_y: 5,
    position_z: 0,
    created_at: new Date().toISOString(),
  };
}

const dwarves = [
  makeBaseDwarf('Urist', 'd1'),
  makeBaseDwarf('Bomrek', 'd2'),
  makeBaseDwarf('Meng', 'd3'),
];

const result = await runScenario({ dwarves, ticks: TICKS, seed: SEED });

const alive = result.dwarves.filter(d => d.status === 'alive');
const dead = result.dwarves.filter(d => d.status !== 'alive');
const avgStress = alive.length > 0
  ? alive.reduce((sum, d) => sum + d.stress_level, 0) / alive.length
  : 0;

const completedTasks = result.tasks.filter(t => t.status === 'completed').length;

const stats = {
  ticks: result.ticks,
  days: Math.floor(result.ticks / STEPS_PER_DAY),
  dwarves_alive: alive.length,
  dwarves_total: result.dwarves.length,
  deaths: dead.map(d => ({ name: d.name, cause: d.cause_of_death ?? 'unknown' })),
  avg_stress: Math.round(avgStress * 10) / 10,
  tasks_completed: completedTasks,
};

process.stdout.write(JSON.stringify(stats) + '\n');
