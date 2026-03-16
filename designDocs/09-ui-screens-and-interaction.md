# UI Screens & Interaction Design

## Overview

This document describes the player-facing UI: what the player sees, how screens flow together, and how they interact with the game. For technical rendering details (canvas, grid snapping, DPR), see `04-rendering-and-ui.md`.

## Screen Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Main Menu   │────▶│  World Gen   │────▶│   Embark     │
│              │     │  (loading)   │     │  (pick site) │
└──────┬───────┘     └──────────────┘     └──────┬───────┘
       │                                         │
       │  Load Game                               │  Start
       ▼                                         ▼
┌──────────────┐                          ┌──────────────┐
│  Save Slots  │─────────────────────────▶│  Game HUD    │
│  (pick slot) │                          │  (playing)   │
└──────────────┘                          └──────┬───────┘
                                                 │
                                          Esc or Menu btn
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │  Pause Menu  │
                                          └──────────────┘
```

## 1. Main Menu

Full-screen, dark background with ASCII art title. No game state loaded yet.

```
         ██████  ██     ██  █████  ██████  ███████
         ██   ██ ██     ██ ██   ██ ██   ██ ██
         ██████  ██  █  ██ ███████ ██████  █████
         ██      ██ ███ ██ ██   ██ ██   ██ ██
         ██       ███ ███  ██   ██ ██   ██ ██

              [ New Game ]
              [ Load Game ]
              [ Browse Ruins ]
              [ Settings ]
```

**Behavior:**
- **New Game** → World Generation screen
- **Load Game** → Save Slots screen (lists local and cloud saves)
- **Browse Ruins** → Graveyard browser (read-only exploration of published ruins)
- **Settings** → Settings screen

Navigation: arrow keys or mouse. Enter to select.

## 2. World Generation

Shown while the server generates the world. Displays a progress log in terminal style.

```
Generating world...
  ■■■■■■■■■■░░░░░░  Terrain
  ■■■■■■░░░░░░░░░░  Civilizations
  ░░░░░░░░░░░░░░░░  History

