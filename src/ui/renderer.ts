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

  function drawTiles(world: World3D, viewZ: number, cameraX: number, cameraY: number): void {
    tilesGfx.clear()

    if (viewZ < 0 || viewZ >= world.depth) return

    const viewW = canvas.width
    const viewH = canvas.height

    const startX = Math.max(0, cameraX)
    const startY = Math.max(0, cameraY)
    const endX   = Math.min(world.width,  cameraX + Math.ceil(viewW / TILE_SIZE) + 1)
    const endY   = Math.min(world.height, cameraY + Math.ceil(viewH / TILE_SIZE) + 1)

    for (let ty = startY; ty < endY; ty++) {
      for (let tx = startX; tx < endX; tx++) {
        const tile  = getTile(tx, ty, viewZ, world)
        const color = TILE_COLORS[tile]

        const screenX = (tx - cameraX) * TILE_SIZE
        const screenY = (ty - cameraY) * TILE_SIZE

        tilesGfx.rect(screenX, screenY, TILE_SIZE, TILE_SIZE).fill(color)
      }
    }
  }

  function destroy(): void {
    app.destroy()
  }

  return { drawTiles, destroy }
}
