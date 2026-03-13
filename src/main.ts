import { createWorld3D, setTile } from '@map/world3d'
import { TileType } from '@map/tileTypes'
import { createRenderer } from '@ui/renderer'

const WIDTH  = 32
const HEIGHT = 32
const DEPTH  = 1

const world = createWorld3D(WIDTH, HEIGHT, DEPTH)

// Fill z=0 with Stone tiles
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    setTile(world, x, y, 0, TileType.Stone)
  }
}

const appEl = document.getElementById('app')
if (!appEl) throw new Error('No #app element found')

const canvas = document.createElement('canvas')
canvas.width  = 512
canvas.height = 512
appEl.appendChild(canvas)

createRenderer(canvas).then((renderer) => {
  renderer.drawTiles(world, 0, 0, 0)
}).catch((err: unknown) => {
  console.error('Renderer init failed', err)
})
