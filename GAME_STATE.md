# Game State

Current playable state of pwarf. Updated with each PR that changes gameplay, rendering, UI, or systems.

## What's implemented

### Rendering
- PixiJS canvas (fullscreen — fills the browser window)
- Tile rendering at z=0: stone floor covers the entire 128×128 surface
- Dwarves rendered as cyan squares (12×12px inset within a 16px tile)
- Camera starts centered on the dwarf spawn point

### Camera controls
| Key | Action |
|-----|--------|
| Arrow keys / WASD | Pan the camera (clamped to world bounds) |
| `+` / `=` | Go deeper (underground) |
| `-` | Go up (toward surface) |
| `H` | Toggle help modal |

### HUD / UI
- Z-level display: shows current z and "(surface)" / "(underground)" label
- Tick counter updates in real time
- "No dwarves on this level" warning when none visible at current z
- Click a dwarf to select it — HUD shows name and position
- Help modal (H key) lists all controls; ESC or click to dismiss

### Simulation
- ECS world powered by bitecs v0.4
- 7 dwarves spawn near map center (scattered ±4 tiles from 64, 64) on z=0
- Each dwarf has a procedurally generated name (e.g. "Urist Hammerstone")
- Tick loop runs at 20 ticks/second
- Movement system: dwarves wander randomly each tick

### Map
- 128×128×16 tile world
- z=0: flat stone floor across the entire surface
- z=1–15: empty air (not yet generated)
- Tile types defined: Air, Stone, Soil, Water, Floor, Wall

## What's not yet playable
- No jobs, tasks, or AI goals
- No items, food, or needs
- No digging or construction
- No React UI layer (HUD and help modal are plain HTML)
- No save/load
- No enemies or events
