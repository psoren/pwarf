import { WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH } from '@core/constants'
import { TileType } from '@map/tileTypes'

export type World3D = {
  tiles:     Uint8Array
  materials: Uint8Array
  flags:     Uint8Array
  width:     number
  height:    number
  depth:     number
}

export function createWorld3D(
  width:  number = WORLD_WIDTH,
  height: number = WORLD_HEIGHT,
  depth:  number = WORLD_DEPTH,
): World3D {
  const size = width * height * depth
  return {
    tiles:     new Uint8Array(size),
    materials: new Uint8Array(size),
    flags:     new Uint8Array(size),
    width,
    height,
    depth,
  }
}

export function tileIndex(x: number, y: number, z: number, w: World3D): number {
  return z * w.width * w.height + y * w.width + x
}

function inBounds(x: number, y: number, z: number, w: World3D): boolean {
  return x >= 0 && x < w.width &&
         y >= 0 && y < w.height &&
         z >= 0 && z < w.depth
}

export function getTile(x: number, y: number, z: number, w: World3D): TileType {
  if (!inBounds(x, y, z, w)) {
    return TileType.Air
  }
  return (w.tiles[tileIndex(x, y, z, w)] ?? TileType.Air) as TileType
}

export function setTile(x: number, y: number, z: number, w: World3D, type: TileType): void {
  if (!inBounds(x, y, z, w)) {
    return
  }
  w.tiles[tileIndex(x, y, z, w)] = type
}

export function getMaterial(x: number, y: number, z: number, w: World3D): number {
  if (!inBounds(x, y, z, w)) {
    return 0
  }
  return w.materials[tileIndex(x, y, z, w)] ?? 0
}

export function setMaterial(x: number, y: number, z: number, w: World3D, mat: number): void {
  if (!inBounds(x, y, z, w)) {
    return
  }
  w.materials[tileIndex(x, y, z, w)] = mat
}

export function getFlags(x: number, y: number, z: number, w: World3D): number {
  if (!inBounds(x, y, z, w)) {
    return 0
  }
  return w.flags[tileIndex(x, y, z, w)] ?? 0
}

export function setFlags(x: number, y: number, z: number, w: World3D, flags: number): void {
  if (!inBounds(x, y, z, w)) {
    return
  }
  w.flags[tileIndex(x, y, z, w)] = flags
}
