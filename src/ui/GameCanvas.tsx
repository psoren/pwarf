import type { JSX } from 'react'
import { useEffect, useRef } from 'react'
import { createRenderer } from './renderer'
import { createWorld3D, setTile } from '@map/world3d'
import { TileType } from '@map/tileTypes'

const WIDTH  = 128
const HEIGHT = 128
const DEPTH  = 16

function buildStoneWorld() {
  const world = createWorld3D(WIDTH, HEIGHT, DEPTH)
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      setTile(world, x, y, 0, TileType.Stone)
    }
  }
  return world
}

export function GameCanvas(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const world = buildStoneWorld()
    let destroyed = false
    let rendererDestroy: (() => void) | null = null

    createRenderer(canvas).then((renderer) => {
      if (destroyed) {
        renderer.destroy()
        return
      }
      rendererDestroy = renderer.destroy.bind(renderer)
      renderer.drawTiles(world, 0, 0, 0)
    }).catch((err: unknown) => {
      console.error('Renderer init failed', err)
    })

    return () => {
      destroyed = true
      rendererDestroy?.()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
