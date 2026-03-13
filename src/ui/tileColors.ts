import { TileType } from '@map/tileTypes'

export const TILE_COLORS: Record<TileType, number> = {
  [TileType.Air]:   0x111111,
  [TileType.Stone]: 0x888888,
  [TileType.Soil]:  0x8B4513,
  [TileType.Water]: 0x4169E1,
  [TileType.Floor]: 0xC8A96E,
  [TileType.Wall]:  0xAAAAAA,
}
