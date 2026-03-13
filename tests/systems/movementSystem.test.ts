import { describe, it, expect, beforeEach } from 'vitest'
import { addEntity, addComponent } from 'bitecs'
import { createGameWorld } from '@core/world'
import type { GameWorld } from '@core/world'
import { Position } from '@core/components/position'
import { TileCoord } from '@core/components/tileCoord'
import { DwarfAI, DwarfState } from '@core/components/dwarf'
import { movementSystem } from '@systems/movementSystem'
import { pathStore, pathIndexStore } from '@core/stores'
import type { Coord3 } from '@systems/pathfinding'

function makeEntity(world: GameWorld, x: number, y: number, z: number): number {
  const eid = addEntity(world)
  addComponent(world, eid, Position)
  addComponent(world, eid, TileCoord)
  addComponent(world, eid, DwarfAI)
  Position.x[eid] = x
  Position.y[eid] = y
  Position.z[eid] = z
  TileCoord.x[eid] = x
  TileCoord.y[eid] = y
  TileCoord.z[eid] = z
  DwarfAI.state[eid] = DwarfState.Idle
  return eid
}

describe('movementSystem (path-following)', () => {
  let world: GameWorld

  beforeEach(() => {
    world = createGameWorld()
    pathStore.clear()
    pathIndexStore.clear()
  })

  it('advances entity along its path each tick', () => {
    const eid = makeEntity(world, 0, 0, 0)
    const path: Coord3[] = [
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 3, y: 0, z: 0 },
    ]
    pathStore.set(eid, path)
    pathIndexStore.set(eid, 0)

    movementSystem(world, 1 / 20)
    expect(Position.x[eid]).toBe(1)
    expect(Position.y[eid]).toBe(0)

    movementSystem(world, 1 / 20)
    expect(Position.x[eid]).toBe(2)
    expect(Position.y[eid]).toBe(0)

    movementSystem(world, 1 / 20)
    expect(Position.x[eid]).toBe(3)
    expect(Position.y[eid]).toBe(0)
  })

  it('updates TileCoord when following a path', () => {
    const eid = makeEntity(world, 5, 5, 0)
    const path: Coord3[] = [
      { x: 5, y: 6, z: 0 },
      { x: 5, y: 7, z: 0 },
    ]
    pathStore.set(eid, path)
    pathIndexStore.set(eid, 0)

    movementSystem(world, 1 / 20)
    expect(TileCoord.x[eid]).toBe(5)
    expect(TileCoord.y[eid]).toBe(6)

    movementSystem(world, 1 / 20)
    expect(TileCoord.x[eid]).toBe(5)
    expect(TileCoord.y[eid]).toBe(7)
  })

  it('clears pathStore when path is complete', () => {
    const eid = makeEntity(world, 0, 0, 0)
    const path: Coord3[] = [{ x: 1, y: 0, z: 0 }]
    pathStore.set(eid, path)
    pathIndexStore.set(eid, 0)

    movementSystem(world, 1 / 20)
    expect(pathStore.has(eid)).toBe(false)
    expect(pathIndexStore.has(eid)).toBe(false)
  })

  it('does not move entity when no path is set', () => {
    const eid = makeEntity(world, 10, 10, 0)

    movementSystem(world, 1 / 20)
    movementSystem(world, 1 / 20)
    movementSystem(world, 1 / 20)

    expect(Position.x[eid]).toBe(10)
    expect(Position.y[eid]).toBe(10)
  })

  it('converts storageZ to negative Position.z convention', () => {
    const eid = makeEntity(world, 0, 0, 0)
    const path: Coord3[] = [{ x: 1, y: 0, z: 2 }]  // storageZ=2 → Position.z=-2
    pathStore.set(eid, path)
    pathIndexStore.set(eid, 0)

    movementSystem(world, 1 / 20)
    expect(Position.z[eid]).toBe(-2)
    expect(TileCoord.z[eid]).toBe(-2)
  })

  it('skips Dead dwarves', () => {
    const eid = makeEntity(world, 5, 5, 0)
    DwarfAI.state[eid] = DwarfState.Dead
    const path: Coord3[] = [{ x: 6, y: 5, z: 0 }]
    pathStore.set(eid, path)
    pathIndexStore.set(eid, 0)

    movementSystem(world, 1 / 20)
    expect(Position.x[eid]).toBe(5)  // did not move
  })

  it('does not throw when no entities have DwarfAI', () => {
    const e = addEntity(world)
    addComponent(world, e, Position)
    Position.x[e] = 0
    Position.y[e] = 0
    expect(() => movementSystem(world, 1 / 20)).not.toThrow()
  })
})
