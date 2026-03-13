import { query } from 'bitecs'
import type { GameWorld } from '@core/world'
import { DwarfAI, DwarfState, Needs } from '@core/components/dwarf'
import { addThought } from '@core/stores'
import { SLEEP_RESTORE_RATE } from '@core/constants'

/**
 * System that handles dwarves in the Sleeping state.
 * Restores sleep need over time and wakes them when rested.
 */
export function sleepingSystem(world: GameWorld, currentTick: number): void {
  const entities = query(world, [DwarfAI, Needs])
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]!
    if ((DwarfAI.state[eid] as DwarfState) !== DwarfState.Sleeping) continue

    Needs.sleep[eid] = Math.min(1.0, (Needs.sleep[eid] ?? 0) + SLEEP_RESTORE_RATE)

    if ((DwarfAI.sleepTimer[eid] ?? 0) === 0) {
      // First tick asleep
      DwarfAI.sleepTimer[eid] = 1
      addThought(eid, 'slept on the floor', -0.05, currentTick)
    }

    if ((Needs.sleep[eid] ?? 0) >= 0.99) {
      DwarfAI.sleepTimer[eid] = 0
      DwarfAI.state[eid] = DwarfState.Idle
    }
  }
}
