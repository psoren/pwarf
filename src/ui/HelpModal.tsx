import React from 'react'

type Props = { onClose: () => void }

export function HelpModal({ onClose }: Props) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
        pointerEvents: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1e1e1e',
          border: '1px solid #444',
          padding: '24px 32px',
          minWidth: 280,
          fontFamily: 'monospace',
          color: '#ccc',
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: 16, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 14 }}>
          Controls
        </div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {[
              ['W A S D / Arrows', 'Pan camera'],
              ['+ / =',            'Go up (toward surface)'],
              ['−',                'Go deeper (underground)'],
              ['M',                'Toggle mine mode (drag to designate)'],
              ['H',                'Toggle this help'],
              ['Esc',              'Close / deselect'],
            ].map(([key, desc]) => (
              <tr key={key}>
                <td style={{ padding: '4px 0', color: '#6af', width: 160, fontSize: 13 }}>{key}</td>
                <td style={{ padding: '4px 0', color: '#aaa', fontSize: 13 }}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 20, fontSize: 11, color: '#555', textAlign: 'center' }}>
          Press H or click outside to close
        </div>
      </div>
    </div>
  )
}
