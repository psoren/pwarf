import { Application, Graphics } from 'pixi.js'
import { TILE_SIZE } from '@core/constants'
import { type World3D, getTile } from '@map/world3d'
import { TILE_COLORS } from './tileColors'

type DwarfPos = { eid?: number; x: number; y: number; z: number }

export type Renderer = {
  drawTiles(world: World3D, viewZ: number, cameraX: number, cameraY: number): void
  drawDwarves(dwarves: DwarfPos[], viewZ: number, cameraX: number, cameraY: number, selectedEid?: number | null): void
  resize(width: number, height: number): void
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

  const dwarfGfx = new Graphics()
  app.stage.addChild(dwarfGfx)

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

  function drawDwarves(dwarves: DwarfPos[], viewZ: number, cameraX: number, cameraY: number, selectedEid?: number | null): void {
    dwarfGfx.clear()
    for (const d of dwarves) {
      if (d.z !== viewZ) continue
      const screenX = (d.x - cameraX) * TILE_SIZE
      const screenY = (d.y - cameraY) * TILE_SIZE
      const isSelected = selectedEid != null && d.eid === selectedEid
      // Draw dwarf as a goldenrod square inset 2px from the tile edges
      dwarfGfx.rect(screenX + 2, screenY + 2, TILE_SIZE - 4, TILE_SIZE - 4).fill(0xDAA520)
      // Draw selection highlight as a white border
      if (isSelected) {
        dwarfGfx.rect(screenX, screenY, TILE_SIZE, TILE_SIZE).stroke({ color: 0xFFFFFF, width: 2 })
      }
    }
  }

  function resize(width: number, height: number): void {
    app.renderer.resize(width, height)
  }

  function destroy(): void {
    app.destroy()
  }

  return { drawTiles, drawDwarves, resize, destroy }
}
