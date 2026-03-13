// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { createInputHandler } from '@ui/input'
import type { GameCommand } from '@core/types'


function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 480
  // jsdom getBoundingClientRect returns zeros by default — that's fine for tile math
  return canvas
}

describe('createInputHandler', () => {
  let canvas: HTMLCanvasElement
  let commands: GameCommand[]
  let dispatch: (cmd: GameCommand) => void

  beforeEach(() => {
    canvas = makeCanvas()
    commands = []
    dispatch = (cmd) => commands.push(cmd)
  })

  describe('keyboard — camera movement', () => {
    it.each([
      ['ArrowUp',    { type: 'MOVE_CAMERA', dx: 0, dy: -1 }],
      ['ArrowDown',  { type: 'MOVE_CAMERA', dx: 0, dy: 1  }],
      ['ArrowLeft',  { type: 'MOVE_CAMERA', dx: -1, dy: 0 }],
      ['ArrowRight', { type: 'MOVE_CAMERA', dx: 1, dy: 0  }],
      ['w',          { type: 'MOVE_CAMERA', dx: 0, dy: -1 }],
      ['W',          { type: 'MOVE_CAMERA', dx: 0, dy: -1 }],
      ['s',          { type: 'MOVE_CAMERA', dx: 0, dy: 1  }],
      ['S',          { type: 'MOVE_CAMERA', dx: 0, dy: 1  }],
      ['a',          { type: 'MOVE_CAMERA', dx: -1, dy: 0 }],
      ['A',          { type: 'MOVE_CAMERA', dx: -1, dy: 0 }],
      ['d',          { type: 'MOVE_CAMERA', dx: 1, dy: 0  }],
      ['D',          { type: 'MOVE_CAMERA', dx: 1, dy: 0  }],
    ] as const)('%s dispatches %o', (key, expected) => {
      const handler = createInputHandler(canvas, dispatch)
      window.dispatchEvent(new KeyboardEvent('keydown', { key }))
      expect(commands).toEqual([expected])
      handler.destroy()
    })
  })

  describe('keyboard — z-level', () => {
    it('+ dispatches CHANGE_Z +1', () => {
      const handler = createInputHandler(canvas, dispatch)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }))
      expect(commands).toEqual([{ type: 'CHANGE_Z', dz: 1 }])
      handler.destroy()
    })

    it('= dispatches CHANGE_Z +1 (unshifted plus on US layout)', () => {
      const handler = createInputHandler(canvas, dispatch)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '=' }))
      expect(commands).toEqual([{ type: 'CHANGE_Z', dz: 1 }])
      handler.destroy()
    })

    it('- dispatches CHANGE_Z -1', () => {
      const handler = createInputHandler(canvas, dispatch)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '-' }))
      expect(commands).toEqual([{ type: 'CHANGE_Z', dz: -1 }])
      handler.destroy()
    })
  })

  describe('keyboard — cancel', () => {
    it('Escape dispatches CANCEL', () => {
      const handler = createInputHandler(canvas, dispatch)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(commands).toEqual([{ type: 'CANCEL' }])
      handler.destroy()
    })
  })

  describe('mouse — tile clicks', () => {
    it('left-click dispatches TILE_CLICK with tile coords', () => {
      const handler = createInputHandler(canvas, dispatch)
      // clientX=48, clientY=32 → tile (3, 2) with TILE_SIZE=16
      canvas.dispatchEvent(new MouseEvent('click', { clientX: 48, clientY: 32, bubbles: true }))
      expect(commands).toEqual([{ type: 'TILE_CLICK', x: 3, y: 2, z: 0 }])
      handler.destroy()
    })

    it('right-click dispatches TILE_RIGHT_CLICK with tile coords', () => {
      const handler = createInputHandler(canvas, dispatch)
      canvas.dispatchEvent(new MouseEvent('contextmenu', { clientX: 16, clientY: 0, bubbles: true }))
      expect(commands).toEqual([{ type: 'TILE_RIGHT_CLICK', x: 1, y: 0, z: 0 }])
      handler.destroy()
    })

    it('uses currentZ() for z coordinate', () => {
      const handler = createInputHandler(canvas, dispatch, () => 3)
      canvas.dispatchEvent(new MouseEvent('click', { clientX: 0, clientY: 0, bubbles: true }))
      expect(commands[0]).toEqual({ type: 'TILE_CLICK', x: 0, y: 0, z: 3 })
      handler.destroy()
    })
  })

  describe('destroy()', () => {
    it('removes keyboard listener so no further commands are dispatched', () => {
      const handler = createInputHandler(canvas, dispatch)
      handler.destroy()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
      expect(commands).toHaveLength(0)
    })

    it('removes click listener so no further commands are dispatched', () => {
      const handler = createInputHandler(canvas, dispatch)
      handler.destroy()
      canvas.dispatchEvent(new MouseEvent('click', { clientX: 0, clientY: 0, bubbles: true }))
      expect(commands).toHaveLength(0)
    })

    it('removes contextmenu listener so no further commands are dispatched', () => {
      const handler = createInputHandler(canvas, dispatch)
      handler.destroy()
      canvas.dispatchEvent(new MouseEvent('contextmenu', { clientX: 0, clientY: 0, bubbles: true }))
      expect(commands).toHaveLength(0)
    })
  })
})
