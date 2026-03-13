import { describe, it, expect } from 'vitest'
import { addEntity, addComponent } from 'bitecs'
import { createGameWorld } from '@core/world'
import { Position } from '@core/components/position'
import { movementSystem } from '@systems/movementSystem'
import { WORLD_WIDTH, WORLD_HEIGHT } from '@core/constants'

describe('movementSystem', () => {
  it('keeps all entities within world bounds after many ticks', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, Position)
    Position.x[eid] = 0
    Position.y[eid] = 0
    Position.z[eid] = 0

    for (let i = 0; i < 1000; i++) {
      movementSystem(world, 1 / 20)
    }

    expect(Position.x[eid]).toBeGreaterThanOrEqual(0)
    expect(Position.x[eid] ?? 0).toBeLessThan(WORLD_WIDTH)
    expect(Position.y[eid]).toBeGreaterThanOrEqual(0)
    expect(Position.y[eid] ?? 0).toBeLessThan(WORLD_HEIGHT)
  })

  it('keeps entity at map edge within bounds', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, Position)
    Position.x[eid] = WORLD_WIDTH - 1
    Position.y[eid] = WORLD_HEIGHT - 1
    Position.z[eid] = 0

    for (let i = 0; i < 200; i++) {
      movementSystem(world, 1 / 20)
    }

    expect(Position.x[eid]).toBeGreaterThanOrEqual(0)
    expect(Position.x[eid] ?? 0).toBeLessThan(WORLD_WIDTH)
    expect(Position.y[eid]).toBeGreaterThanOrEqual(0)
    expect(Position.y[eid] ?? 0).toBeLessThan(WORLD_HEIGHT)
  })

  it('moves entity over time (not stuck)', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, Position)
    Position.x[eid] = 64
    Position.y[eid] = 64
    Position.z[eid] = 0

    for (let i = 0; i < 200; i++) {
      movementSystem(world, 1 / 20)
    }

    // P(never moving in 200 ticks) ≈ (1/5)^200 — negligible
    const finalX = Position.x[eid] ?? 64
    const finalY = Position.y[eid] ?? 64
    expect(finalX !== 64 || finalY !== 64).toBe(true)
  })

  it('does not throw when no entities have Position', () => {
    const world = createGameWorld()
    addEntity(world) // entity without Position
    expect(() => movementSystem(world, 1 / 20)).not.toThrow()
  })

  it('does not change z coordinate', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, Position)
    Position.x[eid] = 64
    Position.y[eid] = 64
    Position.z[eid] = 2

    for (let i = 0; i < 100; i++) {
      movementSystem(world, 1 / 20)
    }

    expect(Position.z[eid]).toBe(2)
  })
})
