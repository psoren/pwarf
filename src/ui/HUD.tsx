import type { JSX } from 'react'

export function HUD(): JSX.Element {
  return (
    <div
      className="hud"
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    />
  )
}
