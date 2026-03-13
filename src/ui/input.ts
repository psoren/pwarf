import type { GameCommand } from '@core/types'
import { TILE_SIZE } from '@core/constants'

export interface InputHandler {
  destroy(): void
}

/**
 * Attaches keyboard and mouse listeners to `canvas` and translates raw events
 * into typed `GameCommand` values dispatched via `dispatch`.
 *
 * No world state is mutated here — all side-effects go through dispatch.
 *
 * @param canvas   The canvas element that receives mouse events.
 * @param dispatch Called with each command as it is produced.
 * @param currentZ Getter for the active z-level (used for tile coord calculation).
 */
export function createInputHandler(
  canvas: HTMLCanvasElement,
  dispatch: (cmd: GameCommand) => void,
  currentZ: () => number = () => 0,
): InputHandler {
  function onKeyDown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        dispatch({ type: 'MOVE_CAMERA', dx: 0, dy: -1 })
        break
      case 'ArrowDown':
      case 's':
      case 'S':
        dispatch({ type: 'MOVE_CAMERA', dx: 0, dy: 1 })
        break
      case 'ArrowLeft':
      case 'a':
      case 'A':
        dispatch({ type: 'MOVE_CAMERA', dx: -1, dy: 0 })
        break
      case 'ArrowRight':
      case 'd':
      case 'D':
        dispatch({ type: 'MOVE_CAMERA', dx: 1, dy: 0 })
        break
      case '+':
      case '=':
        dispatch({ type: 'CHANGE_Z', dz: 1 })
        break
      case '-':
        dispatch({ type: 'CHANGE_Z', dz: -1 })
        break
      case 'Escape':
        dispatch({ type: 'CANCEL' })
        break
    }
  }

  function tileCoords(e: MouseEvent): { x: number; y: number; z: number } {
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / TILE_SIZE)
    const y = Math.floor((e.clientY - rect.top) / TILE_SIZE)
    return { x, y, z: currentZ() }
  }

  function onClick(e: MouseEvent): void {
    dispatch({ type: 'TILE_CLICK', ...tileCoords(e) })
  }

  function onContextMenu(e: MouseEvent): void {
    e.preventDefault()
    dispatch({ type: 'TILE_RIGHT_CLICK', ...tileCoords(e) })
  }

  window.addEventListener('keydown', onKeyDown)
  canvas.addEventListener('click', onClick)
  canvas.addEventListener('contextmenu', onContextMenu)

  return {
    destroy(): void {
      window.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('contextmenu', onContextMenu)
    },
  }
}
