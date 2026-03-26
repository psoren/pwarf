import type { Monster, Dwarf } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { buildTileLookup } from "../tile-lookup.js";

/**
 * Monster Pathfinding Phase
 *
 * Each active aggressive/hunting monster advances one step toward the nearest
 * alive dwarf. Uses simple greedy movement (reduces the largest axis difference
 * each tick) — no A* needed for MVP.
 *
 * Monsters with `neutral` or `hibernating` behavior don't move.
 * Monsters that are `fleeing` move away from dwarves.
 */
const MONSTER_BLOCKING_TILES: ReadonlySet<string> = new Set(['door']);

export async function monsterPathfinding(ctx: SimContext): Promise<void> {
  const { state } = ctx;

  const aliveDwarves = state.dwarves.filter(d => d.status === 'alive');
  if (aliveDwarves.length === 0) return;

  const getTile = buildTileLookup(ctx);

  for (const monster of state.monsters) {
    if (monster.status !== 'active') continue;
    if (monster.current_tile_x === null || monster.current_tile_y === null) continue;

    if (monster.behavior === 'neutral' || monster.behavior === 'hibernating') continue;

    const target = findNearestDwarf(monster, aliveDwarves);
    if (!target) continue;

    const { newX, newY } = stepToward(
      monster.current_tile_x,
      monster.current_tile_y,
      target.position_x,
      target.position_y,
      monster.behavior === 'fleeing',
    );

    const destTile = getTile(newX, newY, 0);
    if (destTile && MONSTER_BLOCKING_TILES.has(destTile)) continue;

    monster.current_tile_x = newX;
    monster.current_tile_y = newY;
    state.dirtyMonsterIds.add(monster.id);
  }
}

/**
 * Find the closest alive dwarf to a monster (Manhattan distance).
 * Exported for unit testing.
 */
export function findNearestDwarf(
  monster: Pick<Monster, 'current_tile_x' | 'current_tile_y'>,
  dwarves: Pick<Dwarf, 'position_x' | 'position_y' | 'status'>[],
): Pick<Dwarf, 'position_x' | 'position_y'> | null {
  if (monster.current_tile_x === null || monster.current_tile_y === null) return null;

  let nearest: Pick<Dwarf, 'position_x' | 'position_y'> | null = null;
  let minDist = Infinity;

  for (const d of dwarves) {
    if (d.status !== 'alive') continue;
    const dist = Math.abs(d.position_x - monster.current_tile_x) + Math.abs(d.position_y - monster.current_tile_y);
    if (dist < minDist) {
      minDist = dist;
      nearest = d;
    }
  }
  return nearest;
}

/**
 * Move one step toward (or away from) a target tile.
 * Prioritizes the axis with the larger gap.
 * Exported for unit testing.
 */
export function stepToward(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  fleeing = false,
): { newX: number; newY: number } {
  const dx = toX - fromX;
  const dy = toY - fromY;

  if (dx === 0 && dy === 0) return { newX: fromX, newY: fromY };

  const sign = fleeing ? -1 : 1;
  let newX = fromX;
  let newY = fromY;

  if (Math.abs(dx) >= Math.abs(dy)) {
    newX += sign * Math.sign(dx);
  } else {
    newY += sign * Math.sign(dy);
  }

  return { newX, newY };
}
