/**
 * Tests for WorldGenProgressScreen React component.
 * Uses react-dom/client + jsdom (no @testing-library/react required).
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { WorldGenProgressScreen } from '@ui/WorldGenProgressScreen'

describe('WorldGenProgressScreen', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    document.body.removeChild(container)
  })

  it('renders a progressbar with correct aria-valuenow at 50%', () => {
    act(() => {
      root.render(React.createElement(WorldGenProgressScreen, { progress: 0.5, label: 'Testing...' }))
    })
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar).not.toBeNull()
    expect(bar?.getAttribute('aria-valuenow')).toBe('50')
  })

  it('shows the label text', () => {
    act(() => {
      root.render(React.createElement(WorldGenProgressScreen, { progress: 0.3, label: 'Raising mountains...' }))
    })
    expect(container.textContent).toContain('Raising mountains...')
  })

  it('has role="progressbar" present', () => {
    act(() => {
      root.render(React.createElement(WorldGenProgressScreen, { progress: 0.0, label: 'Starting...' }))
    })
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar).not.toBeNull()
  })

  it('aria-valuenow is 0 at progress 0', () => {
    act(() => {
      root.render(React.createElement(WorldGenProgressScreen, { progress: 0, label: '' }))
    })
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute('aria-valuenow')).toBe('0')
  })

  it('aria-valuenow is 100 at progress 1.0', () => {
    act(() => {
      root.render(React.createElement(WorldGenProgressScreen, { progress: 1.0, label: 'Done' }))
    })
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute('aria-valuenow')).toBe('100')
  })
})
