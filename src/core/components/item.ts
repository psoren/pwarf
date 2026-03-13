import { MAX_ENTITIES } from '@core/constants'

export const enum ItemType {
  Stone     = 0,
  Ore       = 1,
  Log       = 2,
  Food      = 3,
  Drink     = 4,
  Seed      = 5,
  Pick      = 6,
  Axe       = 7,
  Sword     = 8,
  Armor     = 9,
  Bar       = 10,
  Furniture = 11,
}

export const enum ItemMaterial {
  None          = 0,
  Granite       = 1,
  Limestone     = 2,
  Sandstone     = 3,
  Basalt        = 4,
  Marble        = 5,
  IronOre       = 6,
  CopperOre     = 7,
  CoalOre       = 8,
  GoldOre       = 9,
  AdamantineOre = 10,
  Iron          = 11,
  Copper        = 12,
  Plump         = 13,
  Mushroom      = 14,
  Oak           = 15,
}

export const Item = {
  itemType:  new Uint8Array(MAX_ENTITIES),
  material:  new Uint8Array(MAX_ENTITIES),
  quality:   new Int8Array(MAX_ENTITIES),   // 1-5
  carriedBy: new Int32Array(MAX_ENTITIES),  // -1 if not carried
  x:         new Int32Array(MAX_ENTITIES),
  y:         new Int32Array(MAX_ENTITIES),
  z:         new Int16Array(MAX_ENTITIES),  // storageZ (0=surface)
}
