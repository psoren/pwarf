import React, { useState, useEffect, useCallback } from 'react'
import { WorldGenProgressScreen } from './WorldGenProgressScreen'
import { Sidebar } from './Sidebar'
import { HelpModal } from './HelpModal'
import type { DwarfStatus } from '@core/types'

export type GameUIHandle = {
  setProgress(progress: number, label: string): void
  setPlaying(): void
  updateDwarves(dwarves: DwarfStatus[]): void
  updateHUD(tick: number, viewZ: number, camX: number, camY: number): void
  setSelectedEid(eid: number | null): void
  toggleHelp(): void
}

type Props = {
  onReady(handle: GameUIHandle): void
  onSelectDwarf(eid: number | null): void
}

export function GameUI({ onReady, onSelectDwarf }: Props) {
  const [phase, setPhase]         = useState<'loading' | 'playing'>('loading')
  const [progress, setProgress]   = useState(0)
  const [label, setLabel]         = useState('Preparing world...')
  const [dwarves, setDwarves]     = useState<DwarfStatus[]>([])
  const [selectedEid, setSelectedEidState] = useState<number | null>(null)
  const [hud, setHud]             = useState({ tick: 0, viewZ: 0, camX: 0, camY: 0 })
  const [helpOpen, setHelpOpen]   = useState(false)

  const handleSelectDwarf = useCallback((eid: number | null) => {
    setSelectedEidState(eid)
    onSelectDwarf(eid)
  }, [onSelectDwarf])

  useEffect(() => {
    const handle: GameUIHandle = {
      setProgress:   (p, l) => { setProgress(p); setLabel(l) },
      setPlaying:    ()     => setPhase('playing'),
      updateDwarves: (d)    => setDwarves(d),
      updateHUD:     (tick, viewZ, camX, camY) => setHud({ tick, viewZ, camX, camY }),
      setSelectedEid: (eid) => setSelectedEidState(eid),
      toggleHelp:    ()     => setHelpOpen(h => !h),
    }
    onReady(handle)
  }, [onReady])

  if (phase === 'loading') {
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'auto' }}>
        <WorldGenProgressScreen progress={progress} label={label} />
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* HUD top-left */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 16,
        fontSize: 12,
        color: '#aaa',
        fontFamily: 'monospace',
        lineHeight: 1.6,
        pointerEvents: 'none',
      }}>
        <div>Z: {hud.viewZ}{hud.viewZ === 0 ? ' (surface)' : ' (underground)'}</div>
        <div>Tick: {hud.tick}</div>
        <div>X: {hud.camX}  Y: {hud.camY}</div>
      </div>

      {/* Help hint bottom-right (above sidebar) */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        right: 232,
        fontSize: 12,
        color: '#666',
        fontFamily: 'monospace',
        pointerEvents: 'none',
      }}>
        H — help
      </div>

      {/* Sidebar */}
      <Sidebar
        dwarves={dwarves}
        selectedEid={selectedEid}
        onSelect={handleSelectDwarf}
      />

      {/* Help modal */}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  )
}
