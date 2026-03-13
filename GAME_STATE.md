# Game State

Current playable state of pwarf. Updated with each PR that changes gameplay, rendering, UI, or systems.

## What's implemented

### Rendering
- PixiJS canvas (fullscreen — fills the browser window)
- Tile rendering at z=0: procedurally generated surface (grass, sand, snow, water, stone peaks)
- Underground z-levels: stone, ore veins, caverns, magma at deepest level
- Dwarves rendered as goldenrod squares (12×12px); selected dwarf gets a white border
- Camera starts centered on the actual embark site after world gen

### Camera controls
| Key | Action |
|-----|--------|
| Arrow keys / WASD | Pan the camera (±10 tile margin at edges) |
| `+` / `=` | Go up (toward surface) |
| `−` | Go deeper (underground) |
| `H` | Toggle help modal |

### HUD / UI
- Loading screen with progress bar during world gen ("Raising mountains...", etc.)
- Z-level display: shows current z and "(surface)" / "(underground)" label
- X/Y camera position display
- Tick counter updates in real time
- "No dwarves on this level" warning when none visible at current z
- Click a dwarf tile to select it — HUD shows name, AI state, and needs (Hunger/Thirst/Sleep %); white border highlights selection
- Help modal (H key) lists all controls; ESC or click to dismiss

### World generation (Phase 1)
- Procedural 128×128×16 world generated from seed 42 on startup (takes ~1–3s)
- **Heightmap:** fBm simplex noise with 6 octaves, power curve for dramatic peaks
- **Biomes:** temperature × moisture → Tundra, Desert, Grassland, Forest, Savanna, Tropical, Rainforest, Ocean
- **Surface tiles:** grass (temperate), sand (desert), snow (tundra), water (ocean/rivers), stone (mountain peaks)
- **Rivers:** D8 flow accumulation → water tiles connect highland to ocean
- **Underground:** layered stone (granite/limestone/sandstone/basalt/marble), ore veins (coal/iron/copper/gold/adamantine), caverns, magma at z=15
- **Embark site:** selects a non-water non-mountain tile cluster, places 7 named dwarves there
- Deterministic: same seed → identical world

### Simulation (Phase 2)
- ECS world powered by bitecs v0.4
- 7 dwarves spawn scattered (±2 tiles) around the embark site on z=0
- Each dwarf has a procedurally generated name (e.g. "Urist Hammerstone")
- Tick loop runs at 20 ticks/second
- **Needs system:** hunger, thirst, and sleep decay over time; dwarves seek food/drink/sleep when critical
- **AI system:** dwarves have states — Idle, SeekingJob, ExecutingJob, Eating, Drinking, Sleeping, Tantrum, Dead
- **Mood system:** happiness tracks needs satisfaction; bad mood → tantrums
- **Consumption system:** dwarves eat/drink to replenish needs
- **Sleeping system:** dwarves rest to recover sleep need
- **Tantrum system:** very unhappy dwarves enter tantrum state
- **Hauling system:** dwarves haul loose items to stockpiles
- **Mining system:** dwarves execute mine-designation jobs
- **Job cleanup:** removes completed/abandoned jobs
- Movement system: dwarves pathfind toward goals (random wander when idle)

## What's not yet playable
- No UI to designate mining or stockpile areas (must be triggered via code)
- No items, food, or needs resources placed in world yet — dwarves eventually starve
- No React UI layer (HUD and help modal are plain HTML)
- No save/load
- No enemies or events
- No construction
