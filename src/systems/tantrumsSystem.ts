import { query } from 'bitecs'
import type { GameWorld } from '@core/world'
import { DwarfAI, DwarfState } from '@core/components/dwarf'
import { addThought } from '@core/stores'

/**
 * System that handles dwarves in the Tantrum state.
 * Counts down tantrum timer and returns dwarf to Idle when done.
 */
export function tantrumsSystem(world: GameWorld, currentTick: number): void {
  const entities = query(world, [DwarfAI])
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]!
    if ((DwarfAI.state[eid] as DwarfState) !== DwarfState.Tantrum) continue

    DwarfAI.tantrumTimer[eid] = Math.max(0, (DwarfAI.tantrumTimer[eid] ?? 0) - 1)

    if ((DwarfAI.tantrumTimer[eid] ?? 0) <= 0) {
      DwarfAI.state[eid] = DwarfState.Idle
      addThought(eid, 'recovered from tantrum', 0.1, currentTick)
    }
  }
}
