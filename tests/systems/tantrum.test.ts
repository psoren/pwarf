import { describe, it, expect } from 'vitest'
import { addEntity, addComponent } from 'bitecs'
import { createGameWorld } from '@core/world'
import { DwarfAI, DwarfState } from '@core/components/dwarf'
import { tantrumsSystem } from '@systems/tantrumsSystem'
import { thoughtStore } from '@core/stores'

describe('tantrumsSystem', () => {
  it('counts down tantrum timer each tick', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, DwarfAI)
    DwarfAI.state[eid] = DwarfState.Tantrum
    DwarfAI.tantrumTimer[eid] = 50

    tantrumsSystem(world, 0)
    expect(DwarfAI.tantrumTimer[eid]).toBe(49)
  })

  it('returns dwarf to Idle when timer reaches 0', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, DwarfAI)
    DwarfAI.state[eid] = DwarfState.Tantrum
    DwarfAI.tantrumTimer[eid] = 1

    tantrumsSystem(world, 100)
    expect(DwarfAI.state[eid] as DwarfState).toBe(DwarfState.Idle)
    expect(DwarfAI.tantrumTimer[eid]).toBe(0)
  })

  it('adds recovery thought when tantrum ends', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, DwarfAI)
    DwarfAI.state[eid] = DwarfState.Tantrum
    DwarfAI.tantrumTimer[eid] = 1
    thoughtStore.clear()

    tantrumsSystem(world, 200)

    const thoughts = thoughtStore.get(eid) ?? []
    expect(thoughts.some(t => t.description === 'recovered from tantrum')).toBe(true)
  })

  it('does not affect non-tantruming dwarves', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, DwarfAI)
    DwarfAI.state[eid] = DwarfState.Idle
    DwarfAI.tantrumTimer[eid] = 50

    tantrumsSystem(world, 0)
    expect(DwarfAI.tantrumTimer[eid]).toBe(50)  // unchanged
  })

  it('does not go below 0', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, DwarfAI)
    DwarfAI.state[eid] = DwarfState.Tantrum
    DwarfAI.tantrumTimer[eid] = 0

    tantrumsSystem(world, 0)
    expect(DwarfAI.tantrumTimer[eid]).toBe(0)
    expect(DwarfAI.state[eid] as DwarfState).toBe(DwarfState.Idle)
  })
})
