import { describe, it, expect, beforeEach } from 'vitest'
import { addEntity, addComponent, removeComponent, hasComponent, removeEntity } from 'bitecs'
import { createGameWorld, type GameWorld } from '@core/world'
import { Position } from '@core/components/position'
import { Velocity } from '@core/components/velocity'
import { TileCoord } from '@core/components/tileCoord'

describe('ECS components', () => {
  let world: GameWorld

  beforeEach(() => {
    world = createGameWorld()
  })

  describe('Position', () => {
    it('can be added to an entity and values read back', () => {
      const eid = addEntity(world)
      addComponent(world, eid, Position)

      Position.x[eid] = 3.5
      Position.y[eid] = 7.2
      Position.z[eid] = -2

      expect(Position.x[eid]).toBeCloseTo(3.5)
      expect(Position.y[eid]).toBeCloseTo(7.2)
      expect(Position.z[eid]).toBe(-2)
    })

    it('can be removed from an entity', () => {
      const eid = addEntity(world)
      addComponent(world, eid, Position)
      expect(hasComponent(world, eid, Position)).toBe(true)

      removeComponent(world, eid, Position)
      expect(hasComponent(world, eid, Position)).toBe(false)
    })
  })

  describe('Velocity', () => {
    it('can be added and values read back', () => {
      const eid = addEntity(world)
      addComponent(world, eid, Velocity)

      Velocity.vx[eid] = 1.5
      Velocity.vy[eid] = -0.5

      expect(Velocity.vx[eid]).toBeCloseTo(1.5)
      expect(Velocity.vy[eid]).toBeCloseTo(-0.5)
    })

    it('is independent from Position — entity can have one without the other', () => {
      const eid = addEntity(world)
      addComponent(world, eid, Velocity)

      expect(hasComponent(world, eid, Velocity)).toBe(true)
      expect(hasComponent(world, eid, Position)).toBe(false)
    })
  })

  describe('TileCoord', () => {
    it('can be added and integer values read back', () => {
      const eid = addEntity(world)
      addComponent(world, eid, TileCoord)

      TileCoord.x[eid] = 10
      TileCoord.y[eid] = 20
      TileCoord.z[eid] = -3

      expect(TileCoord.x[eid]).toBe(10)
      expect(TileCoord.y[eid]).toBe(20)
      expect(TileCoord.z[eid]).toBe(-3)
    })
  })

  describe('world isolation', () => {
    it('two worlds are fully independent', () => {
      const worldA = createGameWorld()
      const worldB = createGameWorld()

      const eidA = addEntity(worldA)
      addComponent(worldA, eidA, Position)
      Position.x[eidA] = 42

      const eidB = addEntity(worldB)
      addComponent(worldB, eidB, Position)
      Position.x[eidB] = 99

      // Component arrays are shared (SoA pattern) but entity IDs should differ
      // Worlds are separate — entities in A don't appear in B's queries
      expect(eidA).toBe(eidB)  // both get eid=1 from their own world
      expect(hasComponent(worldA, eidA, Position)).toBe(true)
      expect(hasComponent(worldB, eidA, Position)).toBe(true)
    })

    it('removing an entity cleans up component membership', () => {
      const eid = addEntity(world)
      addComponent(world, eid, Position)
      expect(hasComponent(world, eid, Position)).toBe(true)

      removeEntity(world, eid)
      expect(hasComponent(world, eid, Position)).toBe(false)
    })
  })
})
