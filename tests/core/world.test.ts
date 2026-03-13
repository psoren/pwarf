import { describe, it, expect } from 'vitest'
import { createGameWorld } from '@core/world'

describe('createGameWorld', () => {
  it('creates a new ECS world', () => {
    const world = createGameWorld()
    expect(world).toBeDefined()
  })

  it('creates independent worlds', () => {
    const a = createGameWorld()
    const b = createGameWorld()
    expect(a).not.toBe(b)
  })
})
