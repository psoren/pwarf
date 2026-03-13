import { Application, Graphics } from 'pixi.js'
import { TILE_SIZE } from '@core/constants'
import { type World3D, getTile } from '@map/world3d'
import { ItemType } from '@core/components/item'
import { TILE_COLORS } from './tileColors'

type DwarfPos    = { eid?: number; x: number; y: number; z: number; hunger?: number; thirst?: number }
type ItemPos     = { x: number; y: number; z: number; itemType: number }
type TilePos     = { x: number; y: number; z: number }
type DragSelection = { x1: number; y1: number; x2: number; y2: number } | null

export type Renderer = {
  drawTiles(world: World3D, viewZ: number, cameraX: number, cameraY: number): void
  drawItems(items: ItemPos[], viewZ: number, cameraX: number, cameraY: number): void
  drawDesignations(tiles: TilePos[], viewZ: number, cameraX: number, cameraY: number): void
  drawDwarves(dwarves: DwarfPos[], viewZ: number, cameraX: number, cameraY: number, selectedEid?: number | null): void
  drawSelection(sel: DragSelection, cameraX: number, cameraY: number): void
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

  const tilesGfx       = new Graphics()
  const itemGfx        = new Graphics()
  const designationGfx = new Graphics()
  const dwarfGfx       = new Graphics()
  const selectionGfx   = new Graphics()

  app.stage.addChild(tilesGfx)
  app.stage.addChild(itemGfx)
  app.stage.addChild(designationGfx)
  app.stage.addChild(dwarfGfx)
  app.stage.addChild(selectionGfx)

  function drawTiles(world: World3D, viewZ: number, cameraX: number, cameraY: number): void {
    tilesGfx.clear()
    if (viewZ < 0 || viewZ >= world.depth) return

    const startX = Math.max(0, cameraX)
    const startY = Math.max(0, cameraY)
    const endX   = Math.min(world.width,  cameraX + Math.ceil(canvas.width  / TILE_SIZE) + 1)
    const endY   = Math.min(world.height, cameraY + Math.ceil(canvas.height / TILE_SIZE) + 1)

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

  function drawItems(items: ItemPos[], viewZ: number, cameraX: number, cameraY: number): void {
    itemGfx.clear()
    for (const item of items) {
      if (item.z !== viewZ) continue
      const screenX = (item.x - cameraX) * TILE_SIZE
      const screenY = (item.y - cameraY) * TILE_SIZE
      const color =
        item.itemType === ItemType.Food  ? 0xAAFF44 :
        item.itemType === ItemType.Drink ? 0x44DDFF :
        0xFFFFFF
      const r = TILE_SIZE / 5
      itemGfx.circle(screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2, r).fill(color)
    }
  }

  function drawDesignations(tiles: TilePos[], viewZ: number, cameraX: number, cameraY: number): void {
    designationGfx.clear()
    for (const t of tiles) {
      if (t.z !== viewZ) continue
      const sx = (t.x - cameraX) * TILE_SIZE
      const sy = (t.y - cameraY) * TILE_SIZE
      // Draw an X in orange-red
      const p = 3
      designationGfx
        .moveTo(sx + p,            sy + p)
        .lineTo(sx + TILE_SIZE - p, sy + TILE_SIZE - p)
        .moveTo(sx + TILE_SIZE - p, sy + p)
        .lineTo(sx + p,            sy + TILE_SIZE - p)
        .stroke({ color: 0xFF6600, width: 1.5 })
    }
  }

  function drawDwarves(dwarves: DwarfPos[], viewZ: number, cameraX: number, cameraY: number, selectedEid?: number | null): void {
    dwarfGfx.clear()
    for (const d of dwarves) {
      if (d.z !== viewZ) continue
      const screenX = (d.x - cameraX) * TILE_SIZE
      const screenY = (d.y - cameraY) * TILE_SIZE
      const isSelected = selectedEid != null && d.eid === selectedEid
      dwarfGfx.rect(screenX + 2, screenY + 2, TILE_SIZE - 4, TILE_SIZE - 4).fill(0xDAA520)
      if (isSelected) {
        dwarfGfx.rect(screenX, screenY, TILE_SIZE, TILE_SIZE).stroke({ color: 0xFFFFFF, width: 2 })
      }
      const barW  = TILE_SIZE - 4
      const hunger = d.hunger ?? 1
      const thirst = d.thirst ?? 1
      const hColor = hunger > 0.5 ? 0xFF8800 : hunger > 0.25 ? 0xFF4400 : 0xFF0000
      const tColor = thirst > 0.5 ? 0x00CCFF : thirst > 0.25 ? 0x0088FF : 0xFF0000
      dwarfGfx.rect(screenX + 2, screenY,                  Math.round(barW * hunger), 2).fill(hColor)
      dwarfGfx.rect(screenX + 2, screenY + TILE_SIZE - 2,  Math.round(barW * thirst), 2).fill(tColor)
    }
  }

  function drawSelection(sel: DragSelection, cameraX: number, cameraY: number): void {
    selectionGfx.clear()
    if (!sel) return
    const sx = (sel.x1 - cameraX) * TILE_SIZE
    const sy = (sel.y1 - cameraY) * TILE_SIZE
    const sw = (sel.x2 - sel.x1 + 1) * TILE_SIZE
    const sh = (sel.y2 - sel.y1 + 1) * TILE_SIZE
    selectionGfx
      .rect(sx, sy, sw, sh)
      .fill({ color: 0xFF6600, alpha: 0.15 })
      .stroke({ color: 0xFF6600, width: 1 })
  }

  function resize(width: number, height: number): void {
    app.renderer.resize(width, height)
  }

  function destroy(): void {
    app.destroy()
  }

  return { drawTiles, drawItems, drawDesignations, drawDwarves, drawSelection, resize, destroy }
}
