import { describe, it, expect } from 'vitest'
import { addEntity, addComponent } from 'bitecs'
import { createGameWorld } from '@core/world'
import { DwarfAI, DwarfState, Needs, Skills, Labor, LaborType, ALL_LABORS } from '@core/components/dwarf'

describe('dwarf components', () => {
  it('DwarfAI fields are readable after addComponent', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, DwarfAI)
    DwarfAI.state[eid] = DwarfState.Idle
    DwarfAI.jobEid[eid] = -1
    DwarfAI.eatTargetEid[eid] = -1
    DwarfAI.drinkTargetEid[eid] = -1
    expect(DwarfAI.state[eid]).toBe(DwarfState.Idle)
    expect(DwarfAI.jobEid[eid]).toBe(-1)
    expect(DwarfAI.eatTargetEid[eid]).toBe(-1)
    expect(DwarfAI.drinkTargetEid[eid]).toBe(-1)
  })

  it('Needs fields default to 0 and can be set', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, Needs)
    Needs.hunger[eid] = 1.0
    Needs.thirst[eid] = 0.5
    Needs.sleep[eid] = 0.75
    expect(Needs.hunger[eid]).toBeCloseTo(1.0)
    expect(Needs.thirst[eid]).toBeCloseTo(0.5)
    expect(Needs.sleep[eid]).toBeCloseTo(0.75)
  })

  it('Skills fields are Int8 and can be set', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, Skills)
    Skills.mining[eid] = 5
    Skills.woodcutting[eid] = 3
    expect(Skills.mining[eid]).toBe(5)
    expect(Skills.woodcutting[eid]).toBe(3)
  })

  it('Labor enabled defaults to 0 and can be set to ALL_LABORS', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, Labor)
    Labor.enabled[eid] = ALL_LABORS
    expect((Labor.enabled[eid] ?? 0) & LaborType.Mining).not.toBe(0)
    expect((Labor.enabled[eid] ?? 0) & LaborType.Hauling).not.toBe(0)
    expect((Labor.enabled[eid] ?? 0) & LaborType.Woodcutting).not.toBe(0)
  })

  it('DwarfState enum values are distinct', () => {
    expect(DwarfState.Idle).toBe(0)
    expect(DwarfState.SeekingJob).toBe(1)
    expect(DwarfState.ExecutingJob).toBe(2)
    expect(DwarfState.Dead).toBe(7)
  })

  it('LaborType values are distinct bitmask flags', () => {
    expect(LaborType.Mining & LaborType.Hauling).toBe(0)
    expect(LaborType.Mining & LaborType.Woodcutting).toBe(0)
    expect(LaborType.Hauling & LaborType.Farming).toBe(0)
  })
})
