import { TileType } from './tileTypes'

export type { TileType }

export type World3D = {
  tiles:     Uint8Array
  materials: Uint8Array
  flags:     Uint8Array
  width:     number
  height:    number
  depth:     number
}

export function tileIndex(x: number, y: number, z: number, w: World3D): number {
  return z * w.width * w.height + y * w.width + x
}

export function createWorld3D(width: number, height: number, depth: number): World3D {
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

export function getTile(w: World3D, x: number, y: number, z: number): TileType {
  return w.tiles[tileIndex(x, y, z, w)] as TileType
}

export function setTile(w: World3D, x: number, y: number, z: number, type: TileType): void {
  w.tiles[tileIndex(x, y, z, w)] = type
}
