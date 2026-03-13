import { WORLD_WIDTH, WORLD_HEIGHT } from '@core/constants'

export type RiverData = {
  /** 1 = river tile, size = width * height */
  isRiver:  Uint8Array
  /** 1 = lake tile */
  isLake:   Uint8Array
  /** Flow accumulation value per tile */
  flowAcc:  Float32Array
}

const RIVER_THRESHOLD = 64

/** Encode (x, y) as a single index */
function idx(x: number, y: number, width: number): number {
  return y * width + x
}

// 8 directional offsets
const DX = [-1, 0, 1, -1, 1, -1, 0, 1]
const DY = [-1, -1, -1, 0, 0, 1, 1, 1]

/**
 * Generate rivers and lakes using flow accumulation on the heightmap.
 */
export function generateRivers(
  heightmap: Float32Array,
  seed: number,
  width: number = WORLD_WIDTH,
  height: number = WORLD_HEIGHT,
): RiverData {
  // Suppress unused seed (may be used for future jitter)
  void seed

  const size = width * height
  const isRiver  = new Uint8Array(size)
  const isLake   = new Uint8Array(size)
  const flowAcc  = new Float32Array(size)

  // Initialize flow accumulation to 1 per cell
  for (let i = 0; i < size; i++) {
    flowAcc[i] = 1
  }

  // Compute flow direction: for each cell, find the lowest neighbor
  // flowDir[i] = neighbor index, or -1 if no lower neighbor
  const flowDir = new Int32Array(size).fill(-1)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width)
      const elev = heightmap[i] ?? 0

      // Ocean tiles don't generate rivers
      if (elev < 0.35) continue

      let lowestElev = elev
      let lowestIdx = -1

      for (let d = 0; d < 8; d++) {
        const nx = x + (DX[d] ?? 0)
        const ny = y + (DY[d] ?? 0)
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
        const ni = idx(nx, ny, width)
        const ne = heightmap[ni] ?? 0
        if (ne < lowestElev) {
          lowestElev = ne
          lowestIdx = ni
        }
      }

      flowDir[i] = lowestIdx
    }
  }

  // Process cells from highest to lowest elevation.
  // Each cell passes its accumulated flow to its downstream (lower) neighbor.
  // This ensures all upstream contributions are collected before passing forward.
  const order = Array.from({ length: size }, (_, i) => i)
  order.sort((a, b) => {
    const ea = heightmap[a] ?? 0
    const eb = heightmap[b] ?? 0
    return eb - ea  // HIGH to LOW
  })

  for (let k = 0; k < order.length; k++) {
    const i = order[k]!
    const elev = heightmap[i] ?? 0
    if (elev < 0.35) continue  // ocean

    const downstream = flowDir[i] ?? -1
    if (downstream !== -1) {
      const current = flowAcc[i] ?? 1
      flowAcc[downstream] = (flowAcc[downstream] ?? 1) + current
    }
  }

  // Mark river tiles: flowAcc > RIVER_THRESHOLD and not ocean
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width)
      const elev = heightmap[i] ?? 0
      if (elev < 0.35) continue

      const acc = flowAcc[i] ?? 1
      if (acc > RIVER_THRESHOLD) {
        isRiver[i] = 1
      }
    }
  }

  // Lakes: cells with no lower neighbor, not ocean, not already a river
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width)
      const elev = heightmap[i] ?? 0
      if (elev < 0.35) continue
      if (flowDir[i] === -1 && isRiver[i] === 0) {
        isLake[i] = 1
      }
    }
  }

  return { isRiver, isLake, flowAcc }
}
