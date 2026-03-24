import {
  MONSTER_SPAWN_INTERVAL,
  MONSTER_PEACE_PERIOD_TICKS,
  MONSTER_MAX_ACTIVE,
  MONSTER_NIGHT_CREATURE_HEALTH,
  MONSTER_NIGHT_CREATURE_THREAT,
} from "@pwarf/shared";
import type { Monster } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";

const SPAWN_RADIUS = 20;

/**
 * Monster Spawning Phase
 *
 * Periodically spawns a night_creature near the fortress when conditions are met:
 * - Checked every MONSTER_SPAWN_INTERVAL ticks
 * - Only spawns if there are alive dwarves and fewer than MONSTER_MAX_ACTIVE monsters
 *
 * The monster spawns at a random position within SPAWN_RADIUS tiles of the
 * average dwarf position, approaching from a random direction.
 */
export async function monsterSpawning(ctx: SimContext): Promise<void> {
  if (ctx.step < MONSTER_PEACE_PERIOD_TICKS) return;
  if (ctx.step % MONSTER_SPAWN_INTERVAL !== 0) return;

  const { state, rng } = ctx;

  const aliveDwarves = state.dwarves.filter(d => d.status === 'alive');
  if (aliveDwarves.length === 0) return;

  const activeMonsters = state.monsters.filter(m => m.status === 'active');
  if (activeMonsters.length >= MONSTER_MAX_ACTIVE) return;

  // Find the centroid of alive dwarves
  const sumX = aliveDwarves.reduce((s, d) => s + d.position_x, 0);
  const sumY = aliveDwarves.reduce((s, d) => s + d.position_y, 0);
  const centerX = Math.round(sumX / aliveDwarves.length);
  const centerY = Math.round(sumY / aliveDwarves.length);

  // Spawn at a random edge of the radius
  const angle = rng.random() * Math.PI * 2;
  const spawnX = centerX + Math.round(Math.cos(angle) * SPAWN_RADIUS);
  const spawnY = centerY + Math.round(Math.sin(angle) * SPAWN_RADIUS);

  const monster: Monster = {
    id: rng.uuid(),
    world_id: ctx.worldId,
    name: generateMonsterName(rng),
    epithet: null,
    type: 'night_creature',
    status: 'active',
    behavior: 'aggressive',
    is_named: false,
    lair_tile_x: spawnX,
    lair_tile_y: spawnY,
    current_tile_x: spawnX,
    current_tile_y: spawnY,
    threat_level: MONSTER_NIGHT_CREATURE_THREAT,
    health: MONSTER_NIGHT_CREATURE_HEALTH,
    size_category: 'medium',
    lore: null,
    properties: {},
    first_seen_year: ctx.year,
    slain_year: null,
    slain_by_dwarf_id: null,
    slain_in_civ_id: null,
    slain_in_ruin_id: null,
    created_at: new Date().toISOString(),
  };

  state.monsters.push(monster);

  state.pendingEvents.push({
    id: rng.uuid(),
    world_id: ctx.worldId,
    year: ctx.year,
    category: 'monster_sighting',
    civilization_id: ctx.civilizationId,
    ruin_id: null,
    dwarf_id: null,
    item_id: null,
    faction_id: null,
    monster_id: monster.id,
    description: `A ${monster.name} approaches the fortress!`,
    event_data: { monster_type: monster.type, threat_level: monster.threat_level },
    created_at: new Date().toISOString(),
  });
}

const SYLLABLES = ['grak', 'mor', 'zel', 'thorn', 'brak', 'vex', 'krul', 'sha', 'neth', 'roth'];

/** Generate a short random monster name from syllables. */
export function generateMonsterName(rng: { int(min: number, max: number): number }): string {
  const a = SYLLABLES[rng.int(0, SYLLABLES.length - 1)] ?? 'grak';
  const b = SYLLABLES[rng.int(0, SYLLABLES.length - 1)] ?? 'mor';
  return a.charAt(0).toUpperCase() + a.slice(1) + b;
}
