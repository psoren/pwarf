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
  'flower',
  'spring',
  'glowing_moss',
  'fungal_growth',
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

/** Numeric position key for fast Set/Map lookups — avoids string allocation.
 * Encodes (x, y, z) into a single integer: (z+20)*512*512 + y*512 + x.
 * Valid for x,y ∈ [0,512) and z ∈ [-20, 1). */
export function posKey(p: Position): number {
  return (p.z + 20) * 262144 + p.y * 512 + p.x; // 262144 = 512*512
}

/**
 * Pathfinding from start to goal using BFS for short distances and A* for
 * long distances. BFS is faster per-node (O(1) queue ops) but explores in
 * all directions. A* uses a Manhattan heuristic to go directly toward the
 * goal, needing far fewer nodes for long paths.
 *
 * The algorithm is chosen based on Manhattan distance:
 * - Distance ≤ 100: BFS with 10k node limit (fast, covers most tasks)
 * - Distance > 100: A* with 20k node limit (directed, for cave entrances)
 *
 * @param adjacentToGoal If true, the path ends at any walkable tile adjacent
 *   to the goal (used for mining — you stand next to the wall, not inside it).
 *   If false, the path ends at the goal tile itself.
 */
const BFS_NODE_LIMIT = 10_000;
const ASTAR_NODE_LIMIT = 20_000;
const ASTAR_DISTANCE_THRESHOLD = 50;

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

  const dist = Math.abs(start.x - goal.x) + Math.abs(start.y - goal.y)
    + Math.abs(start.z - goal.z) * 10;

  if (dist > ASTAR_DISTANCE_THRESHOLD) {
    return astarSearch(start, goal, getTile, adjacentToGoal, zResolver, blockedTiles);
  }
  return bfsSearch(start, goal, getTile, adjacentToGoal, zResolver, blockedTiles);
}

/** BFS search — fast for short distances, O(1) per node. */
function bfsSearch(
  start: Position,
  goal: Position,
  getTile: TileLookup,
  adjacentToGoal: boolean,
  zResolver?: ZResolver,
  blockedTiles?: ReadonlySet<string>,
): Position | null {
  const visited = new Set<number>();
  const parent = new Map<number, Position>();

  const queue: Position[] = [start];
  visited.add(posKey(start));

  while (queue.length > 0) {
    if (visited.size >= BFS_NODE_LIMIT) {
      return null;
    }

    const current = queue.shift()!;
    const neighbors = getNeighbors(current, getTile, zResolver);

    for (const neighbor of neighbors) {
      const key = posKey(neighbor);
      if (visited.has(key)) continue;
      if (blockedTiles?.has(`${neighbor.x},${neighbor.y},${neighbor.z}`)) continue;
      visited.add(key);
      parent.set(key, current);

      const reached = adjacentToGoal
        ? isAdjacentTo(neighbor, goal)
        : (neighbor.x === goal.x && neighbor.y === goal.y && neighbor.z === goal.z);

      if (reached) {
        return traceFirstStep(start, neighbor, parent);
      }

      queue.push(neighbor);
    }
  }

  return null;
}

