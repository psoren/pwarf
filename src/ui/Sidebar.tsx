import React from 'react'
import type { DwarfStatus } from '@core/types'
import { nameStore } from '@core/stores'

const STATE_NAMES = ['Idle', 'SeekingJob', 'Working', 'Eating', 'Drinking', 'Sleeping', 'Tantrum', 'Dead']

const STATE_COLORS: Record<string, string> = {
  Idle:       '#888',
  SeekingJob: '#aaa',
  Working:    '#6af',
  Eating:     '#DAA520',
  Drinking:   '#44DDFF',
  Sleeping:   '#88aaff',
  Tantrum:    '#ff4444',
  Dead:       '#444',
}

function NeedsBar({ value, low, high }: { value: number; low: string; high: string }) {
  const pct = Math.round(value * 100)
  const color = value > 0.5 ? high : value > 0.25 ? '#ff8800' : '#ff2200'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#888' }}>
      <div style={{ width: 60, height: 4, background: '#333', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ color, minWidth: 28 }}>{pct}%</span>
    </div>
  )
}

type DwarfRowProps = {
  dwarf: DwarfStatus
  isSelected: boolean
  onClick: () => void
}

function DwarfRow({ dwarf, isSelected, onClick }: DwarfRowProps) {
  const name = nameStore.get(dwarf.eid) ?? `Dwarf #${dwarf.eid}`
  const stateName = STATE_NAMES[dwarf.state ?? 0] ?? 'Idle'
  const stateColor = STATE_COLORS[stateName] ?? '#888'
  const isDead = stateName === 'Dead'

  return (
    <div
      onClick={onClick}
      style={{
        padding: '8px 12px',
        cursor: isDead ? 'default' : 'pointer',
        background: isSelected ? '#2a2a3a' : 'transparent',
        borderLeft: isSelected ? '2px solid #DAA520' : '2px solid transparent',
        borderBottom: '1px solid #222',
        opacity: isDead ? 0.4 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ color: isSelected ? '#DAA520' : '#ccc', fontSize: 12, fontWeight: isSelected ? 'bold' : 'normal' }}>
          {name}
        </span>
        <span style={{ color: stateColor, fontSize: 10 }}>{stateName}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <NeedsBar value={dwarf.hunger} low="#ff2200" high="#ff8800" />
        <NeedsBar value={dwarf.thirst} low="#ff2200" high="#44DDFF" />
        <NeedsBar value={dwarf.sleep}  low="#ff2200" high="#88aaff" />
      </div>
    </div>
  )
}

type SidebarProps = {
  dwarves: DwarfStatus[]
  selectedEid: number | null
  onSelect: (eid: number | null) => void
}

export function Sidebar({ dwarves, selectedEid, onSelect }: SidebarProps) {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: 220,
      height: '100%',
      background: '#111',
      borderLeft: '1px solid #333',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'monospace',
      pointerEvents: 'auto',
      zIndex: 10,
    }}>
      <div style={{
        padding: '10px 12px',
        fontSize: 11,
        color: '#666',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        borderBottom: '1px solid #333',
      }}>
        Dwarves ({dwarves.length})
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {dwarves.map(d => (
          <DwarfRow
            key={d.eid}
            dwarf={d}
            isSelected={d.eid === selectedEid}
            onClick={() => onSelect(d.eid === selectedEid ? null : d.eid)}
          />
        ))}
      </div>
    </div>
  )
}
