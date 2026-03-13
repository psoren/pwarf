import { query } from 'bitecs'
import type { GameWorld } from '@core/world'
import type { World3D } from '@map/world3d'
import { getTile } from '@map/world3d'
import { Position } from '@core/components/position'
import { TileCoord } from '@core/components/tileCoord'
import { DwarfAI, DwarfState } from '@core/components/dwarf'
import { pathStore, pathIndexStore } from '@core/stores'
import { isTilePassable } from '@systems/pathfinding'
import { WORLD_WIDTH, WORLD_HEIGHT } from '@core/constants'

const WANDER_CHANCE = 0.15  // 15% chance to take a wander step each tick when Idle

const WANDER_DIRS = [
  { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
  { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
]

/**
 * Path-following movement system.
 * Each tick, advance each dwarf one step along their stored path.
 * Idle dwarves with no path wander randomly at a slow rate.
 */
export function movementSystem(world: GameWorld, _dt: number, map?: World3D): void {
  const entities = query(world, [Position, DwarfAI])
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]!
    if ((DwarfAI.state[eid] as DwarfState) === DwarfState.Dead) continue

    const path = pathStore.get(eid)
    if (path && path.length > 0) {
      // Follow existing path
      const idx = pathIndexStore.get(eid) ?? 0
      if (idx >= path.length) {
        pathStore.delete(eid)
        pathIndexStore.delete(eid)
        continue
      }

      const next = path[idx]!
      // next.z is storageZ (0=surface); Position.z and TileCoord.z use negative convention
      Position.x[eid] = next.x
      Position.y[eid] = next.y
      Position.z[eid] = -next.z
      TileCoord.x[eid] = next.x
      TileCoord.y[eid] = next.y
      TileCoord.z[eid] = -next.z

      pathIndexStore.set(eid, idx + 1)
      if (idx + 1 >= path.length) {
        pathStore.delete(eid)
        pathIndexStore.delete(eid)
      }
      continue
    }

    // No path — idle wander
    if ((DwarfAI.state[eid] as DwarfState) !== DwarfState.Idle) continue
    if (!map) continue
    if (Math.random() > WANDER_CHANCE) continue

    const cx = TileCoord.x[eid] ?? 0
    const cy = TileCoord.y[eid] ?? 0
    const cz = Math.abs(TileCoord.z[eid] ?? 0)

    // Pick a random passable neighbor
    const shuffled = WANDER_DIRS.slice().sort(() => Math.random() - 0.5)
    for (const { dx, dy } of shuffled) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 0 || nx >= WORLD_WIDTH || ny < 0 || ny >= WORLD_HEIGHT) continue
      if (!isTilePassable(getTile(nx, ny, cz, map))) continue
      Position.x[eid] = nx
      Position.y[eid] = ny
      TileCoord.x[eid] = nx
      TileCoord.y[eid] = ny
      break
    }
  }
}