Year 0... founding civilizations
Year 12... first war between Hill Dwarves and Goblins
Year 47... megabeast sighting in the southern jungle
```

The log scrolls as history is generated, giving the player a preview of their world's story. When generation completes, the player is taken to the Embark screen.

## 3. Embark Screen

The world map fills the viewport. The player picks a starting location for their fortress.

```
┌────────────────────────────────────────────────┐
│  EMBARK — Choose your fortress site             │
├────────────────────────────────┬────────────────┤
│                                │ Site Info      │
│     (world map, scrollable)   │                │
│                                │ Biome: Forest  │
│         [ cursor here ]       │ Elevation: 3   │
│                                │ Rainfall: High │
│                                │ Aquifer: Yes   │
│                                │ Neighbors: 2   │
│                                │                │
│                                │ [ Embark Here ]│
├────────────────────────────────┴────────────────┤
│  WASD: scroll   Enter: embark   Esc: back       │
└────────────────────────────────────────────────┘
```

**Right panel** shows details about the tile under the cursor: biome, elevation, rainfall, presence of aquifer, nearby civilizations. The player presses Enter or clicks "Embark Here" to start.

## 4. Game HUD (Main Play Screen)

The three-panel layout described in `04-rendering-and-ui.md`. This section focuses on what each area **shows the player**.

### Toolbar (top bar)

```
pWarf  │  Year 47  │  Ûshrir Zuglarunal  │  Pop: 12  │  ☼ 4,320  │  ⚠ Siege imminent
```

- **Game name** — always visible, amber
- **Year** — current sim year
- **Civ name** — the player's fortress name (green in fortress mode, gray in world mode with "World Map" label)
- **Population** — current living dwarf count
- **Wealth** — total fortress wealth (☼ symbol)
- **Alerts** — most urgent alert, color-coded (red for threats, amber for warnings, green for positive events). Clicking cycles through active alerts.

### Left Panel — Fortress Mode: Dwarf Roster

A scrollable list of all dwarves. Each entry shows:

```
┌─ Dwarves (12) ──────────┐
│                          │
│  Urist McAxedwarf        │
│  ⛏ Mining (hauling ore)  │
│  ████████░░ Stress: 23   │
│                          │
│  Kadol Craftmaster       │
│  💤 Sleeping              │
│  ████░░░░░░ Stress: 61   │
│                          │
│  Aban Shieldbreaker      │
│  ⚔ Combat (goblin)       │
│  ██████████ Stress: 89   │
│                          │
│  ...                     │
└──────────────────────────┘
```

- **Name** in bright text
- **Current activity** with icon prefix (⛏ working, 💤 sleeping, 🍖 eating, ⚔ fighting, 😤 tantrum, … idle)
- **Stress bar** — gradient fill: green (0–30), yellow (31–60), orange (61–80), red (81–100)
- Clicking a dwarf opens the **Dwarf Detail** overlay

**Sorting:** defaults to stress (highest first). Header cycles: stress → name → activity.

### Left Panel — World Mode: Tile Inspector

When in world mode, the left panel shows information about the tile under the cursor:

```
┌─ Tile Info ──────────────┐
│                          │
│  Forest (temperate)      │
│  Elevation: 3            │
│  Rainfall: High          │
│                          │
│  Settlements:            │
│    Ûshrir (dwarf, pop 12)│
│                          │
│  History:                │
│    Y12 — Founded         │
│    Y34 — Goblin raid     │
│    Y41 — Dragon sighted  │
│                          │
└──────────────────────────┘
```

### Right Panel — Log Tab

A reverse-chronological activity feed. Events color-coded by type:

```
┌─ Log ──────── Legends ───┐
│                          │
│ * Urist cancels Mine:    │
│   interrupted by goblin  │
│ * Caravan arrived from   │
│   Mountainhome           │
│ * Kadol created a        │
│   masterwork chair       │
│ * Goblin siege begins!   │
│                          │
└──────────────────────────┘
```

- Cyan bullet for routine events
- Amber for notable (artifacts, caravans)
- Red for threats (sieges, deaths, tantrums)
- Green for positive (births, masterworks)

### Right Panel — Legends Tab

A condensed timeline of world history:

```
┌─ Log ──────── Legends ───┐
│                          │
│ Year 0                   │
│   The world began.       │
│                          │
│ Year 12                  │
│   Ûshrir was founded     │
│   by Urist McLeader.     │
│                          │
│ Year 34                  │
│   The goblin host of     │
│   Snagûl raided Ûshrir.  │
│   3 dwarves fell.        │
│                          │
└──────────────────────────┘
```

### Bottom Bar

```
(43, 17) z:0  │  Stone floor  │  WASD: pan  Tab: mode  []: panels  D: designate  M: military
```

- **Coordinates** — tile position and z-level
- **Tile description** — what's under the cursor (terrain, structure, item)
- **Keybind hints** — context-sensitive, changes based on active mode/tool

### Mode Toggle Bar

Between viewport and bottom bar. Two buttons: **Fortress** and **World**. Active mode has green text and underline. Tab also toggles.

## 5. Dwarf Detail Overlay

Opened by clicking a dwarf in the roster. A modal overlay (not full-screen) anchored to the left panel.

```
┌─ Urist McAxedwarf ───────────────────┐
│                                      │
│  Activity: Mining (level 3 ore vein) │
│  Location: (12, 8) z:-2             │
│                                      │
│  Needs            Current            │
│  ─────────────────────────           │
│  Food     ████████░░  78             │
│  Drink    ██████░░░░  55             │
│  Sleep    ████░░░░░░  41             │
│  Social   ██████████  92             │
│  Purpose  ███████░░░  68             │
│  Beauty   █████░░░░░  48             │
│                                      │
│  Stress: 23 (content)                │
│                                      │
│  Skills                              │
│  ─────────────────────────           │
│  Mining ★★★★☆  Masonry ★★☆☆☆        │
│  Combat ★☆☆☆☆  Cooking ★★★☆☆        │
│                                      │
│  Recent Thoughts                     │
│  ─────────────────────────           │
│  "Was pleased by a fine chair."      │
│  "Annoyed by the lack of drinks."    │
│                                      │
│                        [ Dismiss ]   │
└──────────────────────────────────────┘
```

Shows needs bars, skills, personality traits, recent thoughts/memories that are driving stress up or down. Esc or clicking outside closes it.

## 6. Designation Mode

Entered by pressing **D** during fortress mode. The bottom bar updates to show designation tools:

```
(43, 17) z:0  │  DESIGNATING  │  1: Mine  2: Channel  3: Chop  4: Stockpile  5: Farm  Esc: cancel
```

**Workflow:**
1. Press a number key to select designation type
2. Click and drag on the map to paint a rectangle
3. Designated tiles are highlighted with a colored overlay (amber for mine, green for chop, blue for stockpile)
4. Dwarves with matching skills will pick up the jobs automatically
5. Esc exits designation mode

Designation overlays persist on the map until the job is completed. Completed designations fade out.

## 7. Military Screen

Opened by pressing **M**. Replaces the left panel content with squad management.

```
┌─ Military ───────────────┐
│                          │
│  Squad 1: "The Picks"   │
│  ────────────────────    │
│  Urist (leader) ⚔       │
│  Kadol           ⚔       │
│  Aban            ⚔       │
│  Status: Patrolling      │
│                          │
│  [ + New Squad ]         │
│                          │
│  Unassigned:             │
│  Doren, Litast, Mafol    │
│                          │
│  ────────────────────    │
│  P: set patrol zone      │
│  S: station squad        │
│  A: attack target        │
│  Esc: close              │
└──────────────────────────┘
```

Squads can be given orders: patrol a zone, station at a point, or attack a specific target. Dwarves in squads prioritize military jobs over civilian ones.

## 8. Pause Menu

Esc during gameplay opens a centered overlay:

```
         ┌───────────────────┐
         │                   │
         │   ▌▌ PAUSED       │
         │                   │
         │   [ Resume ]      │
         │   [ Save Game ]   │
         │   [ Settings ]    │
         │   [ Main Menu ]   │
         │                   │
         └───────────────────┘
