import { HeadlessGame } from '@core/HeadlessGame'
import { createRenderer } from '@ui/renderer'
import { TICKS_PER_SECOND } from '@core/constants'
import { initLogger } from '@core/logger'

const axiomToken = import.meta.env.VITE_AXIOM_TOKEN
const axiomDataset = import.meta.env.VITE_AXIOM_DATASET
if (axiomToken !== undefined && axiomDataset !== undefined) {
  initLogger({ token: axiomToken, dataset: axiomDataset })
}

const game = new HeadlessGame({ seed: 42 })
game.embark()

const appEl = document.getElementById('app')
if (!appEl) throw new Error('No #app element found')

const canvas = document.createElement('canvas')
canvas.width  = 512
canvas.height = 512
appEl.appendChild(canvas)

let cameraX = 0
let cameraY = 0
let viewZ   = 0

window.addEventListener('keydown', (e: KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowUp':    case 'w': case 'W': cameraY -= 1; break
    case 'ArrowDown':  case 's': case 'S': cameraY += 1; break
    case 'ArrowLeft':  case 'a': case 'A': cameraX -= 1; break
    case 'ArrowRight': case 'd': case 'D': cameraX += 1; break
    case '+': case '=': viewZ += 1; break
    case '-': viewZ -= 1; break
  }
  cameraX = Math.max(0, cameraX)
  cameraY = Math.max(0, cameraY)
  viewZ   = Math.max(0, viewZ)
})

createRenderer(canvas).then((renderer) => {
  const map = game.getMap()

  // Advance simulation at a fixed tick rate
  setInterval(() => { game.tick() }, 1000 / TICKS_PER_SECOND)

  // Render each animation frame
  function frame(): void {
    renderer.drawTiles(map, viewZ, cameraX, cameraY)
    renderer.drawDwarves(game.getDwarves(), viewZ, cameraX, cameraY)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}).catch((err: unknown) => {
  console.error('Renderer init failed', err)
})
