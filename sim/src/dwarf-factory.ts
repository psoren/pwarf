import type { Dwarf } from '@pwarf/shared';
import { DWARF_FIRST_NAMES, DWARF_SURNAMES, SURFACE_Z } from '@pwarf/shared';
import type { Rng } from './rng.js';

/**
 * Create a single immigrant dwarf arriving at the fortress.
 *
 * Immigrants spawn at the fortress surface (z=0) near the center of the map.
 * Names, gender, age, and personality traits are randomised.
 */
export function createImmigrantDwarf(
  rng: Rng,
  civilizationId: string,
  year: number,
  spawnX: number,
  spawnY: number,
): Dwarf {
  const name = DWARF_FIRST_NAMES[rng.int(0, DWARF_FIRST_NAMES.length - 1)] ?? 'Urist';
  const surname = DWARF_SURNAMES[rng.int(0, DWARF_SURNAMES.length - 1)] ?? 'Ironpick';
  const gender = rng.random() < 0.5 ? 'male' : 'female';
  const age = 20 + rng.int(0, 20); // 20–40

  return {
    id: rng.uuid(),
    civilization_id: civilizationId,
    name,
    surname,
    status: 'alive',
    age,
    gender,
    born_year: year - age,
    died_year: null,
    cause_of_death: null,
    need_food: 80,
    need_drink: 80,
    need_sleep: 80,
    need_social: 60,
    need_purpose: 60,
    need_beauty: 50,
    stress_level: 0,
    is_in_tantrum: false,
    health: 100,
    memories: [],
    trait_openness: rng.random(),
    trait_conscientiousness: rng.random(),
    trait_extraversion: rng.random(),
    trait_agreeableness: rng.random(),
    trait_neuroticism: rng.random(),
    current_task_id: null,
    position_x: spawnX,
    position_y: spawnY,
    position_z: SURFACE_Z,
    created_at: new Date().toISOString(),
  };
}
