# Brainstorm: Sounds & Animations for pWarf

## Current State

- Zero audio infrastructure
- Zero animation infrastructure
- ASCII canvas is fully stateless — each tick redraws everything from scratch
- 10 ticks/sec event-driven render cycle
- Rich event stream already flowing: combat, death, tantrum, mining, disease, monster spawns, artifacts, etc.

---

## Guiding Principles

- **Stay ASCII.** pWarf's identity is its terminal aesthetic. Animations should enhance that, not break it.
- **Event-driven first.** Sound and visual effects should be reactions to `WorldEvent` and `SimSnapshot` state — not timers.
- **Headless sim stays clean.** No audio or animation code in `sim/`. Everything lives in `app/`.
- **Performance.** Canvas redraws at 10Hz. Effects must not tank framerate or cause janky re-renders.
- **Mutable by default.** All sounds and animations should be toggleable via settings.

---

## Sounds

### Tech Options

| Option | Pros | Cons |
|--------|------|------|
| **Web Audio API (native)** | No dependency, precise timing | Verbose to use |
| **Howler.js** | Simple API, sprite sheets, volume/fade | External dep |
| **Tone.js** | Synthesized sound (no audio files needed!) | Complex API, larger bundle |

**Recommendation: Tone.js for synthesized/procedural sounds** — no asset files needed, fits the ASCII aesthetic, fully seeded/deterministic if we want. Fallback: Howler.js + `.ogg` audio sprites.

### Sound Categories & Triggers

#### Mining & Construction
- `pick_hit` — every tick a mining task makes progress (`DwarfActionEvent { action: 'mine' }`)
- `wall_placed` — construction task completes
- `rock_crumble` — mine tile becomes exposed floor

#### Combat & Violence
- `sword_clash` — `CombatEvent` (damage > 0)
- `death_thud` — `DeathEvent`
- `tantrum_scream` — `DwarfTantrumEvent` fires
- `item_smash` — `DwarfTantrumEvent.items_destroyed > 0`
- `monster_roar` — `MonsterSpawnEvent` (tone varies by monster type)
- `monster_die` — `MonsterSlainEvent`

#### Needs & Status
- `stomach_growl` — `DwarfNeedCriticalEvent { need: 'food' }`
- `gulp` — dwarf eats or drinks (`DwarfActionEvent { action: 'eat' | 'drink' }`)
- `snore` — dwarf sleeps
- `stress_sting` — dwarf stress crosses 60 (warning tone)

#### Milestones & Drama
- `artifact_fanfare` — `ArtifactCreatedEvent`
- `fortress_fallen` — `FortressFallenEvent` (somber chord or doom sting)
- `caravan_bells` — `TradeCaravanArrivalEvent`
- `disease_cough` — `DiseaseOutbreakEvent`
- `year_chime` — `YearRollupEvent`
- `migration_crowd` — `MigrationEvent`

### Sound Architecture

```
app/src/sounds/
  use-sound-engine.ts     ← React hook, subscribes to snapshot events
  sound-catalog.ts        ← maps event types to synthesizer params or file paths
  synth-presets.ts        ← Tone.js instrument configs (pick, thud, roar, etc.)
```

