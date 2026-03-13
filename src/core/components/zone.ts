import { MAX_ENTITIES } from '@core/constants'

export const enum ZoneType {
  Stockpile = 0,
  Farm      = 1,
}

export const enum StockpileCategory {
  Stone     = 1 << 0,
  Ore       = 1 << 1,
  Wood      = 1 << 2,
  Food      = 1 << 3,
  Drink     = 1 << 4,
  Weapons   = 1 << 5,
  Armor     = 1 << 6,
  Furniture = 1 << 7,
  All       = 0xFF,
}

export const Zone = {
  zoneType:   new Uint8Array(MAX_ENTITIES),
  x1:         new Int32Array(MAX_ENTITIES),
  y1:         new Int32Array(MAX_ENTITIES),
  x2:         new Int32Array(MAX_ENTITIES),
  y2:         new Int32Array(MAX_ENTITIES),
  z:          new Int16Array(MAX_ENTITIES),
  categories: new Uint32Array(MAX_ENTITIES),
}
