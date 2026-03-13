import { loadMaterials } from './loaders/materials'
import type { Material } from './loaders/materials'

export type { Material }

type GameDataShape = {
  materials: readonly Material[]
}

export const GameData: GameDataShape = Object.freeze({
  materials: Object.freeze(loadMaterials()),
})
