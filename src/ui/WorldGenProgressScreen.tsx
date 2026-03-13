import React, { useEffect, useState } from 'react'

const FLAVOR_TEXT = [
  'A world is born from chaos and stone...',
  'The mountains remember their names.',
  'Underground rivers find their paths.',
  'Ancient ore waits in the dark.',
  'Civilizations rise and fall in an instant.',
  'The dwarves are restless.',
  'Pick axe sharpened. Ready.',
]

type Props = {
  progress: number   // 0.0–1.0
  label: string
  onComplete?: () => void
}

export function WorldGenProgressScreen({ progress, label, onComplete }: Props) {
  const [flavorIndex, setFlavorIndex] = useState(0)

  // Cycle flavor text every 2 seconds
  useEffect(() => {
    const id = setInterval(() => {
      setFlavorIndex(i => (i + 1) % FLAVOR_TEXT.length)
    }, 2000)
    return () => clearInterval(id)
  }, [])

  // Call onComplete when generation finishes
  useEffect(() => {
    if (progress >= 1.0) {
      onComplete?.()
    }
  }, [progress, onComplete])

  const pct = Math.round(progress * 100)
  const flavor = FLAVOR_TEXT[flavorIndex] ?? FLAVOR_TEXT[0]!

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: '#111',
        color: '#c8b87a',
        fontFamily: 'monospace',
        gap: '1rem',
      }}
    >
      <div style={{ fontSize: '2rem' }}>(•_•) &lt;( ⌐■-■)  (⌐■-■)&gt;</div>
      <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Generating World</div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          width: '60%',
          height: '20px',
          background: '#333',
          border: '1px solid #666',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${pct}%`,
            background: '#8a6d2f',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div>{label}</div>
      <div style={{ color: '#999', fontStyle: 'italic', fontSize: '0.9rem' }}>{flavor}</div>
    </div>
  )
}
