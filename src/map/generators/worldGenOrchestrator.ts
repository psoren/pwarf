import type { World3D } from '@map/world3d'
import { generateHeightmap } from '@map/generators/heightmap'
import { generateRivers } from '@map/generators/rivers'
import { generateBiomes } from '@map/generators/biomes'
import { generateUnderground } from '@map/generators/underground'
import { buildWorld } from '@map/generators/worldSliceBuilder'
import { WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH } from '@core/constants'

export type WorldGenProgress = {
  step: string
  progress: number  // 0.0–1.0
  label: string
}

export type ProgressCallback = (progress: number, label: string) => void

function tick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

/**
 * Orchestrate all world generation steps with optional progress reporting.
 * Returns a fully built World3D.
 */
export async function generateWorld(
  seed: number,
  width: number = WORLD_WIDTH,
  height: number = WORLD_HEIGHT,
  depth: number = WORLD_DEPTH,
  onProgress?: ProgressCallback,
): Promise<World3D> {
  const progress = (p: number, label: string): void => onProgress?.(p, label)

  progress(0.0, 'Raising mountains...')
  await tick()
  const heightmap = generateHeightmap(seed, width, height)

  progress(0.15, 'Carving rivers...')
  await tick()
  const rivers = generateRivers(heightmap, seed, width, height)

  progress(0.30, 'Cooling the poles...')
  await tick()
  const biomes = generateBiomes(heightmap, seed, width, height)

  progress(0.45, 'Classifying biomes...')
  await tick()

  progress(0.60, 'Placing ore veins...')
  await tick()
  const underground = generateUnderground(heightmap, seed, width, height, depth)

  progress(0.75, 'Carving caverns...')
  await tick()

  progress(0.90, 'Simulating history...')
  await tick()

  const world = buildWorld(heightmap, biomes, rivers, underground, width, height, depth)

  progress(1.0, 'World ready.')
  return world
}
