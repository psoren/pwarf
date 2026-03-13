import { query } from 'bitecs'
import type { GameWorld } from '@core/world'
import { Position } from '@core/components/position'
import { TileCoord } from '@core/components/tileCoord'
import { DwarfAI, DwarfState } from '@core/components/dwarf'
import { pathStore, pathIndexStore } from '@core/stores'

/**
 * Path-following movement system.
 * Each tick, advance each dwarf one step along their stored path.
 * Dwarves stand still if no path is set.
 */
export function movementSystem(world: GameWorld, _dt: number): void {
  const entities = query(world, [Position, DwarfAI])
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]!
    if ((DwarfAI.state[eid] as DwarfState) === DwarfState.Dead) continue

    const path = pathStore.get(eid)
    if (!path || path.length === 0) continue

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
  }
}
