import { Application, Graphics } from 'pixi.js'
import { TILE_SIZE } from '@core/constants'
import { type World3D, getTile } from '@map/world3d'
import { TILE_COLORS } from './tileColors'

export type Renderer = {
  drawTiles(world: World3D, viewZ: number, cameraX: number, cameraY: number): void
  destroy(): void
}

export async function createRenderer(canvas: HTMLCanvasElement): Promise<Renderer> {
  const app = new Application()

  await app.init({
    canvas,
    width: canvas.width,
    height: canvas.height,
    backgroundColor: 0x111111,
    antialias: false,
  })

  const tilesGfx = new Graphics()
  app.stage.addChild(tilesGfx)

  const tilesWide = Math.ceil(canvas.width / TILE_SIZE) + 1
  const tilesHigh = Math.ceil(canvas.height / TILE_SIZE) + 1

  function drawTiles(world: World3D, viewZ: number, cameraX: number, cameraY: number): void {
    tilesGfx.clear()

    const startTileX = Math.floor(cameraX / TILE_SIZE)
    const startTileY = Math.floor(cameraY / TILE_SIZE)

    for (let ty = 0; ty < tilesHigh; ty++) {
      for (let tx = 0; tx < tilesWide; tx++) {
        const worldX = startTileX + tx
        const worldY = startTileY + ty

        if (worldX < 0 || worldX >= world.width) continue
        if (worldY < 0 || worldY >= world.height) continue
        if (viewZ < 0 || viewZ >= world.depth) continue

        const tile = getTile(world, worldX, worldY, viewZ)
        const color = TILE_COLORS[tile]

        const screenX = worldX * TILE_SIZE - cameraX
        const screenY = worldY * TILE_SIZE - cameraY

        tilesGfx.rect(screenX, screenY, TILE_SIZE, TILE_SIZE).fill(color)
      }
    }
  }

  function destroy(): void {
    app.destroy()
  }

  return { drawTiles, destroy }
}
