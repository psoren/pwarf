import { HeadlessGame } from '@core/HeadlessGame'
import { createRenderer } from '@ui/renderer'
import { createInputHandler } from '@ui/input'
import { TICKS_PER_SECOND, WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH, TILE_SIZE } from '@core/constants'
import { initLogger } from '@core/logger'
import { nameStore } from '@core/stores'

const axiomToken = import.meta.env.VITE_AXIOM_TOKEN
const axiomDataset = import.meta.env.VITE_AXIOM_DATASET
if (axiomToken !== undefined && axiomDataset !== undefined) {
  initLogger({ token: axiomToken, dataset: axiomDataset })
}

const appEl = document.getElementById('app')
if (!appEl) throw new Error('No #app element found')

const helpModal = document.getElementById('help-modal')
if (!helpModal) throw new Error('No #help-modal element found')

const loadingOverlay  = document.getElementById('loading-overlay')
const loadingBar      = document.getElementById('loading-bar')
const loadingLabel    = document.getElementById('loading-label')

const hudZ        = document.getElementById('hud-z')
const hudTick     = document.getElementById('hud-tick')
const hudXY       = document.getElementById('hud-xy')
const hudMsg      = document.getElementById('hud-msg')
const hudSelected = document.getElementById('hud-selected')

helpModal.addEventListener('click', () => { helpModal.classList.remove('open') })

const canvas = document.createElement('canvas')
canvas.width  = window.innerWidth
canvas.height = window.innerHeight
appEl.appendChild(canvas)

// Start camera centered on map center — will reposition after embark
let cameraX     = Math.floor(WORLD_WIDTH  / 2) - Math.floor(canvas.width  / TILE_SIZE / 2)
let cameraY     = Math.floor(WORLD_HEIGHT / 2) - Math.floor(canvas.height / TILE_SIZE / 2)
// viewZ: 0 = surface, negative = underground
let viewZ       = 0
let selectedEid: number | null = null

const CAM_MARGIN = 10

function updateHUD(): void {
  if (hudZ)  hudZ.textContent  = `Z: ${viewZ}${viewZ === 0 ? ' (surface)' : ' (underground)'}`
  if (hudXY) hudXY.textContent = `X: ${cameraX}  Y: ${cameraY}`
}

function updateSelectedHud(): void {
  if (!hudSelected) return
  if (selectedEid === null) {
    hudSelected.textContent = ''
    return
  }
  const name = nameStore.get(selectedEid) ?? `Dwarf #${selectedEid}`
  const dwarves = game.getDwarves()
  const d = dwarves.find(dw => dw.eid === selectedEid)
  if (d) {
    hudSelected.textContent = `${name} (${Math.round(d.x)}, ${Math.round(d.y)}, ${d.z})`
  } else {
    hudSelected.textContent = ''
    selectedEid = null
  }
}

updateHUD()

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'h' || e.key === 'H') {
    helpModal.classList.toggle('open')
  }
})

const input = createInputHandler(canvas, (cmd) => {
  switch (cmd.type) {
    case 'MOVE_CAMERA':
      cameraX += cmd.dx
      cameraY += cmd.dy
      cameraX = Math.max(-CAM_MARGIN, Math.min(WORLD_WIDTH  + CAM_MARGIN, cameraX))
      cameraY = Math.max(-CAM_MARGIN, Math.min(WORLD_HEIGHT + CAM_MARGIN, cameraY))
      updateHUD()
      break
    case 'CHANGE_Z':
      // dz: +1 = toward surface (viewZ increases toward 0), -1 = deeper (viewZ decreases)
      viewZ = Math.min(0, Math.max(-(WORLD_DEPTH - 1), viewZ + cmd.dz))
      updateHUD()
      break
    case 'CANCEL':
      helpModal.classList.remove('open')
      break
    case 'TILE_CLICK': {
      const tileX = cmd.x + cameraX
      const tileY = cmd.y + cameraY
      const worldZ = -viewZ  // dwarves use positive z, 0 = surface
      const dwarves = game.getDwarves()
      const hit = dwarves.find(d => Math.round(d.x) === tileX && Math.round(d.y) === tileY && d.z === worldZ)
      selectedEid = hit?.eid ?? null
      updateSelectedHud()
      break
    }
  }
}, () => viewZ)

window.addEventListener('unload', () => { input.destroy() })

// --- World generation + game boot ---

const game = new HeadlessGame({ seed: 42 })

function showLoading(show: boolean): void {
  if (loadingOverlay) loadingOverlay.style.display = show ? 'flex' : 'none'
}

showLoading(true)

game.embarkAsync((progress, label) => {
  if (loadingBar)   loadingBar.style.width = `${Math.round(progress * 100)}%`
  if (loadingLabel) loadingLabel.textContent = label
}).then(() => {
  showLoading(false)
  startGame()
}).catch((err: unknown) => {
  console.error('World gen failed', err)
  if (loadingLabel) loadingLabel.textContent = 'World generation failed — check console.'
})

function startGame(): void {
  // Re-center camera on embark site (dwarves are near map center)
  cameraX = Math.floor(WORLD_WIDTH  / 2) - Math.floor(canvas.width  / TILE_SIZE / 2)
  cameraY = Math.floor(WORLD_HEIGHT / 2) - Math.floor(canvas.height / TILE_SIZE / 2)
  updateHUD()

  createRenderer(canvas).then((renderer) => {
    const map = game.getMap()

    window.addEventListener('resize', () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      renderer.resize(canvas.width, canvas.height)
      cameraX = Math.floor(WORLD_WIDTH  / 2) - Math.floor(canvas.width  / TILE_SIZE / 2)
      cameraY = Math.floor(WORLD_HEIGHT / 2) - Math.floor(canvas.height / TILE_SIZE / 2)
      updateHUD()
    })

    // Advance simulation at a fixed tick rate
    setInterval(() => {
      const state = game.tick()
      if (hudTick) hudTick.textContent = `Tick: ${state.tick}`
    }, 1000 / TICKS_PER_SECOND)

    // Render each animation frame
    function frame(): void {
      const worldZ = -viewZ
      const dwarves = game.getDwarves()
      renderer.drawTiles(map, worldZ, cameraX, cameraY)
      renderer.drawDwarves(dwarves, worldZ, cameraX, cameraY, selectedEid)
      const onLevel = dwarves.filter(d => d.z === worldZ)
      if (hudMsg) hudMsg.textContent = onLevel.length === 0 ? 'No dwarves on this level' : ''
      updateSelectedHud()
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }).catch((err: unknown) => {
    console.error('Renderer init failed', err)
  })
}
