import type { FortressTileType } from "@pwarf/shared";

export interface Position {
  x: number;
  y: number;
  z: number;
}

/** Tile lookup function — returns the tile type at a given position, or null if no tile exists. */
export type TileLookup = (x: number, y: number, z: number) => FortressTileType | null;

/** Resolves entrance positions to their cave z-level and back. */
export interface ZResolver {
  getZForEntrance(x: number, y: number): number | null;
  getEntranceForZ(z: number): { x: number; y: number } | null;
}

const WALKABLE_TILES: ReadonlySet<FortressTileType> = new Set([
  'constructed_floor',
  'cavern_floor',
  'open_air',
  'soil',
  'well',
  'mushroom_garden',
  'grass',
  'sand',
  'mud',
  'ice',
  'cave_entrance',
  'tree',
  'bush',
  'rock',
  'bed',
  'door',
  'cave_mushroom',
]);

/** Check if a tile type is walkable. */
export function isWalkable(tileType: FortressTileType | null): boolean {
  if (tileType === null) return false;
  return WALKABLE_TILES.has(tileType);
}

/**
 * Get walkable neighbors of a position.
 * Returns adjacent tiles on the same z-level plus cave entrance transitions.
 *
 * When a ZResolver is provided, cave_entrance tiles transition to the specific
 * z-level for that entrance (not always z-1). Without a resolver, falls back
 * to the legacy z-1 behavior.
 */
export function getNeighbors(pos: Position, getTile: TileLookup, zResolver?: ZResolver): Position[] {
  const neighbors: Position[] = [];
  const { x, y, z } = pos;

  // Cardinal directions on same z-level
  const deltas = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  for (const [dx, dy] of deltas) {
    const nx = x + dx;
    const ny = y + dy;
    const tile = getTile(nx, ny, z);
    if (isWalkable(tile)) {
      neighbors.push({ x: nx, y: ny, z });
    }
  }

  // Cave entrance connections: surface cave_entrance ↔ cave below
  const currentTile = getTile(x, y, z);
  if (currentTile === 'cave_entrance' && z === 0) {
    const caveZ = zResolver ? zResolver.getZForEntrance(x, y) : -1;
    if (caveZ !== null) {
      const below = getTile(x, y, caveZ);
      if (isWalkable(below)) {
        neighbors.push({ x, y, z: caveZ });
      }
    }
  }
  // From underground, can go up through the entrance that leads to this z-level
  if (z < 0) {
    const entrance = zResolver?.getEntranceForZ(z);
    if (entrance) {
      const above = getTile(entrance.x, entrance.y, 0);
      if (above === 'cave_entrance') {
        neighbors.push({ x: entrance.x, y: entrance.y, z: 0 });
      }
    } else {
      // Legacy fallback: try going straight up
      const above = getTile(x, y, z + 1);
      if (above === 'cave_entrance') {
        neighbors.push({ x, y, z: z + 1 });
      }
    }
  }

  return neighbors;
}

function posKey(p: Position): string {
  return `${p.x},${p.y},${p.z}`;
}

/**
 * A* pathfinding from start to goal.
 *
 * Returns the next position the entity should move to (one step toward goal),
 * or null if no path exists. The start position does not need to be walkable
 * (the entity is already there). The goal does not need to be walkable either
 * (for mining tasks, the goal is a solid tile — the dwarf needs to reach an
 * adjacent walkable tile).
 *
 * Uses Manhattan distance as the heuristic, which is admissible for 4-connected
 * grid movement. This explores far fewer nodes than BFS for long-distance paths
 * across open terrain.
 *
 * @param adjacentToGoal If true, the path ends at any walkable tile adjacent
 *   to the goal (used for mining — you stand next to the wall, not inside it).
 *   If false, the path ends at the goal tile itself.
 */
/** Safety limit — abort after visiting this many nodes. */
const MAX_SEARCH_NODES = 50_000;

export function bfsNextStep(
  start: Position,
  goal: Position,
  getTile: TileLookup,
  adjacentToGoal = false,
  zResolver?: ZResolver,
  /** Tiles to treat as unwalkable (e.g. tiles occupied by other dwarves). */
  blockedTiles?: ReadonlySet<string>,
): Position | null {
  // Already at goal
  if (start.x === goal.x && start.y === goal.y && start.z === goal.z) {
    return null;
  }

  // If going adjacent-to-goal, check if we're already adjacent
  if (adjacentToGoal && isAdjacentTo(start, goal)) {
    return null;
  }

  // A* with a binary min-heap on f = g + h
  const gScore = new Map<string, number>();
  const parent = new Map<string, Position>();
  const startKey = posKey(start);
  gScore.set(startKey, 0);

  const heap = new MinHeap();
  heap.push({ pos: start, f: heuristic(start, goal) });

  let visited = 0;

  while (heap.size > 0) {
    if (visited >= MAX_SEARCH_NODES) {
      return null; // Search space exhausted — no path
    }

    const { pos: current } = heap.pop()!;
    const currentKey = posKey(current);
    visited++;

    // Check if we've reached the target
    const reached = adjacentToGoal
      ? isAdjacentTo(current, goal)
      : (current.x === goal.x && current.y === goal.y && current.z === goal.z);

    if (reached && visited > 1) {
      return traceFirstStep(start, current, parent);
    }

    const currentG = gScore.get(currentKey)!;
    const neighbors = getNeighbors(current, getTile, zResolver);

    for (const neighbor of neighbors) {
      const key = posKey(neighbor);
      if (blockedTiles?.has(key)) continue;

      const tentativeG = currentG + 1;
      const prevG = gScore.get(key);
      if (prevG !== undefined && tentativeG >= prevG) continue;

      gScore.set(key, tentativeG);
      parent.set(key, current);
      heap.push({ pos: neighbor, f: tentativeG + heuristic(neighbor, goal) });
    }
  }

  // No path found
  return null;
}

/** Manhattan distance heuristic (admissible for 4-connected grid). */
function heuristic(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) * 10;
}

// ---- Binary min-heap for A* open set ----

interface HeapEntry {
  pos: Position;
  f: number;
}

class MinHeap {
  private data: HeapEntry[] = [];

  get size(): number { return this.data.length; }

  push(entry: HeapEntry): void {
    this.data.push(entry);
    this._bubbleUp(this.data.length - 1);
  }

  pop(): HeapEntry | undefined {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0 && last) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  private _bubbleUp(i: number): void {
    const d = this.data;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (d[p]!.f <= d[i]!.f) break;
      [d[p], d[i]] = [d[i]!, d[p]!];
      i = p;
    }
  }

  private _sinkDown(i: number): void {
    const d = this.data;
    const n = d.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && d[l]!.f < d[smallest]!.f) smallest = l;
      if (r < n && d[r]!.f < d[smallest]!.f) smallest = r;
      if (smallest === i) break;
      [d[i], d[smallest]] = [d[smallest]!, d[i]!];
      i = smallest;
    }
  }
}

/** Check if two positions are adjacent (Manhattan distance 1, same z-level). */
function isAdjacentTo(a: Position, b: Position): boolean {
  if (a.z !== b.z) return false;
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return (dx + dy) === 1;
}

/** Trace parent chain back to find the first step from start. */
function traceFirstStep(start: Position, end: Position, parent: Map<string, Position>): Position {
  let current = end;
  let prev = parent.get(posKey(current));

  while (prev && !(prev.x === start.x && prev.y === start.y && prev.z === start.z)) {
    current = prev;
    prev = parent.get(posKey(current));
  }

  return current;
}

/** Manhattan distance between two positions (ignoring z for simplicity). */
export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) * 10;
}
