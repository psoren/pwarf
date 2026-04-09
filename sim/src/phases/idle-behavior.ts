import {
  IDLE_BEHAVIOR_COOLDOWN_TICKS,
  AUTONOMOUS_TASK_TYPES,
  IDLE_TASK_TYPES,
  IDLE_WEIGHT_REFARM,
  IDLE_WEIGHT_REST,
  IDLE_WEIGHT_SOCIALIZE,
  IDLE_WEIGHT_WANDER,
  SOCIALIZE_MAX_DISTANCE,
  WANDER_DISTANCE_MAX,
  WANDER_DISTANCE_MIN,
  WORK_FARM_TILL_BASE,
  WORK_REST,
  WORK_SOCIALIZE,
  WORK_WANDER,
  FORTRESS_SIZE,
} from "@pwarf/shared";
import type { Dwarf, FortressTileType, Structure } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { isDwarfIdle } from "../task-helpers.js";
import { createTask } from "../task-helpers.js";
import { manhattanDistance } from "../pathfinding.js";
import { isWalkable } from "../pathfinding.js";
import { buildTileLookup } from "../tile-lookup.js";

/**
 * Idle Behavior Phase
 *
 * Scans for idle dwarves and creates low-priority autonomous tasks
 * using weighted random selection influenced by personality traits.
 * Runs after autoForage, before jobClaiming.
 */
export async function idleBehavior(ctx: SimContext): Promise<void> {
  const { state, step } = ctx;
  const cooldowns = state._idleCooldowns ??= new Map();

  // Skip if there's pending non-idle/non-autonomous work, or if any dwarf is
  // actively doing real work (which may produce items that trigger haul tasks)
  const isRealWork = (t: { task_type: string; status: string }) =>
    !IDLE_TASK_TYPES.has(t.task_type as any)
    && !AUTONOMOUS_TASK_TYPES.has(t.task_type as any)
    && (t.status === 'pending' || t.status === 'claimed' || t.status === 'in_progress');
  if (state.tasks.some(isRealWork)) return;

  const aliveDwarves = state.dwarves.filter(d => d.status === 'alive');
  const idleDwarves = aliveDwarves.filter(d => {
    if (!isDwarfIdle(d)) return false;
    // Dwarves in strange moods don't idle
    if (state.strangeMoodDwarfIds.has(d.id)) return false;
    // Check cooldown
    const cooldownExpiry = cooldowns.get(d.id);
    if (cooldownExpiry !== undefined && step < cooldownExpiry) return false;
    return true;
  });

  if (idleDwarves.length === 0) return;

  const getTile = buildTileLookup(ctx);

  // Limit to 5 idle tasks per tick to avoid perf issues with large populations
  const maxPerTick = Math.min(idleDwarves.length, 5);
  for (let i = 0; i < maxPerTick; i++) {
    const dwarf = idleDwarves[i];
    const behavior = selectBehavior(dwarf, ctx, aliveDwarves, getTile);
    if (!behavior) continue;

    createIdleTask(dwarf, behavior, ctx);
    cooldowns.set(dwarf.id, step + IDLE_BEHAVIOR_COOLDOWN_TICKS);
  }
}

// ============================================================
// Behavior selection
// ============================================================

interface IdleBehavior {
  type: 'refarm' | 'socialize' | 'rest' | 'wander';
  target_x: number;
  target_y: number;
  target_z: number;
  /** For socialize: the target dwarf to chat with */
  targetDwarfId?: string;
  /** For rest: which structure type we're resting at */
  structureType?: string;
}

/**
 * Apply personality trait modifier.
 * traitMod(trait, scale) = max(0.2, 1.0 + (trait - 0.5) × scale)
 */
export function traitMod(trait: number | null, scale: number): number {
  if (trait === null) return 1.0;
  return Math.max(0.2, 1.0 + (trait - 0.5) * scale);
}