- `useSoundEngine(snapshot)` — called in `App.tsx`, compares previous vs current events
- Deduplicates sounds per tick (don't play 5 "pick hits" at once — sample one)
- Volume normalization: ambient sounds quieter, drama louder
- Global mute toggle in Toolbar

---

## Animations

### Approach: Canvas Overlay + CSS Transitions

Two layers:
1. **Canvas effects** — drawn on top of the existing ASCII canvas (or a second canvas layer)
2. **CSS/React transitions** — for UI panels, modals, and text elements

No tweening of dwarf positions (they teleport tile to tile — matches the sim model).

### Visual Effects

#### Tile Flash / Glyph Color Pulse
- **Mining flash** — tile briefly lights up amber when a mine tick hits
- **Death flash** — tile flashes red for ~500ms when a dwarf dies there
- **Tantrum flash** — dwarf's tile pulses red while `is_in_tantrum`
- **Combat flash** — brief white flash on defender's tile per `CombatEvent`
- **Artifact glow** — newly created artifact glows yellow for 2s
- **Critical need warning** — dwarf glyph blinks when any need < 10

Implementation: maintain an `effects: Map<string, Effect>` keyed by `"x,y"`, render during canvas draw pass with decay.

#### Screen Effects
- **Fortress fallen** — slow red vignette fade + screen darkens
- **Monster siege** — subtle red tint at screen edges during active siege

#### UI Transitions
- **Event log entries** — slide in from right + fade (replace abrupt append)
- **Modal open/close** — fade in/out (DwarfModal, InventoryModal)
- **Toolbar speed indicator** — animate when paused/unpaused
- **Need bars** — smooth CSS transitions on progress bars in DwarfModal (they already exist as divs)

#### Particles (ASCII-style)
If we want to stay fully in-character, particles can be ASCII glyphs that drift upward and fade out:
- `*` sparks for mining/smithing
- `~` splash for drinking
- `.` debris for item smashing
- `!` impact markers for combat

These would be lightweight: a canvas overlay, an array of `{x, y, char, alpha, vy}` objects, updated on `requestAnimationFrame`.

### Animation Architecture

```
app/src/animations/
  use-canvas-effects.ts    ← React hook, returns effects map + update function
  canvas-effects-layer.ts  ← canvas draw helper, renders effects over main canvas
  css-transitions.ts       ← shared animation constants (durations, easings)
  particle-system.ts       ← ASCII particle emitter/renderer
```

- `useCanvasEffects(snapshot)` — watches snapshot diffs, emits new effects
- Effects have a `ttl` (time-to-live in ms), decay on `requestAnimationFrame`
- Particle system runs its own `rAF` loop (independent of sim tick)
- All effects are purely cosmetic — no sim state affected

---

## Integration Points

### Where to hook in

| Effect type | Integration point |
|-------------|-------------------|
| Sound effects | `App.tsx` → `useSoundEngine(snapshot)` |
| Canvas flash/glow | `MainViewport.tsx` → second canvas layer or overlay in `render()` |
| Particles | `MainViewport.tsx` → overlay canvas with own `rAF` loop |
| UI transitions | CSS in component files + `app.css` |
| Screen effects | CSS overlay `<div>` in `App.tsx` triggered by snapshot state |

### Snapshot data available

Every tick provides:
- `events[]` — all fired events (combat, death, etc.) — primary trigger source
- `dwarves[]` — includes `is_in_tantrum`, `stress_level`, all needs — for continuous effects
- `monsters[]` — positions and behavior — for siege mode detection
- `fortressTileOverrides[]` — newly mined/built tiles — for tile flash

---

## Proposed GitHub Issues

### Phase 1 — Foundation
1. **`feat: sound engine foundation`** — `useSoundEngine` hook + Tone.js install + global mute toggle
2. **`feat: canvas effects layer`** — `useCanvasEffects` hook + overlay canvas + tile flash system
3. **`feat: ASCII particle system`** — lightweight ASCII particle emitter on canvas overlay

### Phase 2 — Core Sounds
4. **`feat: mining and construction sounds`** — pick, crumble, wall place
5. **`feat: combat and death sounds`** — clash, thud, monster roar/die, tantrum scream
6. **`feat: needs and daily life sounds`** — gulp, snore, growl, stress sting

### Phase 3 — Drama
7. **`feat: milestone and event sounds`** — artifact fanfare, fortress fallen, caravan, disease, year chime
8. **`feat: fortress fallen screen effect`** — red vignette + slow darkening
9. **`feat: siege mode screen tint`** — edge glow during active monster siege

### Phase 4 — Polish
10. **`feat: UI transitions and animations`** — event log slide-in, modal fade, need bar transitions
11. **`feat: dwarf need blink warning`** — dwarf glyph blinks when any need is critical
12. **`feat: sound and animation settings`** — toggles for sound/animations in a settings panel

---

## Out of Scope

- Music / ambient soundtrack (separate initiative)
- Sprite-based animations (breaks ASCII identity)
- Tweened dwarf movement (doesn't match sim model, would be misleading)
- Sound in headless/sim mode

---

## Open Questions

- Tone.js vs Howler.js + asset files? Synthesized is dependency-light and fits the aesthetic, but harder to make sound "good". Could do both: synth for ambient/repeated, assets for drama.
- Second canvas vs single canvas for effects? Two canvases (`position: absolute` layered) is cleanest architecture. One canvas requires careful draw order.
- Should effects be seeded/deterministic? Probably not — they're cosmetic. But if we want replay fidelity, pass the sim RNG down.