/** A* search — directed for long distances, O(log n) per node but visits far fewer. */
function astarSearch(
  start: Position,
  goal: Position,
  getTile: TileLookup,
  adjacentToGoal: boolean,
  zResolver?: ZResolver,
  blockedTiles?: ReadonlySet<string>,
): Position | null {
  const gScore = new Map<number, number>();
  const closed = new Set<number>();
  const parent = new Map<number, Position>();
  const startKey = posKey(start);
  gScore.set(startKey, 0);

  const heap = new MinHeap();
  heap.push({ pos: start, f: heuristic(start, goal) });

  while (heap.size > 0) {
    if (closed.size >= ASTAR_NODE_LIMIT) {
      return null;
    }

    const { pos: current } = heap.pop()!;
    const currentKey = posKey(current);

    if (closed.has(currentKey)) continue;
    closed.add(currentKey);

    const reached = adjacentToGoal
      ? isAdjacentTo(current, goal)
      : (current.x === goal.x && current.y === goal.y && current.z === goal.z);

    if (reached && closed.size > 1) {
      return traceFirstStep(start, current, parent);
    }

    const currentG = gScore.get(currentKey)!;
    const neighbors = getNeighbors(current, getTile, zResolver);

    for (const neighbor of neighbors) {
      const key = posKey(neighbor);
      if (closed.has(key)) continue;
      if (blockedTiles?.has(`${neighbor.x},${neighbor.y},${neighbor.z}`)) continue;

      const tentativeG = currentG + 1;
      const prevG = gScore.get(key);
      if (prevG !== undefined && tentativeG >= prevG) continue;

      gScore.set(key, tentativeG);
      parent.set(key, current);
      heap.push({ pos: neighbor, f: tentativeG + heuristic(neighbor, goal) });
    }
  }

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
function traceFirstStep(start: Position, end: Position, parent: Map<number, Position>): Position {
  let current = end;
  let prev = parent.get(posKey(current));

  while (prev && !(prev.x === start.x && prev.y === start.y && prev.z === start.z)) {
    current = prev;
    prev = parent.get(posKey(current));
  }

  return current;
}

/** Trace parent chain to build full path from start to end (excludes start). */
function traceFullPath(start: Position, end: Position, parent: Map<number, Position>): Position[] {
  const path: Position[] = [];
  let current = end;
  while (!(current.x === start.x && current.y === start.y && current.z === start.z)) {
    path.push(current);
    const prev = parent.get(posKey(current));
    if (!prev) break;
    current = prev;
  }
  path.reverse();
  return path;
}

/** Find the full path from start to goal. Returns the path (excluding start),
 * or null if no path found. Used for path caching. */
export function findFullPath(
  start: Position,
  goal: Position,
  getTile: TileLookup,
  adjacentToGoal = false,
  zResolver?: ZResolver,
): Position[] | null {
  if (start.x === goal.x && start.y === goal.y && start.z === goal.z) return [];
  if (adjacentToGoal && isAdjacentTo(start, goal)) return [];

  const dist = Math.abs(start.x - goal.x) + Math.abs(start.y - goal.y)
    + Math.abs(start.z - goal.z) * 10;

  if (dist > ASTAR_DISTANCE_THRESHOLD) {
    return astarFullPath(start, goal, getTile, adjacentToGoal, zResolver);
  }
  return bfsFullPath(start, goal, getTile, adjacentToGoal, zResolver);
}

function bfsFullPath(
  start: Position, goal: Position, getTile: TileLookup,
  adjacentToGoal: boolean, zResolver?: ZResolver,
): Position[] | null {
  const visited = new Set<number>();
  const parent = new Map<number, Position>();
  const queue: Position[] = [start];
  visited.add(posKey(start));

  while (queue.length > 0) {
    if (visited.size >= BFS_NODE_LIMIT) return null;
    const current = queue.shift()!;
    for (const neighbor of getNeighbors(current, getTile, zResolver)) {
      const key = posKey(neighbor);
      if (visited.has(key)) continue;
      visited.add(key);
      parent.set(key, current);
      const reached = adjacentToGoal
        ? isAdjacentTo(neighbor, goal)
        : (neighbor.x === goal.x && neighbor.y === goal.y && neighbor.z === goal.z);
      if (reached) return traceFullPath(start, neighbor, parent);
      queue.push(neighbor);
    }
  }
  return null;
}

function astarFullPath(
  start: Position, goal: Position, getTile: TileLookup,
  adjacentToGoal: boolean, zResolver?: ZResolver,
): Position[] | null {
  const gScore = new Map<number, number>();
  const closed = new Set<number>();
  const parent = new Map<number, Position>();
  const startKey = posKey(start);
  gScore.set(startKey, 0);
  const heap = new MinHeap();
  heap.push({ pos: start, f: heuristic(start, goal) });

  while (heap.size > 0) {
    if (closed.size >= ASTAR_NODE_LIMIT) return null;
    const { pos: current } = heap.pop()!;
    const currentKey = posKey(current);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);
    const reached = adjacentToGoal
      ? isAdjacentTo(current, goal)
      : (current.x === goal.x && current.y === goal.y && current.z === goal.z);
    if (reached && closed.size > 1) return traceFullPath(start, current, parent);
    const currentG = gScore.get(currentKey)!;
    for (const neighbor of getNeighbors(current, getTile, zResolver)) {
      const key = posKey(neighbor);
      if (closed.has(key)) continue;
      const tentativeG = currentG + 1;
      const prevG = gScore.get(key);
      if (prevG !== undefined && tentativeG >= prevG) continue;
      gScore.set(key, tentativeG);
      parent.set(key, current);
      heap.push({ pos: neighbor, f: tentativeG + heuristic(neighbor, goal) });
    }
  }
  return null;
}

/** Manhattan distance between two positions (ignoring z for simplicity). */
export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) * 10;
}
