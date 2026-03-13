# Game State

Current playable state of pwarf. Updated with each PR that changes gameplay, rendering, UI, or systems.

## What's implemented

### Rendering
- PixiJS canvas (512×512px) centered in the browser window
- Tile rendering at z=0: stone floor covers the entire 128×128 surface
- Dwarves rendered as cyan squares (12×12px inset within a 16px tile)
- Camera starts centered on the dwarf spawn point

### Camera controls
| Key | Action |
|-----|--------|
| Arrow keys / WASD | Pan the camera |
| `+` / `=` | Move up one z-level |
| `-` | Move down one z-level |

### Simulation
- ECS world powered by bitecs v0.4
- 7 dwarves spawn at map center (64, 64) on z=0
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
- No UI overlay (React layer not yet wired up)
- No save/load
- No enemies or events
