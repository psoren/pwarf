# pwarf

A browser-based Dwarf Fortress clone. Colony sim with autonomous dwarves in a procedurally generated world.

## How to play

```bash
npm install
npm run dev
```

Open `http://localhost:5173/pwarf/` in your browser.

### Controls

| Key | Action |
|-----|--------|
| Arrow keys / WASD | Pan the camera |
| `+` / `=` | Move up one z-level |
| `-` | Move down one z-level |

### What you're looking at

- **Gray tiles** — stone floor at the surface (z=0)
- **Cyan squares** — your 7 dwarves, wandering from their spawn point at map center

See [GAME_STATE.md](GAME_STATE.md) for a full breakdown of what's currently implemented.

## Development

```bash
npm run dev        # dev server
npm test           # run tests
npm run build      # typecheck + production build
npm run lint       # lint
```
