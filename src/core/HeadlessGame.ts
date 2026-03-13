import { query, addEntity, addComponent, hasComponent } from 'bitecs'
import { createGameWorld } from '@core/world'
import type { GameWorld } from '@core/world'
import { createWorld3D, setTile } from '@map/world3d'
import type { World3D } from '@map/world3d'
import { TileType } from '@map/tileTypes'
import { WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH, TICKS_PER_SECOND } from '@core/constants'
import type { GameState, DwarfStatus, ItemCount } from '@core/types'
import { movementSystem } from '@systems/movementSystem'
import { needsDecaySystem } from '@systems/needsDecaySystem'
import { moodSystem } from '@systems/moodSystem'
import { dwarfAISystem } from '@systems/dwarfAISystem'
import { mineExecutionSystem } from '@systems/mineExecutionSystem'
import { haulingSystem } from '@systems/haulingSystem'
import { consumptionSystem } from '@systems/consumptionSystem'
import { sleepingSystem } from '@systems/sleepingSystem'
import { tantrumsSystem } from '@systems/tantrumsSystem'
import { jobCleanupSystem } from '@systems/jobSystem'
import { designateMine } from '@systems/mineDesignation'
import { designateStockpile } from '@systems/stockpile'
import { log } from '@core/logger'
import { setupEmbark } from '@entities/embarkSite'
import { Position } from '@core/components/position'
import { Needs, DwarfAI } from '@core/components/dwarf'
import { Mood } from '@core/components/mood'
import { Item, ItemType, ItemMaterial } from '@core/components/item'
import { generateWorld } from '@map/generators/worldGenOrchestrator'
import type { ProgressCallback } from '@map/generators/worldGenOrchestrator'

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
  private _tickCount = 0

  constructor(opts: HeadlessGameOpts) {
    this.seed = opts.seed
    this.width = opts.width ?? WORLD_WIDTH
    this.height = opts.height ?? WORLD_HEIGHT
    this.depth = opts.depth ?? WORLD_DEPTH
  }

  /**
   * Initialize the ECS world, generate the starting map (flat grass floor at z=0),
   * and spawn 7 dwarves at the center of the map on the surface.
   * Synchronous — safe for tests that run in Node without browser APIs.
   */
  embark(): void {
    this.world = createGameWorld()
    this.map = createWorld3D(this.width, this.height, this.depth)
    this._tickCount = 0

    // Lay grass at z=0 (surface) — passable ground for dwarves to walk on
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        setTile(x, y, 0, this.map, TileType.Grass)
      }
    }

    // Lay stone at underground levels z=1..depth-1
    const undergroundLevels = Math.min(5, this.depth - 1)
    for (let zLevel = 1; zLevel <= undergroundLevels; zLevel++) {
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

    // Use setupEmbark for dwarf placement
    setupEmbark(this.world, this.map, this.seed)

    log('info', 'embark.dwarves_spawned', {
      count: 7,
      centerX: Math.floor(this.width / 2),
      centerY: Math.floor(this.height / 2),
    })
  }

  /**
   * Async embark: generate a full procedural world, then place dwarves.
   * Use for gameplay; use embark() for tests.
   */
  async embarkAsync(onProgress?: ProgressCallback): Promise<void> {
    this.world = createGameWorld()
    this._tickCount = 0

    this.map = await generateWorld(
      this.seed,
      this.width,
      this.height,
      this.depth,
      onProgress,
    )

    setupEmbark(this.world, this.map, this.seed)

    log('info', 'embark.async.complete', {
      seed: this.seed,
      width: this.width,
      height: this.height,
      depth: this.depth,
    })
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
    if (this.world === null || this.map === null) {
      throw new Error('Call embark() before tick()')
    }
    const dt = 1 / TICKS_PER_SECOND

    needsDecaySystem(this.world)
    moodSystem(this.world, this._tickCount)
    dwarfAISystem(this.world, this.map, this._tickCount)
    mineExecutionSystem(this.world, this.map)
    haulingSystem(this.world, this.map)
    consumptionSystem(this.world, this.map, this._tickCount)
    sleepingSystem(this.world, this._tickCount)
    tantrumsSystem(this.world, this._tickCount)
    movementSystem(this.world, dt)
    jobCleanupSystem(this.world)

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
   * Designate a rectangular area of tiles for mining.
   */
  designateMineArea(
    x1: number, y1: number,
    x2: number, y2: number,
    storageZ: number,
  ): void {
    if (!this.world || !this.map) throw new Error('Call embark() first')
    const tiles: { x: number; y: number; z: number }[] = []
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        tiles.push({ x, y, z: storageZ })
      }
    }
    designateMine(this.world, this.map, tiles)
  }

  /**
   * Designate a rectangular stockpile zone.
   */
  designateStockpileArea(
    x1: number, y1: number,
    x2: number, y2: number,
    storageZ: number,
    categories: number,
  ): void {
    if (!this.world) throw new Error('Call embark() first')
    designateStockpile(this.world, x1, y1, x2, y2, storageZ, categories)
  }

  /**
   * Place an item entity in the world.
   * Returns the entity id.
   */
  placeItem(
    itemType: ItemType,
    material: ItemMaterial,
    x: number,
    y: number,
    storageZ: number,
  ): number {
    if (!this.world) throw new Error('Call embark() first')
    const eid = addEntity(this.world)
    addComponent(this.world, eid, Item)
    Item.itemType[eid] = itemType
    Item.material[eid] = material
    Item.quality[eid] = 1
    Item.carriedBy[eid] = -1
    Item.x[eid] = x
    Item.y[eid] = y
    Item.z[eid] = storageZ
    return eid
  }

  /**
   * Legacy designateMine — stores designation for compatibility with existing tests.
   * Use designateMineArea() for functional mine jobs.
   */
  designateMine(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): void {
    this._legacyDesignations.push({ x1, y1, z1, x2, y2, z2 })
  }

  /**
   * Returns the list of stored legacy mine designations (readable for tests).
   */
  getMineDesignations(): readonly { x1: number; y1: number; z1: number; x2: number; y2: number; z2: number }[] {
    return this._legacyDesignations
  }

  private _legacyDesignations: { x1: number; y1: number; z1: number; x2: number; y2: number; z2: number }[] = []

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

    const world = this.world
    const entities = query(world, [Position])
    const result: DwarfStatus[] = []

    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i]!
      result.push({
        eid,
        x: Position.x[eid] ?? 0,
        y: Position.y[eid] ?? 0,
        z: Position.z[eid] ?? 0,
        hunger:    hasComponent(world, eid, Needs)   ? (Needs.hunger[eid]     ?? 1) : 0,
        thirst:    hasComponent(world, eid, Needs)   ? (Needs.thirst[eid]     ?? 1) : 0,
        sleep:     hasComponent(world, eid, Needs)   ? (Needs.sleep[eid]      ?? 1) : 0,
        happiness: hasComponent(world, eid, Mood)    ? (Mood.happiness[eid]   ?? 1) : 1,
        job:       null,
        state:     hasComponent(world, eid, DwarfAI) ? (DwarfAI.state[eid]    ?? 0) : 0,
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
