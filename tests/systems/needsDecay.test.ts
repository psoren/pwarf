import { describe, it, expect } from 'vitest'
import { addEntity, addComponent } from 'bitecs'
import { createGameWorld } from '@core/world'
import { DwarfAI, DwarfState, Needs } from '@core/components/dwarf'
import { needsDecaySystem } from '@systems/needsDecaySystem'
import { HUNGER_DECAY_RATE, THIRST_DECAY_RATE, SLEEP_DECAY_RATE } from '@core/constants'

describe('needsDecaySystem', () => {
  it('decays hunger, thirst, sleep each tick', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, Needs)
    addComponent(world, eid, DwarfAI)
    DwarfAI.state[eid] = DwarfState.Idle
    Needs.hunger[eid] = 1.0
    Needs.thirst[eid] = 1.0
    Needs.sleep[eid] = 1.0

    needsDecaySystem(world)

    expect(Needs.hunger[eid]).toBeCloseTo(1.0 - HUNGER_DECAY_RATE)
    expect(Needs.thirst[eid]).toBeCloseTo(1.0 - THIRST_DECAY_RATE)
    expect(Needs.sleep[eid]).toBeCloseTo(1.0 - SLEEP_DECAY_RATE)
  })

  it('does not reduce needs below 0', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, Needs)
    addComponent(world, eid, DwarfAI)
    DwarfAI.state[eid] = DwarfState.Idle
    Needs.hunger[eid] = 0.0
    Needs.thirst[eid] = 0.0
    Needs.sleep[eid] = 0.0

    needsDecaySystem(world)

    expect(Needs.hunger[eid]).toBe(0)
    expect(Needs.thirst[eid]).toBe(0)
    expect(Needs.sleep[eid]).toBe(0)
  })

  it('skips dead dwarves', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, Needs)
    addComponent(world, eid, DwarfAI)
    DwarfAI.state[eid] = DwarfState.Dead
    Needs.hunger[eid] = 0.5
    Needs.thirst[eid] = 0.5
    Needs.sleep[eid] = 0.5

    needsDecaySystem(world)

    expect(Needs.hunger[eid]).toBeCloseTo(0.5)
    expect(Needs.thirst[eid]).toBeCloseTo(0.5)
    expect(Needs.sleep[eid]).toBeCloseTo(0.5)
  })
})
