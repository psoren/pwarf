import { describe, it, expect } from 'vitest'
import { addEntity, addComponent } from 'bitecs'
import { createGameWorld } from '@core/world'
import { DwarfAI, DwarfState, Needs } from '@core/components/dwarf'
import { sleepingSystem } from '@systems/sleepingSystem'
import { SLEEP_RESTORE_RATE } from '@core/constants'

describe('sleepingSystem', () => {
  it('restores sleep need each tick', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, DwarfAI)
    addComponent(world, eid, Needs)
    DwarfAI.state[eid] = DwarfState.Sleeping
    DwarfAI.sleepTimer[eid] = 1  // already sleeping
    Needs.sleep[eid] = 0.0

    sleepingSystem(world, 1)
    expect(Needs.sleep[eid]).toBeCloseTo(SLEEP_RESTORE_RATE)
  })

  it('wakes dwarf when sleep >= 0.99', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, DwarfAI)
    addComponent(world, eid, Needs)
    DwarfAI.state[eid] = DwarfState.Sleeping
    DwarfAI.sleepTimer[eid] = 1
    Needs.sleep[eid] = 0.995

    sleepingSystem(world, 100)
    expect(Needs.sleep[eid]).toBeGreaterThanOrEqual(0.99)
    expect(DwarfAI.state[eid] as DwarfState).toBe(DwarfState.Idle)
    expect(DwarfAI.sleepTimer[eid]).toBe(0)
  })

  it('does not affect non-sleeping dwarves', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, DwarfAI)
    addComponent(world, eid, Needs)
    DwarfAI.state[eid] = DwarfState.Idle
    Needs.sleep[eid] = 0.5

    sleepingSystem(world, 0)
    expect(Needs.sleep[eid]).toBeCloseTo(0.5)  // unchanged
  })

  it('sets sleepTimer on first tick asleep', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, DwarfAI)
    addComponent(world, eid, Needs)
    DwarfAI.state[eid] = DwarfState.Sleeping
    DwarfAI.sleepTimer[eid] = 0  // not yet started
    Needs.sleep[eid] = 0.0

    sleepingSystem(world, 0)
    expect(DwarfAI.sleepTimer[eid]).toBe(1)
  })

  it('caps sleep at 1.0', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, DwarfAI)
    addComponent(world, eid, Needs)
    DwarfAI.state[eid] = DwarfState.Sleeping
    DwarfAI.sleepTimer[eid] = 1
    Needs.sleep[eid] = 1.0  // already full

    sleepingSystem(world, 0)
    expect(Needs.sleep[eid]).toBeLessThanOrEqual(1.0)
  })
})
