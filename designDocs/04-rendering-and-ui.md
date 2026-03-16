# Rendering & UI System

## Overview

The frontend is a React + TypeScript app that renders an ASCII character grid to an HTML5 canvas. It is purely a viewer — zero simulation logic. All game state comes from Supabase Realtime subscriptions.

## Layout

Full-viewport, no page scroll. Three-panel layout:

```
┌─────────────────────────────────────────────────────────────┐
│  TOOLBAR: pWarf | year | civ name | pop | wealth | alerts   │
├───────────────┬─────────────────────────┬───────────────────┤
│               │                         │                   │
│  LEFT PANEL   │      MAIN VIEWPORT      │   RIGHT PANEL     │
│  (200px)      │    (flex-1, ~60%)       │   (220px)         │
│               │                         │                   │
├───────────────┼─────────────────────────┼───────────────────┤
│               │    MODE TOGGLE BAR      │                   │
├───────────────┴─────────────────────────┴───────────────────┤
│  BOTTOM BAR: tile coords | terrain info | keybind hints     │
└─────────────────────────────────────────────────────────────┘
```

### Panels

- **Left Panel** (`LeftPanel.tsx`): Context-sensitive. Fortress mode shows dwarf roster (name + current job, color-coded by stress). World mode shows hovered tile info (terrain, biome, elevation). Collapsible to 24px with `[` key.

- **Right Panel** (`RightPanel.tsx`): Tabbed — "Log" (activity feed) and "Legends" (world history). Collapsible to 24px with `]` key.

- **Both panels** use CSS `transition-[width]` for smooth collapse/expand.

## Canvas Renderer

The `MainViewport` component (`app/src/components/MainViewport.tsx`) renders tiles to a `<canvas>` element.

### Character Grid

| Parameter | Value | Notes                          |
|-----------|-------|--------------------------------|
| CHAR_W    | 10px  | Width of one character cell    |
| CHAR_H    | 18px  | Height of one character cell   |
| Font      | 16px  | IBM Plex Mono / Fira Code      |

At a 1200×800 viewport (minus panels), the visible grid is approximately **80 columns × 44 rows** = 3,520 tiles.

### Grid Snapping

**Critical invariant**: tiles are always rendered at integer multiples of CHAR_W and CHAR_H. No fractional offsets, ever. This keeps the ASCII grid crisp.

Panning (both keyboard and mouse drag) updates `offsetX`/`offsetY` by whole integers. Mouse drag calculates tile delta as `Math.round(pixelDelta / charSize)`.

### Render Loop

Each frame:
1. Clear canvas with background color (#1a1a1a)
2. Calculate visible columns/rows from canvas dimensions
3. For each (col, row):
   a. Compute world coordinates: `wx = offsetX + col`, `wy = offsetY + row`
   b. Look up tile glyph and color from the tile function
   c. If this is the cursor tile, fill background with #333
   d. Draw the character with `fillText`
4. Draw cursor outline (green #4af626 stroke rectangle)

### DPR Handling

The canvas accounts for `devicePixelRatio` — it scales the canvas backing store by DPR and sets CSS dimensions to logical pixels. This ensures crisp text on Retina/HiDPI displays.

### Resize Handling

A `ResizeObserver` on the container div triggers a re-render when the viewport changes size. This handles panel collapse/expand, window resize, and fullscreen transitions.

## Input System

### Keyboard (`useKeyboard` hook)

| Key        | Action               |
|------------|---------------------|
| WASD       | Pan viewport ±1 tile |
| Arrow keys | Pan viewport ±1 tile |
| Tab        | Toggle fortress/world mode |
| `[`        | Toggle left panel    |
| `]`        | Toggle right panel   |

The hook ignores keypresses when focus is in an `<input>` or `<textarea>`.

### Mouse

| Action     | Behavior                           |
|------------|-----------------------------------|
| Hover      | Updates cursor position (highlighted tile) |
| Click-drag | Pans viewport by tile delta        |
| Click      | (Planned) Select tile for interaction |

Drag state is tracked with a `useRef` to avoid re-render lag. Drag start captures the initial mouse position and viewport offset; drag move computes integer tile delta from the start position.

## Viewport State (`useViewport` hook)

```typescript
{
  offsetX: number;   // top-left tile X (world coords)
  offsetY: number;   // top-left tile Y (world coords)
  cursorX: number;   // highlighted tile X (world coords)
  cursorY: number;   // highlighted tile Y (world coords)
}
```

All values are integers. The hook exposes `pan()`, `setCursor()`, and drag handlers.

## Visual Style

### Color Palette

| CSS Variable     | Hex       | Usage                          |
|-----------------|-----------|--------------------------------|
| `--bg`          | #1a1a1a   | Canvas/page background         |
| `--bg-panel`    | #222      | Side panels, toolbar, bottom bar |
| `--bg-hover`    | #2a2a2a   | Hover states                   |
| `--border`      | #333      | Panel borders                  |
| `--text`        | #b5b5b5   | Default text                   |
| `--text-bright` | #d4d4d4   | Emphasized text                |
| `--green`       | #4af626   | Positive/player entities       |
| `--amber`       | #ffbf00   | Warnings, labels               |
| `--red`         | #ff4444   | Danger, critical needs         |
| `--cyan`        | #00cccc   | Log bullets, info              |
| `--blue`        | #5555ff   | Water, links                   |

### Semantic Color Rules

- **White → Yellow → Red** for stress/danger gradient
- **Green** for player entities (dwarves, cursor, active elements)
- **Sickly green** for contaminated ruins
- **Amber** for warnings and headers
- Color carries meaning, not decoration

### Typography

Monospace only. Font stack: `IBM Plex Mono → Fira Code → Cascadia Code → monospace`. Base size 14px. The canvas uses 16px (CHAR_H - 2) for tile glyphs.

## Mode Toggle

A small bar between the main viewport and bottom bar lets the player switch between Fortress and World mode. Tab key also toggles. The active mode is highlighted in green.
