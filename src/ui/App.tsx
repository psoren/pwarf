import type { JSX } from 'react'
import { GameCanvas } from './GameCanvas'
import { HUD } from './HUD'

export function App(): JSX.Element {
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <GameCanvas />
      <HUD />
    </div>
  )
}
