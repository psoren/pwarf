import {
  IDLE_BEHAVIOR_COOLDOWN_TICKS,
  WORK_SOCIALIZE,
  WORK_REST,
  WORK_WANDER,
  SOCIALIZE_MAX_DISTANCE,
  WANDER_DISTANCE_MIN,
  WANDER_DISTANCE_MAX,
  IDLE_WEIGHT_REFARM,
  IDLE_WEIGHT_SOCIALIZE,
  IDLE_WEIGHT_REST,
  IDLE_WEIGHT_WANDER,
  WORK_FARM_TILL_BASE,
  IDLE_TASK_TYPES,
} from "@pwarf/shared";
import type { Dwarf, DwarfRelationship } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { isDwarfIdle, createTask } from "../task-helpers.js";
import { isWalkable } from "../pathfinding.js";

/**
 * Compute a trait modifier for idle behavior weighting.
 * Returns a multiplier clamped to a minimum of 0.2.
 * trait=null → returns 1.0 (no modifier).
 * scale controls how strongly the trait shifts the weight.
 */
function traitMod(trait: number | null, scale: number): number {
  if (trait === null) return 1.0;
  return Math.max(0.2, 1.0 + (trait - 0.5) * scale);
}

/**
 * Weighted random selection over a list of behavior candidates.
 * Returns the behavior string of the chosen candidate.
 */
function weightedRandom(
  candidates: Array<{ behavior: string; weight: number }>,
  rng: SimContext['rng'],
): string {
  const total = candidates.reduce((sum, c) => sum + c.weight, 0);
  let roll = rng.random() * total;
  for (const c of candidates) {
    roll -= c.weight;
    if (roll <= 0) return c.behavior;
  }
  return candidates[candidates.length - 1].behavior;
}

/**
 * Get the relationship weight between two dwarves for socialize target selection.
 * Higher weight = more likely to be chosen as social partner.
 */
function relationshipWeight(dwarfId: string, otherId: string, relationships: DwarfRelationship[]): number {
  const rel = relationships.find(
    r => (r.dwarf_a_id === dwarfId && r.dwarf_b_id === otherId)
      || (r.dwarf_a_id === otherId && r.dwarf_b_id === dwarfId),
  );
  if (!rel) return 1; // stranger — small base weight so all dwarves are reachable
  switch (rel.type) {
    case 'spouse': return 10;
    case 'friend': return 5;
    case 'acquaintance': return 2;
    default: return 1;
  }
}

/**
 * Get a tile type at a given position by checking fortress tile overrides
 * and falling back to the fortress deriver.
 */
function getTileType(ctx: SimContext, x: number, y: number, z: number): string | null {
  const key = `${x},${y},${z}`;
  const override = ctx.state.fortressTileOverrides.get(key);
  if (override) return override.tile_type;
  if (ctx.fortressDeriver) {
    return ctx.fortressDeriver.deriveTile(x, y, z).tileType;
  }
  return null;
}

/**
 * Find a walkable wander target within WANDER_DISTANCE_MIN..MAX of the dwarf.
 * Tries up to 10 random positions. Falls back to the dwarf's current position.
 */
function findWanderTarget(
  dwarf: Dwarf,
  ctx: SimContext,
): { x: number; y: number; z: number } {
  for (let attempt = 0; attempt < 10; attempt++) {
    const dist = WANDER_DISTANCE_MIN + Math.floor(ctx.rng.random() * (WANDER_DISTANCE_MAX - WANDER_DISTANCE_MIN + 1));
    // Random direction
    const angle = ctx.rng.random() * 2 * Math.PI;
    const dx = Math.round(Math.cos(angle) * dist);
    const dy = Math.round(Math.sin(angle) * dist);
    const tx = dwarf.position_x + dx;
    const ty = dwarf.position_y + dy;
    const tz = dwarf.position_z;

    const tileType = getTileType(ctx, tx, ty, tz);
    if (tileType !== null && isWalkable(tileType as import("@pwarf/shared").FortressTileType)) {
      return { x: tx, y: ty, z: tz };
    }

    // Also try if tileType is null but within expected fortress range (treat as walkable open area)
    if (tileType === null && tx >= 0 && ty >= 0 && tx < 512 && ty < 512) {
      return { x: tx, y: ty, z: tz };
    }
  }
  // Fall back to current position
  return { x: dwarf.position_x, y: dwarf.position_y, z: dwarf.position_z };
}

/**
 * Find the nearest soil tile at z=0 that has no active farming chain task.
 * Accepts a pre-computed set of pending/active farm task targets for performance.
 */