export function selectBehavior(
  dwarf: Dwarf,
  ctx: SimContext,
  aliveDwarves: Dwarf[],
  getTile: (x: number, y: number, z: number) => string | null,
): IdleBehavior | null {
  const candidates: Array<{ behavior: IdleBehavior; weight: number }> = [];

  // 1. Re-farm: find soil tiles at z=0 with no pending farm_till task
  const refarmTarget = findRefarmTarget(dwarf, ctx);
  if (refarmTarget) {
    const weight = IDLE_WEIGHT_REFARM * traitMod(dwarf.trait_conscientiousness, 2.0);
    candidates.push({ behavior: refarmTarget, weight });
  }

  // 2. Socialize: find another alive dwarf nearby
  const socializeTarget = findSocializeTarget(dwarf, aliveDwarves, ctx);
  if (socializeTarget) {
    let weight = IDLE_WEIGHT_SOCIALIZE * traitMod(dwarf.trait_extraversion, 2.0);
    // Boost when social need is low
    if (dwarf.need_social < 40) weight *= 1.5;
    // Agreeableness gives a slight boost
    weight *= traitMod(dwarf.trait_agreeableness, 0.5);
    candidates.push({ behavior: socializeTarget, weight });
  }

  // 3. Rest at meeting area (completed well or mushroom garden)
  const restTarget = findRestTarget(dwarf, ctx);
  if (restTarget) {
    let weight = IDLE_WEIGHT_REST * traitMod(dwarf.trait_openness, 2.0);
    // Introverts prefer rest over socializing
    const extraversion = dwarf.trait_extraversion ?? 0.5;
    if (extraversion < 0.4) weight *= 1.5;
    candidates.push({ behavior: restTarget, weight });
  }

  // 4. Wander: always available as fallback
  const wanderTarget = findWanderTarget(dwarf, ctx, getTile);
  if (wanderTarget) {
    candidates.push({ behavior: wanderTarget, weight: IDLE_WEIGHT_WANDER });
  }

  if (candidates.length === 0) return null;

  // Weighted random selection
  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let roll = ctx.rng.random() * totalWeight;
  for (const c of candidates) {
    roll -= c.weight;
    if (roll <= 0) return c.behavior;
  }
  return candidates[candidates.length - 1].behavior;
}

// ============================================================
// Target finding
// ============================================================

function findRefarmTarget(dwarf: Dwarf, ctx: SimContext): IdleBehavior | null {
  const { state } = ctx;
  // Find soil tiles at z=0 with no pending farm_till task
  const pendingFarmTiles = new Set<string>();
  for (const t of state.tasks) {
    if (t.task_type === 'farm_till' && (t.status === 'pending' || t.status === 'claimed' || t.status === 'in_progress')) {
      if (t.target_x !== null && t.target_y !== null && t.target_z !== null) {
        pendingFarmTiles.add(`${t.target_x},${t.target_y},${t.target_z}`);
      }
    }
  }

  let bestTile: { x: number; y: number; z: number } | null = null;
  let bestDist = Infinity;

  for (const [key, tile] of state.fortressTileOverrides) {
    if (tile.tile_type !== 'soil') continue;
    const parts = key.split(',');
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    const z = Number(parts[2]);
    if (z !== 0) continue;
    if (pendingFarmTiles.has(key)) continue;

    const dist = manhattanDistance(
      { x: dwarf.position_x, y: dwarf.position_y, z: dwarf.position_z },
      { x, y, z },
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestTile = { x, y, z };
    }
  }

  if (!bestTile) return null;
  return { type: 'refarm', target_x: bestTile.x, target_y: bestTile.y, target_z: bestTile.z };
}

function findSocializeTarget(
  dwarf: Dwarf,
  aliveDwarves: Dwarf[],
  ctx: SimContext,
): IdleBehavior | null {
  const { state } = ctx;

  // Find nearby alive dwarves sorted by relationship strength then distance
  const candidates: Array<{ dwarf: Dwarf; dist: number; relWeight: number }> = [];

  for (const other of aliveDwarves) {
    if (other.id === dwarf.id) continue;
    const dist = manhattanDistance(
      { x: dwarf.position_x, y: dwarf.position_y, z: dwarf.position_z },
      { x: other.position_x, y: other.position_y, z: other.position_z },
    );
    if (dist > SOCIALIZE_MAX_DISTANCE) continue;

    // Weight by relationship type
    let relWeight = 1; // stranger
    const rel = state.dwarfRelationships.find(
      r => (r.dwarf_a_id === dwarf.id && r.dwarf_b_id === other.id)
        || (r.dwarf_a_id === other.id && r.dwarf_b_id === dwarf.id),
    );
    if (rel) {
      switch (rel.type) {
        case 'spouse': relWeight = 8; break;
        case 'friend': relWeight = 4; break;
        case 'acquaintance': relWeight = 2; break;
        default: relWeight = 1; break;
      }
    }

    candidates.push({ dwarf: other, dist, relWeight });
  }

  if (candidates.length === 0) return null;

  // Weighted random among candidates (closer + stronger relationship = more likely)
  const totalWeight = candidates.reduce((sum, c) => sum + c.relWeight / (1 + c.dist * 0.1), 0);
  let roll = ctx.rng.random() * totalWeight;
  for (const c of candidates) {
    roll -= c.relWeight / (1 + c.dist * 0.1);
    if (roll <= 0) {
      // Target: tile adjacent to the other dwarf
      return {
        type: 'socialize',
        target_x: c.dwarf.position_x,
        target_y: c.dwarf.position_y,
        target_z: c.dwarf.position_z,
        targetDwarfId: c.dwarf.id,
      };
    }
  }

  const last = candidates[candidates.length - 1];
  return {
    type: 'socialize',
    target_x: last.dwarf.position_x,
    target_y: last.dwarf.position_y,
    target_z: last.dwarf.position_z,
    targetDwarfId: last.dwarf.id,
  };
}

