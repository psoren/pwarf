import { createWorld, type World } from 'bitecs'

export type GameWorld = World

/**
 * Creates and returns a new ECS world.
 * Call once at game startup; pass the world instance to all systems and queries.
 *
 * bitecs v0.4 API notes (differs from v0.3):
 *   - Components are plain typed arrays/objects — no defineComponent()
 *   - addComponent(world, eid, component)  ← eid comes before component
 *   - query(world, [Component])            ← call directly each tick, no defineQuery()
 *   - observe(world, onAdd(Comp), cb)      ← replaces enterQuery / exitQuery
 */
export function createGameWorld(): GameWorld {
  return createWorld()
}