function findNearestSoilTileWithTargets(
  dwarf: Dwarf,
  pendingFarmTargets: Set<string>,
  ctx: SimContext,
): { x: number; y: number; z: number } | null {
  const { state } = ctx;
  let nearest: { x: number; y: number; z: number } | null = null;
  let nearestDist = Infinity;

  for (const [, tile] of state.fortressTileOverrides) {
    if (tile.tile_type !== 'soil') continue;
    if (tile.z !== 0) continue;
    const key = `${tile.x},${tile.y},${tile.z}`;
    if (pendingFarmTargets.has(key)) continue;

    const dist = Math.abs(tile.x - dwarf.position_x) + Math.abs(tile.y - dwarf.position_y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = { x: tile.x, y: tile.y, z: tile.z };
    }
  }

  return nearest;
}

/**
 * Find a socialize target: another alive, non-tantruming dwarf within SOCIALIZE_MAX_DISTANCE.
 * Target is selected weighted by relationship type and proximity.
 * Returns the chosen dwarf and an adjacent tile to stand on, or null if none available.
 */
function findSocializeTarget(
  dwarf: Dwarf,
  ctx: SimContext,
): { targetDwarf: Dwarf; x: number; y: number; z: number } | null {
  const { state } = ctx;
  const candidates: Array<{ dwarf: Dwarf; weight: number }> = [];

  for (const other of state.dwarves) {
    if (other.id === dwarf.id) continue;
    if (other.status !== 'alive') continue;
    if (other.is_in_tantrum) continue;
    if (other.position_z !== dwarf.position_z) continue;

    const dist = Math.abs(other.position_x - dwarf.position_x) + Math.abs(other.position_y - dwarf.position_y);
    if (dist > SOCIALIZE_MAX_DISTANCE) continue;

    // Proximity bonus: closer dwarves are somewhat more likely to be chosen
    const proximityBonus = Math.max(0, 1 - dist / SOCIALIZE_MAX_DISTANCE);
    const relWeight = relationshipWeight(dwarf.id, other.id, state.dwarfRelationships);
    candidates.push({ dwarf: other, weight: relWeight + proximityBonus });
  }

  if (candidates.length === 0) return null;

  // Weighted random selection
  const total = candidates.reduce((sum, c) => sum + c.weight, 0);
  let roll = ctx.rng.random() * total;
  let chosen: Dwarf | null = null;
  for (const c of candidates) {
    roll -= c.weight;
    if (roll <= 0) {
      chosen = c.dwarf;
      break;
    }
  }
  if (!chosen) chosen = candidates[candidates.length - 1].dwarf;

  // Target tile: stand adjacent to (or at) the chosen dwarf's position
  // Use dwarf's current position as the target (they'll path to be near each other)
  return {
    targetDwarf: chosen,
    x: chosen.position_x,
    y: chosen.position_y,
    z: chosen.position_z,
  };
}

/**
 * Find a completed well or mushroom_garden structure for resting.
 */
function findRestStructure(
  dwarf: Dwarf,
  ctx: SimContext,
): { x: number; y: number; z: number } | null {
  const { state } = ctx;
  let nearest: { x: number; y: number; z: number } | null = null;
  let nearestDist = Infinity;

  for (const s of state.structures) {
    if (s.type !== 'well' && s.type !== 'mushroom_garden') continue;
    if (s.completion_pct < 100) continue;
    if (s.position_x === null || s.position_y === null || s.position_z === null) continue;

    const dist = Math.abs(s.position_x - dwarf.position_x) + Math.abs(s.position_y - dwarf.position_y)
      + Math.abs(s.position_z - dwarf.position_z) * 10;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = { x: s.position_x, y: s.position_y, z: s.position_z };
    }
  }

  return nearest;
}

/**
 * Idle Behavior Phase
 *
 * For each idle dwarf not in cooldown, evaluates personality-weighted behaviors
 * and creates a low-priority autonomous task. Runs after autoForage and before jobClaiming.
 */
