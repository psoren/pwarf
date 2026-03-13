import { addEntity, addComponent } from 'bitecs'
import type { GameWorld } from '@core/world'
import type { World3D } from '@map/world3d'
import { getTile } from '@map/world3d'
import { TileType } from '@map/tileTypes'
import { Position } from '@core/components/position'
import { TileCoord } from '@core/components/tileCoord'
import { DwarfAI, DwarfState, Needs, Skills, Labor, ALL_LABORS } from '@core/components/dwarf'
import { Mood } from '@core/components/mood'
import { Item, ItemType, ItemMaterial } from '@core/components/item'
import { Patch } from '@core/components/patch'
import { nameStore } from '@core/stores'
import { mulberry32 } from '@map/biomes'

const PATCH_INTERVAL = 200  // ticks between item spawns (~10s at 20 ticks/sec)

const DWARF_FIRST = ['Urist', 'Bomrek', 'Meng', 'Sibrek', 'Ber', 'Doren', 'Vucar']
const DWARF_LAST  = ['Oilystockade', 'Hammerstone', 'Claspedtome', 'Inkdagger', 'Bravefists', 'Stonebraid', 'Goldenaxe']

export type EmbarkResult = {
  dwarfEids: number[]
  siteX: number
  siteY: number
}

/**
 * Find a suitable embark site on the map and spawn 7 dwarves there.
 * The site is a non-Water, non-Stone (mountain peak) tile at z=0.
 */
export function setupEmbark(world: GameWorld, map: World3D, seed: number): EmbarkResult {
  const rng = mulberry32(seed ^ 0xDEADBEEF)

  // Find valid embark tiles: non-Water at z=0, not Stone (mountain peak)
  const candidates: Array<{ x: number; y: number }> = []
  for (let y = 10; y < map.height - 10; y++) {
    for (let x = 10; x < map.width - 10; x++) {
      const tile = getTile(x, y, 0, map)
      if (tile !== TileType.Water && tile !== TileType.Stone) {
        candidates.push({ x, y })
      }
    }
  }

  // Pick a random candidate as site center
  const idx = Math.floor(rng() * candidates.length)
  const site = candidates[idx] ?? {
    x: Math.floor(map.width / 2),
    y: Math.floor(map.height / 2),
  }

  // Spawn 7 dwarves scattered ±2 tiles from site center
  const dwarfEids: number[] = []
  for (let i = 0; i < 7; i++) {
    const eid = addEntity(world)
    addComponent(world, eid, Position)
    const px = site.x + Math.floor((rng() - 0.5) * 4)
    const py = site.y + Math.floor((rng() - 0.5) * 4)
    Position.x[eid] = px
    Position.y[eid] = py
    Position.z[eid] = 0

    addComponent(world, eid, TileCoord)
    TileCoord.x[eid] = px
    TileCoord.y[eid] = py
    TileCoord.z[eid] = 0

    addComponent(world, eid, DwarfAI)
    DwarfAI.state[eid] = DwarfState.Idle
    DwarfAI.jobEid[eid] = -1
    DwarfAI.eatTargetEid[eid] = -1
    DwarfAI.drinkTargetEid[eid] = -1

    addComponent(world, eid, Needs)
    // Start near-critical so dwarves immediately seek food/drink
    Needs.hunger[eid] = 0.30
    Needs.thirst[eid] = 0.27
    Needs.sleep[eid] = 0.7

    addComponent(world, eid, Skills)

    addComponent(world, eid, Labor)
    Labor.enabled[eid] = ALL_LABORS

    addComponent(world, eid, Mood)
    Mood.happiness[eid] = 1.0

    nameStore.set(
      eid,
      `${DWARF_FIRST[i % DWARF_FIRST.length]!} ${DWARF_LAST[(i * 3) % DWARF_LAST.length]!}`,
    )
    dwarfEids.push(eid)
  }

  // Spawn permanent resource patches so the colony can survive indefinitely
  spawnEmbarkPatches(world, site.x, site.y, rng)

  return { dwarfEids, siteX: site.x, siteY: site.y }
}

function spawnPatch(
  world: GameWorld,
  x: number, y: number,
  itemType: ItemType,
  timerOffset: number,
): void {
  const eid = addEntity(world)
  addComponent(world, eid, Patch)
  Patch.x[eid]        = x
  Patch.y[eid]        = y
  Patch.z[eid]        = 0
  Patch.itemType[eid] = itemType
  Patch.interval[eid] = PATCH_INTERVAL
  Patch.timer[eid]    = timerOffset  // stagger so patches don't all fire at once

  // Spawn one initial item immediately
  const itemEid = addEntity(world)
  addComponent(world, itemEid, Item)
  Item.itemType[itemEid]  = itemType
  Item.material[itemEid]  = itemType === ItemType.Food ? ItemMaterial.Plump : ItemMaterial.None
  Item.quality[itemEid]   = 1
  Item.carriedBy[itemEid] = -1
  Item.x[itemEid] = x
  Item.y[itemEid] = y
  Item.z[itemEid] = 0
}

function spawnEmbarkPatches(
  world: GameWorld,
  siteX: number,
  siteY: number,
  rng: () => number,
): void {
  // 5 mushroom patches (food) + 4 water springs (drink), staggered timers
  const configs: Array<{ type: ItemType; count: number }> = [
    { type: ItemType.Food,  count: 5 },
    { type: ItemType.Drink, count: 4 },
  ]
  let offset = 0
  for (const { type, count } of configs) {
    for (let i = 0; i < count; i++) {
      const px = siteX + Math.floor((rng() - 0.5) * 14)
      const py = siteY + Math.floor((rng() - 0.5) * 14)
      spawnPatch(world, px, py, type, offset)
      offset += Math.floor(PATCH_INTERVAL / (count + 1))
    }
  }
}
