import { describe, it, expect } from 'vitest'
import { addEntity, addComponent } from 'bitecs'
import { createGameWorld } from '@core/world'
import { DwarfAI, DwarfState, Needs } from '@core/components/dwarf'
import { Mood } from '@core/components/mood'
import { moodSystem } from '@systems/moodSystem'
import { thoughtStore, addThought } from '@core/stores'

describe('moodSystem', () => {
  it('sets happiness based on needs score', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, Needs)
    addComponent(world, eid, Mood)
    addComponent(world, eid, DwarfAI)
    DwarfAI.state[eid] = DwarfState.Idle
    Needs.hunger[eid] = 1.0
    Needs.thirst[eid] = 1.0
    Needs.sleep[eid] = 1.0
    Mood.happiness[eid] = 0.5

    moodSystem(world, 0)

    // needsScore = 1.0, so happiness = 1.0 * 0.8 + 0.2 = 1.0
    expect(Mood.happiness[eid]).toBeCloseTo(1.0)
  })

  it('reduces happiness when needs are low', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, Needs)
    addComponent(world, eid, Mood)
    addComponent(world, eid, DwarfAI)
    DwarfAI.state[eid] = DwarfState.Idle
    Needs.hunger[eid] = 0.0
    Needs.thirst[eid] = 0.0
    Needs.sleep[eid] = 0.0

    moodSystem(world, 0)

    // needsScore = 0, so happiness = 0 * 0.8 + 0.2 = 0.2
    expect(Mood.happiness[eid]).toBeCloseTo(0.2)
  })

  it('incorporates positive thoughts', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, Needs)
    addComponent(world, eid, Mood)
    addComponent(world, eid, DwarfAI)
    DwarfAI.state[eid] = DwarfState.Idle
    Needs.hunger[eid] = 0.5
    Needs.thirst[eid] = 0.5
    Needs.sleep[eid] = 0.5

    // Add a happy thought
    addThought(eid, 'ate a delicious meal', 0.2, 0)
    moodSystem(world, 10)

    // needsScore = 0.5, base happiness = 0.5 * 0.8 + 0.2 = 0.6
    // + 0.2 from thought = 0.8 (clamped to 1)
    expect(Mood.happiness[eid]).toBeGreaterThan(0.6)
  })

  it('ignores thoughts older than 500 ticks', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, Needs)
    addComponent(world, eid, Mood)
    addComponent(world, eid, DwarfAI)
    DwarfAI.state[eid] = DwarfState.Idle
    Needs.hunger[eid] = 1.0
    Needs.thirst[eid] = 1.0
    Needs.sleep[eid] = 1.0

    // Add an old thought (tick 0) and check at tick 600
    addThought(eid, 'old thought', 0.3, 0)
    moodSystem(world, 600)

    // Old thought should be pruned; happiness = 1.0 * 0.8 + 0.2 = 1.0
    expect(Mood.happiness[eid]).toBeCloseTo(1.0)
    const remaining = thoughtStore.get(eid) ?? []
    expect(remaining).toHaveLength(0)
  })

  it('clamps happiness between 0 and 1', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, Needs)
    addComponent(world, eid, Mood)
    addComponent(world, eid, DwarfAI)
    DwarfAI.state[eid] = DwarfState.Idle
    Needs.hunger[eid] = 1.0
    Needs.thirst[eid] = 1.0
    Needs.sleep[eid] = 1.0

    // Add many positive thoughts
    for (let i = 0; i < 20; i++) {
      addThought(eid, 'great', 0.5, i)
    }
    moodSystem(world, 100)
    expect(Mood.happiness[eid]).toBeLessThanOrEqual(1.0)

    // Add many negative thoughts
    thoughtStore.clear()
    for (let i = 0; i < 20; i++) {
      addThought(eid, 'terrible', -0.5, i)
    }
    Needs.hunger[eid] = 0.0
    Needs.thirst[eid] = 0.0
    Needs.sleep[eid] = 0.0
    moodSystem(world, 100)
    expect(Mood.happiness[eid]).toBeGreaterThanOrEqual(0.0)
  })

  it('skips dead dwarves', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, Needs)
    addComponent(world, eid, Mood)
    addComponent(world, eid, DwarfAI)
    DwarfAI.state[eid] = DwarfState.Dead
    Mood.happiness[eid] = 0.5
    Needs.hunger[eid] = 0.0
    Needs.thirst[eid] = 0.0
    Needs.sleep[eid] = 0.0

    moodSystem(world, 0)

    expect(Mood.happiness[eid]).toBeCloseTo(0.5)  // unchanged
  })
})