export async function idleBehavior(ctx: SimContext): Promise<void> {
  const { state } = ctx;

  // Fast path: no idle dwarves → nothing to do
  const hasIdleDwarf = state.dwarves.some(isDwarfIdle);
  if (!hasIdleDwarf) return;

  // Pre-compute farm targets once per phase call (shared across all idle dwarves this tick).
  // This avoids scanning all tasks O(dwarves × tasks) — instead O(tasks + dwarves × tiles).
  const pendingFarmTargets = new Set<string>();
  for (const task of state.tasks) {
    const s = task.status;
    if (s !== 'pending' && s !== 'claimed' && s !== 'in_progress') continue;
    if (task.task_type !== 'farm_till' && task.task_type !== 'farm_plant' && task.task_type !== 'farm_harvest') continue;
    if (task.target_x !== null && task.target_y !== null && task.target_z !== null) {
      pendingFarmTargets.add(`${task.target_x},${task.target_y},${task.target_z}`);
    }
  }

  for (const dwarf of state.dwarves) {
    if (!isDwarfIdle(dwarf)) continue;

    // Check cooldown: skip if dwarf recently completed an idle task
    const lastIdleTick = state._idleCooldowns.get(dwarf.id) ?? -Infinity;
    if (ctx.step - lastIdleTick < IDLE_BEHAVIOR_COOLDOWN_TICKS) continue;


    // Build weighted candidate list
    const candidates: Array<{ behavior: string; weight: number }> = [];

    // 1. Re-farm: conscientiousness modifier
    const soilTile = findNearestSoilTileWithTargets(dwarf, pendingFarmTargets, ctx);
    if (soilTile) {
      const weight = IDLE_WEIGHT_REFARM * traitMod(dwarf.trait_conscientiousness, 2.0);
      candidates.push({ behavior: 'refarm', weight });
    }

    // 2. Socialize: extraversion modifier, boosted when need_social < 40
    const socializeTarget = findSocializeTarget(dwarf, ctx);
    if (socializeTarget) {
      let weight = IDLE_WEIGHT_SOCIALIZE * traitMod(dwarf.trait_extraversion, 2.0);
      if (dwarf.need_social < 40) weight *= 1.5;
      candidates.push({ behavior: 'socialize', weight });
    }

    // 3. Rest: openness modifier, boosted for introverts (low extraversion)
    const restStructure = findRestStructure(dwarf, ctx);
    if (restStructure) {
      let weight = IDLE_WEIGHT_REST * traitMod(dwarf.trait_openness, 2.0);
      // Introvert boost: dwarves with low extraversion prefer quiet rest
      const extraversion = dwarf.trait_extraversion ?? 0.5;
      if (extraversion < 0.5) weight *= 1.0 + (0.5 - extraversion);
      candidates.push({ behavior: 'rest', weight });
    }

    // 4. Wander: always available, no modifier
    candidates.push({ behavior: 'wander', weight: IDLE_WEIGHT_WANDER });

    if (candidates.length === 0) continue;

    const chosen = weightedRandom(candidates, ctx.rng);

    let createdTask = null;

    switch (chosen) {
      case 'refarm': {
        if (!soilTile) break;
        createdTask = createTask(ctx, {
          task_type: 'farm_till',
          priority: 3,
          target_x: soilTile.x,
          target_y: soilTile.y,
          target_z: soilTile.z,
          work_required: WORK_FARM_TILL_BASE,
          assigned_dwarf_id: dwarf.id,
        });
        // Mark this tile as targeted so other dwarves processed this tick don't duplicate it
        pendingFarmTargets.add(`${soilTile.x},${soilTile.y},${soilTile.z}`);
        break;
      }

      case 'socialize': {
        if (!socializeTarget) break;
        createdTask = createTask(ctx, {
          task_type: 'socialize',
          priority: 2,
          target_x: socializeTarget.x,
          target_y: socializeTarget.y,
          target_z: socializeTarget.z,
          // Encode target dwarf ID in target_item_id (UUID field repurposed for cross-dwarf reference)
          target_item_id: socializeTarget.targetDwarf.id,
          work_required: WORK_SOCIALIZE,
          assigned_dwarf_id: dwarf.id,
        });
        break;
      }

      case 'rest': {
        if (!restStructure) break;
        createdTask = createTask(ctx, {
          task_type: 'rest',
          priority: 2,
          target_x: restStructure.x,
          target_y: restStructure.y,
          target_z: restStructure.z,
          work_required: WORK_REST,
          assigned_dwarf_id: dwarf.id,
        });
        break;
      }

      case 'wander': {
        const target = findWanderTarget(dwarf, ctx);
        createdTask = createTask(ctx, {
          task_type: 'wander',
          priority: 1,
          target_x: target.x,
          target_y: target.y,
          target_z: target.z,
          work_required: WORK_WANDER,
          assigned_dwarf_id: dwarf.id,
        });
        break;
      }
    }

    // Immediately claim the task (assign to dwarf) so jobClaiming knows the dwarf is busy.
    // jobClaiming will cancel the idle task and reassign if a higher-priority task exists.
    if (createdTask) {
      createdTask.status = 'claimed';
      dwarf.current_task_id = createdTask.id;
      state.dirtyDwarfIds.add(dwarf.id);
      state.dirtyTaskIds.add(createdTask.id);
      // Set cooldown at creation time to prevent rapid retry if the task fails
      state._idleCooldowns.set(dwarf.id, ctx.step);
    }
  }
}
