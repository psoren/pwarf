import { addEntity, addComponent, query } from 'bitecs'
import { createGameWorld } from '@core/world'
import type { GameWorld } from '@core/world'
import { Position } from '@core/components/position'
import { createWorld3D, setTile } from '@map/world3d'
import type { World3D } from '@map/world3d'
import { TileType } from '@map/tileTypes'
import { WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH, TICKS_PER_SECOND } from '@core/constants'
import type { GameState, DwarfStatus, ItemCount } from '@core/types'
import { movementSystem } from '@systems/movementSystem'
import { log } from '@core/logger'

type MineDesignation = {
  x1: number; y1: number; z1: number
  x2: number; y2: number; z2: number
}

type HeadlessGameOpts = {
  seed: number
  width?: number
  height?: number
  depth?: number
}

/**
 * Programmatic, browser-free interface for running the game simulation.
 * Used by tests and CI. Zero DOM dependencies — no window, document, canvas,
 * or requestAnimationFrame.
 */
export class HeadlessGame {
  private readonly seed: number
  private readonly width: number
  private readonly height: number
  private readonly depth: number

  private world: GameWorld | null = null
  // Stored for future use by systems that need tile data
  private map: World3D | null = null
  private readonly mineDesignations: MineDesignation[] = []
  private _tickCount = 0

  constructor(opts: HeadlessGameOpts) {
    this.seed = opts.seed
    this.width = opts.width ?? WORLD_WIDTH
    this.height = opts.height ?? WORLD_HEIGHT
    this.depth = opts.depth ?? WORLD_DEPTH
  }

  /**
   * Initialize the ECS world, generate the starting map (flat stone floor at z=0),
   * and spawn 7 dwarves at the center of the map on the surface.
   */
  embark(): void {
    this.world = createGameWorld()
    this.map = createWorld3D(this.width, this.height, this.depth)
    this._tickCount = 0

    // Lay stone at z=0 (surface) and underground levels z=1..5
    const undergroundLevels = Math.min(5, this.depth - 1)
    for (let zLevel = 0; zLevel <= undergroundLevels; zLevel++) {
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          setTile(x, y, zLevel, this.map, TileType.Stone)
        }
      }
    }

    log('info', 'world.gen.complete', {
      seed: this.seed,
      width: this.width,
      height: this.height,
      depth: this.depth,
    })

    const centerX = Math.floor(this.width / 2)
    const centerY = Math.floor(this.height / 2)

    // Spawn 7 starting dwarves near the map center, scattered ±4 tiles
    for (let i = 0; i < 7; i++) {
      const eid = addEntity(this.world)
      addComponent(this.world, eid, Position)
      Position.x[eid] = centerX + Math.floor((Math.random() - 0.5) * 8)
      Position.y[eid] = centerY + Math.floor((Math.random() - 0.5) * 8)
      Position.z[eid] = 0
    }

    log('info', 'embark.dwarves_spawned', { count: 7, centerX, centerY })
  }

  /**
   * Returns the World3D tile map. Used by the renderer in browser context.
   * Throws if called before embark().
   */
  getMap(): World3D {
    if (this.map === null) {
      throw new Error('Call embark() before getMap()')
    }
    return this.map
  }

  /**
   * Advance the simulation by one tick and return the resulting GameState.
   * Runs synchronously — no browser APIs used.
   */
  tick(): GameState {
    if (this.world === null) {
      throw new Error('Call embark() before tick()')
    }
    const dt = 1 / TICKS_PER_SECOND
    movementSystem(this.world, dt)
    this._tickCount += 1
    return this._buildState()
  }

  /**
   * Run N ticks and return the final GameState.
   */
  runFor(ticks: number): GameState {
    if (this.world === null) {
      throw new Error('Call embark() before runFor()')
    }
    for (let i = 0; i < ticks; i++) {
      this.tick()
    }
    return this._buildState()
  }

  /**
   * Mark a cuboid region for mining. Stored for future jobSystem integration.
   */
  designateMine(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): void {
    this.mineDesignations.push({ x1, y1, z1, x2, y2, z2 })
  }

  /**
   * Returns the list of stored mine designations (readable for tests).
   */
  getMineDesignations(): readonly MineDesignation[] {
    return this.mineDesignations
  }

  /**
   * Returns current stock counts. Empty array until the stocks system is implemented.
   */
  getStocks(): ItemCount[] {
    return []
  }

  /**
   * Returns the status of all dwarf entities (entities that have a Position component).
   */
  getDwarves(): DwarfStatus[] {
    if (this.world === null) {
      throw new Error('Call embark() before getDwarves()')
    }

    const entities = query(this.world, [Position])
    const result: DwarfStatus[] = []

    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i]!
      result.push({
        eid,
        x: Position.x[eid] ?? 0,
        y: Position.y[eid] ?? 0,
        z: Position.z[eid] ?? 0,
        hunger: 0,
        thirst: 0,
        sleep: 0,
        happiness: 1,
        job: null,
      })
    }

    return result
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _buildState(): GameState {
    return {
      tick: this._tickCount,
      dwarves: this.getDwarves(),
      stocks: this.getStocks(),
    }
  }
}
