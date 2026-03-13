import { query } from 'bitecs'
import type { GameWorld } from '@core/world'
import { Needs, DwarfAI, DwarfState } from '@core/components/dwarf'
import { Mood } from '@core/components/mood'
import { thoughtStore } from '@core/stores'

/**
 * Update dwarf happiness based on needs and recent thoughts.
 */
export function moodSystem(world: GameWorld, currentTick: number): void {
  const entities = query(world, [Needs, Mood, DwarfAI])
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]!
    if ((DwarfAI.state[eid] as DwarfState) === DwarfState.Dead) continue

    const needsScore =
      ((Needs.hunger[eid] ?? 1) + (Needs.thirst[eid] ?? 1) + (Needs.sleep[eid] ?? 1)) / 3

    let thoughts = thoughtStore.get(eid) ?? []
    thoughts = thoughts.filter(t => currentTick - t.tick < 500)
    thoughtStore.set(eid, thoughts)

    const thoughtScore = thoughts.reduce((s, t) => s + t.moodDelta, 0)

    Mood.happiness[eid] = Math.max(0, Math.min(1, needsScore * 0.8 + 0.2 + thoughtScore))
  }
}
