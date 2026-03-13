import type { World3D } from '@map/world3d'
import { getTile } from '@map/world3d'
import { TileType } from '@map/tileTypes'

export type Coord3 = { x: number; y: number; z: number }  // z is storageZ (0=surface)

export function isTilePassable(tile: TileType): boolean {
  return (
    tile === TileType.Air   ||
    tile === TileType.Soil  ||
    tile === TileType.Water ||
    tile === TileType.Floor ||
    tile === TileType.Grass ||
    tile === TileType.Sand  ||
    tile === TileType.Snow
  )
}

/**
 * Binary min-heap for A* open set.
 */
class MinHeap {
  private data: Array<{ idx: number; cost: number }> = []

  push(idx: number, cost: number): void {
    this.data.push({ idx, cost })
    this._bubbleUp(this.data.length - 1)
  }

  pop(): { idx: number; cost: number } | undefined {
    const top = this.data[0]
    const last = this.data.pop()
    if (this.data.length > 0 && last !== undefined) {
      this.data[0] = last
      this._sinkDown(0)
    }
    return top
  }

  get size(): number {
    return this.data.length
  }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1
      if ((this.data[parent]?.cost ?? Infinity) <= (this.data[i]?.cost ?? Infinity)) break
      const tmp = this.data[parent]!
      this.data[parent] = this.data[i]!
      this.data[i] = tmp
      i = parent
    }
  }

  private _sinkDown(i: number): void {
    const n = this.data.length
    while (true) {
      const l = 2 * i + 1
      const r = 2 * i + 2
      let smallest = i
      if (l < n && (this.data[l]?.cost ?? Infinity) < (this.data[smallest]?.cost ?? Infinity)) smallest = l
      if (r < n && (this.data[r]?.cost ?? Infinity) < (this.data[smallest]?.cost ?? Infinity)) smallest = r
      if (smallest === i) break
      const tmp = this.data[i]!
      this.data[i] = this.data[smallest]!
      this.data[smallest] = tmp
      i = smallest
    }
  }
}

/**
 * A* pathfinding on a 3D tile grid (4-directional, single z-level).
 * @param map  The World3D tile map
 * @param from Start coordinate (storageZ)
 * @param to   End coordinate (storageZ)
 * @returns Array of Coord3 waypoints NOT including start, including destination.
 *          Returns [] if from === to. Returns null if no path found.
 */
export function findPath(map: World3D, from: Coord3, to: Coord3): Coord3[] | null {
  if (from.x === to.x && from.y === to.y && from.z === to.z) {
    return []
  }

  const W = map.width
  const H = map.height
  const z = from.z  // single z-level for now

  // Flat index: y * W + x (within the z-level)
  const toIdx = to.y * W + to.x
  const fromIdx = from.y * W + from.x

  const MAX_ITER = 10_000
  const size = W * H

  const gCost   = new Float32Array(size).fill(Infinity)
  const visited = new Uint8Array(size)
  const parent  = new Int32Array(size).fill(-1)

  gCost[fromIdx] = 0
  const open = new MinHeap()
  const heuristic = (x: number, y: number): number =>
    Math.abs(x - to.x) + Math.abs(y - to.y)

  open.push(fromIdx, heuristic(from.x, from.y))

  let iter = 0
  const DIRS = [
    { dx: 0, dy: -1 },
    { dx: 0, dy:  1 },
    { dx: -1, dy: 0 },
    { dx:  1, dy: 0 },
  ]

  while (open.size > 0 && iter < MAX_ITER) {
    iter++
    const curr = open.pop()!
    const currIdx = curr.idx

    if (currIdx === toIdx) {
      // Reconstruct path
      const path: Coord3[] = []
      let ci = currIdx
      while (ci !== fromIdx) {
        const cx = ci % W
        const cy = Math.floor(ci / W)
        path.push({ x: cx, y: cy, z })
        const p = parent[ci]
        if (p === undefined || p < 0) break
        ci = p
      }
      path.reverse()
      return path
    }

    if (visited[currIdx]) continue
    visited[currIdx] = 1

    const cx = currIdx % W
    const cy = Math.floor(currIdx / W)
    const currG = gCost[currIdx] ?? Infinity

    for (const dir of DIRS) {
      const nx = cx + dir.dx
      const ny = cy + dir.dy
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue

      const nIdx = ny * W + nx
      if (visited[nIdx]) continue

      const tile = getTile(nx, ny, z, map)
      // Destination tile may not be passable (e.g. mining adjacent tile)
      const isPassable = isTilePassable(tile)
      const isDest = nIdx === toIdx
      if (!isPassable && !isDest) continue

      const newG = currG + 1
      if (newG < (gCost[nIdx] ?? Infinity)) {
        gCost[nIdx] = newG
        parent[nIdx] = currIdx
        open.push(nIdx, newG + heuristic(nx, ny))
      }
    }
  }

  return null
}
