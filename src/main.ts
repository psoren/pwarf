import { HeadlessGame } from '@core/HeadlessGame'
import { createRenderer } from '@ui/renderer'
import { TICKS_PER_SECOND, WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH, TILE_SIZE } from '@core/constants'
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

const helpModal = document.getElementById('help-modal')
if (!helpModal) throw new Error('No #help-modal element found')

const hudZ    = document.getElementById('hud-z')
const hudTick = document.getElementById('hud-tick')

helpModal.addEventListener('click', () => { helpModal.classList.remove('open') })

const canvas = document.createElement('canvas')
canvas.width  = window.innerWidth
canvas.height = window.innerHeight
appEl.appendChild(canvas)

// Start camera centered on dwarf spawn point (map center)
let cameraX = Math.floor(WORLD_WIDTH  / 2) - Math.floor(canvas.width  / TILE_SIZE / 2)
let cameraY = Math.floor(WORLD_HEIGHT / 2) - Math.floor(canvas.height / TILE_SIZE / 2)
let viewZ   = 0

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'h' || e.key === 'H') {
    helpModal.classList.toggle('open')
    return
  }
  if (e.key === 'Escape') {
    helpModal.classList.remove('open')
    return
  }
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
  viewZ   = Math.max(0, Math.min(WORLD_DEPTH - 1, viewZ))
  if (hudZ) hudZ.textContent = `Z: ${viewZ}${viewZ === 0 ? ' (surface)' : ''}`
})

createRenderer(canvas).then((renderer) => {
  const map = game.getMap()

  window.addEventListener('resize', () => {
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    renderer.resize(canvas.width, canvas.height)
    cameraX = Math.floor(WORLD_WIDTH  / 2) - Math.floor(canvas.width  / TILE_SIZE / 2)
    cameraY = Math.floor(WORLD_HEIGHT / 2) - Math.floor(canvas.height / TILE_SIZE / 2)
  })

  // Advance simulation at a fixed tick rate
  setInterval(() => {
    const state = game.tick()
    if (hudTick) hudTick.textContent = `Tick: ${state.tick}`
  }, 1000 / TICKS_PER_SECOND)

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
