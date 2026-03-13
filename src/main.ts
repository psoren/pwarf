import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { HeadlessGame } from '@core/HeadlessGame'
import { createRenderer } from '@ui/renderer'
import { createInputHandler } from '@ui/input'
import { TICKS_PER_SECOND, WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH, TILE_SIZE } from '@core/constants'
import { initLogger } from '@core/logger'
import { GameUI } from '@ui/GameUI'
import type { GameUIHandle } from '@ui/GameUI'

const axiomToken = import.meta.env.VITE_AXIOM_TOKEN
const axiomDataset = import.meta.env.VITE_AXIOM_DATASET
if (axiomToken !== undefined && axiomDataset !== undefined) {
  initLogger({ token: axiomToken, dataset: axiomDataset })
}

const appEl = document.getElementById('app')
if (!appEl) throw new Error('No #app element found')
const uiEl = document.getElementById('ui')
if (!uiEl) throw new Error('No #ui element found')

// Canvas sits behind the React UI layer
const canvas = document.createElement('canvas')
canvas.width  = window.innerWidth
canvas.height = window.innerHeight
appEl.appendChild(canvas)

// Camera / view state
let cameraX = Math.floor(WORLD_WIDTH  / 2) - Math.floor(canvas.width  / TILE_SIZE / 2)
let cameraY = Math.floor(WORLD_HEIGHT / 2) - Math.floor(canvas.height / TILE_SIZE / 2)
let viewZ   = 0

// selectedEid is owned by React; main.ts reads this ref for the canvas highlight
let selectedEid: number | null = null

const CAM_MARGIN = 2

function clampCamera(): void {
  const viewTilesX = Math.ceil(canvas.width  / TILE_SIZE)
  const viewTilesY = Math.ceil(canvas.height / TILE_SIZE)
  cameraX = Math.max(-CAM_MARGIN, Math.min(WORLD_WIDTH  - viewTilesX + CAM_MARGIN, cameraX))
  cameraY = Math.max(-CAM_MARGIN, Math.min(WORLD_HEIGHT - viewTilesY + CAM_MARGIN, cameraY))
}

// Bridge to React UI — populated once React calls onReady
let ui: GameUIHandle | null = null

// Mount React
const root = createRoot(uiEl)
root.render(createElement(GameUI, {
  onReady:       (handle) => { ui = handle },
  onSelectDwarf: (eid)    => { selectedEid = eid },
}))

// --- Input ---

const input = createInputHandler(canvas, (cmd) => {
  switch (cmd.type) {
    case 'MOVE_CAMERA':
      cameraX += cmd.dx
      cameraY += cmd.dy
      clampCamera()
      ui?.updateHUD(game.getTickCount(), viewZ, cameraX, cameraY)
      break
    case 'CHANGE_Z':
      viewZ = Math.min(0, Math.max(-(WORLD_DEPTH - 1), viewZ + cmd.dz))
      ui?.updateHUD(game.getTickCount(), viewZ, cameraX, cameraY)
      break
    case 'CANCEL':
      break
    case 'TILE_CLICK': {
      const tileX = cmd.x + cameraX
      const tileY = cmd.y + cameraY
      const worldZ = -viewZ
      const dwarves = game.getDwarves()
      const hit = dwarves.find(d => Math.round(d.x) === tileX && Math.round(d.y) === tileY && d.z === worldZ)
      const eid = hit?.eid ?? null
      selectedEid = eid
      ui?.setSelectedEid(eid)
      break
    }
  }
}, () => viewZ)

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'h' || e.key === 'H') ui?.toggleHelp()
  if (e.key === 'Escape')             { selectedEid = null; ui?.setSelectedEid(null) }
})

window.addEventListener('unload', () => { input.destroy() })

// --- Game boot ---

const game = new HeadlessGame({ seed: 42 })

game.embarkAsync((progress, label) => {
  ui?.setProgress(progress, label)
}).then(() => {
  startGame()
}).catch((err: unknown) => {
  console.error('World gen failed', err)
  ui?.setProgress(1, 'World generation failed — check console.')
})

function startGame(): void {
  const site = game.getEmbarkSite()
  cameraX = site.x - Math.floor(canvas.width  / TILE_SIZE / 2)
  cameraY = site.y - Math.floor(canvas.height / TILE_SIZE / 2)
  clampCamera()

  ui?.setPlaying()
  ui?.updateDwarves(game.getDwarves())
  ui?.updateHUD(0, viewZ, cameraX, cameraY)

  createRenderer(canvas).then((renderer) => {
    const map = game.getMap()

    window.addEventListener('resize', () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      renderer.resize(canvas.width, canvas.height)
      clampCamera()
      ui?.updateHUD(game.getTickCount(), viewZ, cameraX, cameraY)
    })

    // Simulation tick
    setInterval(() => {
      const state = game.tick()
      ui?.updateDwarves(state.dwarves)
      ui?.updateHUD(state.tick, viewZ, cameraX, cameraY)
    }, 1000 / TICKS_PER_SECOND)

    // Render loop
    function frame(): void {
      const worldZ  = -viewZ
      const dwarves = game.getDwarves()
      const items   = game.getItems()
      renderer.drawTiles(map, worldZ, cameraX, cameraY)
      renderer.drawItems(items, worldZ, cameraX, cameraY)
      renderer.drawDwarves(dwarves, worldZ, cameraX, cameraY, selectedEid)
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }).catch((err: unknown) => {
    console.error('Renderer init failed', err)
  })
}
