import { query } from 'bitecs'
import type { GameWorld } from '@core/world'
import { Needs, DwarfAI, DwarfState } from '@core/components/dwarf'
import { HUNGER_DECAY_RATE, THIRST_DECAY_RATE, SLEEP_DECAY_RATE } from '@core/constants'

/**
 * Decay dwarf needs (hunger, thirst, sleep) each tick.
 */
export function needsDecaySystem(world: GameWorld): void {
  const entities = query(world, [Needs, DwarfAI])
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]!
    if ((DwarfAI.state[eid] as DwarfState) === DwarfState.Dead) continue

    Needs.hunger[eid] = Math.max(0, (Needs.hunger[eid] ?? 1) - HUNGER_DECAY_RATE)
    Needs.thirst[eid] = Math.max(0, (Needs.thirst[eid] ?? 1) - THIRST_DECAY_RATE)
    Needs.sleep[eid]  = Math.max(0, (Needs.sleep[eid]  ?? 1) - SLEEP_DECAY_RATE)
  }
}