function findRestTarget(dwarf: Dwarf, ctx: SimContext): IdleBehavior | null {
  const { state } = ctx;

  // Find completed wells or mushroom gardens with valid positions
  const meetingStructures = state.structures.filter(
    (s): s is Structure & { position_x: number; position_y: number; position_z: number } =>
      (s.type === 'well' || s.type === 'mushroom_garden')
      && s.completion_pct >= 100
      && s.position_x !== null && s.position_y !== null && s.position_z !== null,
  );

  if (meetingStructures.length === 0) return null;

  // Pick the nearest one
  let best: (typeof meetingStructures)[number] | null = null;
  let bestDist = Infinity;
  for (const s of meetingStructures) {
    const dist = manhattanDistance(
      { x: dwarf.position_x, y: dwarf.position_y, z: dwarf.position_z },
      { x: s.position_x, y: s.position_y, z: s.position_z },
    );
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }

  if (!best) return null;
  return {
    type: 'rest',
    target_x: best.position_x,
    target_y: best.position_y,
    target_z: best.position_z,
    structureType: best.type,
  };
}

function findWanderTarget(
  dwarf: Dwarf,
  ctx: SimContext,
  getTile: (x: number, y: number, z: number) => string | null,
): IdleBehavior | null {
  // Try up to 10 random offsets to find a walkable tile 3-8 tiles away
  for (let attempt = 0; attempt < 10; attempt++) {
    const dist = WANDER_DISTANCE_MIN + Math.floor(ctx.rng.random() * (WANDER_DISTANCE_MAX - WANDER_DISTANCE_MIN + 1));
    const angle = ctx.rng.random() * Math.PI * 2;
    const dx = Math.round(Math.cos(angle) * dist);
    const dy = Math.round(Math.sin(angle) * dist);
    const tx = dwarf.position_x + dx;
    const ty = dwarf.position_y + dy;
    const tz = dwarf.position_z;

    if (tx < 0 || tx >= FORTRESS_SIZE || ty < 0 || ty >= FORTRESS_SIZE) continue;

    const tile = getTile(tx, ty, tz);
    if (tile && isWalkable(tile as FortressTileType)) {
      return { type: 'wander', target_x: tx, target_y: ty, target_z: tz };
    }
  }
  return null;
}

// ============================================================
// Task creation
// ============================================================

function createIdleTask(dwarf: Dwarf, behavior: IdleBehavior, ctx: SimContext): void {
  switch (behavior.type) {
    case 'refarm':
      createTask(ctx, {
        task_type: 'farm_till',
        priority: 3,
        target_x: behavior.target_x,
        target_y: behavior.target_y,
        target_z: behavior.target_z,
        work_required: WORK_FARM_TILL_BASE,
      });
      break;

    case 'socialize':
      createTask(ctx, {
        task_type: 'socialize',
        priority: 2,
        target_x: behavior.target_x,
        target_y: behavior.target_y,
        target_z: behavior.target_z,
        work_required: WORK_SOCIALIZE,
      });
      break;

    case 'rest':
      createTask(ctx, {
        task_type: 'rest',
        priority: 2,
        target_x: behavior.target_x,
        target_y: behavior.target_y,
        target_z: behavior.target_z,
        work_required: WORK_REST,
      });
      break;

    case 'wander':
      createTask(ctx, {
        task_type: 'wander',
        priority: 1,
        target_x: behavior.target_x,
        target_y: behavior.target_y,
        target_z: behavior.target_z,
        work_required: WORK_WANDER,
      });
      break;
  }
}
