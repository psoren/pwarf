import { query } from 'bitecs'
import type { GameWorld } from '@core/world'
import { Position } from '@core/components/position'
import { WORLD_WIDTH, WORLD_HEIGHT } from '@core/constants'

/**
 * Random-walk movement system: each tick every dwarf moves to a random
 * adjacent tile or stays put (4 directions + idle = 5 outcomes).
 */
export function movementSystem(world: GameWorld, _dt: number): void {
  const entities = query(world, [Position])
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]!
    let nx = Position.x[eid] ?? 0
    let ny = Position.y[eid] ?? 0

    // 0 = stay, 1 = up, 2 = down, 3 = left, 4 = right
    const dir = Math.floor(Math.random() * 5)
    switch (dir) {
      case 1: ny -= 1; break
      case 2: ny += 1; break
      case 3: nx -= 1; break
      case 4: nx += 1; break
    }

    Position.x[eid] = Math.max(0, Math.min(WORLD_WIDTH - 1, nx))
    Position.y[eid] = Math.max(0, Math.min(WORLD_HEIGHT - 1, ny))
  }
}