```

The game sim pauses while this menu is open. "Main Menu" prompts a save confirmation if there are unsaved changes.

## 9. Save / Load Screen

Accessible from the pause menu or main menu. Shows a list of save slots.

```
┌─ Save Slots ─────────────────────────────────────┐
│                                                   │
│  LOCAL SAVES                                      │
│  ─────────────────────────────────────            │
│  Slot 1: Ûshrir Zuglarunal — Year 47, Pop 12     │
│          Saved 2 hours ago                        │
│                                                   │
│  Slot 2: Bomrek Nishgatin — Year 103, Pop 31     │
│          Saved 3 days ago                         │
│                                                   │
│  Slot 3: (empty)                                  │
│                                                   │
│  CLOUD SAVES (requires login)                     │
│  ─────────────────────────────────────            │
│  Cloud 1: Ûshrir Zuglarunal — Year 44, Pop 11    │
│           Synced 1 day ago                        │
│                                                   │
│  ─────────────────────────────────────            │
│  Enter: load/save   Del: delete slot   Esc: back │
└───────────────────────────────────────────────────┘
```

When saving, selecting an occupied slot prompts overwrite confirmation.

## 10. Settings Screen

```
┌─ Settings ───────────────────────────────────────┐
│                                                   │
│  Game                                             │
│  ─────────────────────────────────────            │
│  Sim Speed       [ Slow | Normal | Fast ]         │
│  Auto-pause      [ On sieges | On deaths | Off ]  │
│                                                   │
│  Display                                          │
│  ─────────────────────────────────────            │
│  Tile Size       [ Small | Medium | Large ]       │
│  Font            [ IBM Plex | Fira Code ]         │
│                                                   │
│  Controls                                         │
│  ─────────────────────────────────────            │
│  Pan Keys        [ WASD | Arrows | Both ]         │
│                                                   │
│  Audio                                            │
│  ─────────────────────────────────────            │
│  Music           ████████░░  80%                  │
│  SFX             ██████░░░░  60%                  │
│                                                   │
│                              [ Apply ] [ Back ]   │
└───────────────────────────────────────────────────┘
```

## 11. Fortress Death / Epitaph Screen

When the player's civilization falls (all dwarves dead or fled), the game transitions to a full-screen epitaph:

```

    Here lie the ruins of Ûshrir Zuglarunal.

    Founded in Year 12 by Urist McLeader.
    Fell in Year 47 to a goblin siege.

    Peak population: 18
    Final wealth: ☼ 12,340
    Dwarves lost: 18

    Cause of death: Overwhelmed by siege

    "They delved too deep, and drank too little."

              [ Publish to Graveyard ]
              [ Return to Main Menu ]
```

"Publish to Graveyard" makes the ruin available for other players to discover and explore.

## 12. Ruin Browser (Graveyard)

Accessible from the main menu. A scrollable list of published ruins from all players.

```
┌─ The Graveyard ──────────────────────────────────┐
│                                                   │
│  Search: [_______________]   Sort: [ Newest ▼ ]  │
│                                                   │
│  ☠ Bomrek Nishgatin          Danger: ████░░  67  │
│    Fell Y103 — Tantrum spiral. Pop 31.            │
│    Published by player_42                         │
│                                                   │
│  ☠ Asdos Lashbrewed         Danger: ██████  89   │
│    Fell Y67 — Dragon attack. Pop 8.               │
│    Published by mountainking                      │
│                                                   │
│  ☠ Kadol's Folly            Danger: ██░░░░  22   │
│    Fell Y12 — Starvation. Pop 3.                  │
│    Published by newbie99                          │
│                                                   │
│  Enter: explore ruin   Esc: back                  │
└───────────────────────────────────────────────────┘
```

Selecting a ruin loads its map in read-only fortress mode. The player can pan around, inspect the layout, see where dwarves fell, and read the ruin's history in the Legends tab.

## Interaction Principles

1. **Keyboard-first, mouse-supported.** Every action has a keyboard shortcut. Mouse works for everything but is never required.
2. **Context in the bottom bar.** The bottom bar always shows available keybinds for the current mode/state. The player should never have to guess what keys do.
3. **Color carries meaning.** Green = player/positive, amber = warning/notable, red = danger/critical, cyan = info. Never use color for pure decoration.
4. **No popups for routine events.** Routine information goes to the log panel. Only critical state changes (siege, death, fortress fall) get modal overlays or auto-pause.
5. **Progressive disclosure.** The main HUD shows the minimum needed. Details are one click/keypress away (dwarf detail, tile info, designation tools).
6. **ASCII aesthetic everywhere.** All UI elements — borders, bars, indicators — use box-drawing characters and monospace text. No bitmap icons or gradients.
