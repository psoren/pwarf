# pwarf — Development Roadmap

> Browser-based Dwarf Fortress clone. Stack: TypeScript · PixiJS · bitecs · Vite · React · Vitest

---

## Game Vision

A top-down, tile-based colony sim where the player manages autonomous dwarves in a procedurally generated 3D world. The player never directly controls dwarves — instead they designate zones, place buildings, and assign labor. Dwarves handle the rest.

**Core pillars:** world generation → dwarf AI & jobs → economy & production chains → combat

---

## Phases

### Phase 0 — Scaffolding ✅ Complete

**Deliverable:** A running game you can open in a browser and interact with. 7 dwarves wander a flat stone map, rendered at 20 ticks/sec. Pan the camera with WASD/arrow keys and move between z-levels with `+`/`-`. HUD shows tick count and current z-level. Help overlay explains controls.

What shipped: ECS (bitecs), tick loop, World3D tile structure, HeadlessGame API, PixiJS renderer (fullscreen canvas), keyboard/mouse input handler, random-walk movement system, structured logging (Axiom), HUD overlay, integration tests.

---

### Phase 1 — Terrain Generation 🔄 In progress

**Deliverable:** Embark into a procedurally generated world. The surface has distinct biomes (grass, sand, snow, tundra), rivers, and elevation variation. Underground layers have stone, ore veins, caverns, and magma at the bottom. No two seeds look the same. A progress bar shows during generation.

Spec: [`docs/specs/world-gen-design.md`](specs/world-gen-design.md)

Pipeline: heightmap → biome assignment → underground layers → rivers → tile resolver → world slice builder → embark site

---

### Phase 2 — Dwarf Simulation Core

**Deliverable:** Dwarves that run a real fortress. They path to destinations, pick up and haul items to stockpiles, mine designated tiles, eat when hungry, sleep when tired, and grumble when their needs go unmet. The player can draw a "mine here" designation and watch dwarves do it. **Local save/load ships here** — the game persists to IndexedDB so you don't lose progress on refresh.

Systems needed:
- A* pathfinding on 3D grid
- Job queue + dwarf assignment
- Mining job (dig designated tiles, drop ore item)
- Hauling job (move items to stockpile zones)
- Stockpile zone designation UI
- Needs: hunger, thirst, sleep (simple decay + threshold behaviors)
- Mood system (happy/unhappy dwarves; tantrum at extreme neglect)
- Idle wandering (fallback when no job assigned)
- **Save/load:** serialize ECS world + tile data to IndexedDB; autosave every N ticks; manual save button in UI

---

### Phase 3 — Economy & Production

**Deliverable:** A self-sustaining fortress economy. Mine ore → smelt bars → forge weapons. Plant seeds → grow crops → cook meals. All reactions are defined in YAML — adding a new production step is a data change, not a code change. The stocks screen shows what you have and what's being produced.

Systems needed:
- Workshop entities (forge, smelter, farm plot, kitchen, carpenter's workshop)
- Reaction system: inputs → outputs driven by `data/reactions.yaml`
- Farming: plow → plant → harvest cycles keyed to season
- Metalworking chain: ore → bar → weapon/armor
- Food chain: crop → meal → eaten by dwarf
- Item component model (material, quality, wear)
- Stocks/inventory UI panel

---

### Phase 4 — Combat & Creatures

**Deliverable:** Your fortress can be attacked and can defend itself. Hostile creatures emerge from the underground or arrive in ambushes. You designate a military squad, assign dwarves, and they equip weapons and fight. Combat uses body-part targeting and material-based damage. Injured dwarves need rest to recover.

Systems needed:
- Creature AI (wander, aggro on sight, pathfind to target)
- Body-part model (head, torso, limbs; each has HP and armor)
- Combat resolution (attacker skill + weapon material vs. defender armor + body part)
- Injury tracking (bleeding, broken bones, unconsciousness)
- Military squad orders (station at, patrol, attack target)
- Creature spawn events (triggered by time, depth, or world state)

---

### Phase 5 — Polish & Depth

**Deliverable:** A game you can play start-to-finish and want to replay. You log in with an account, your saves sync to the cloud, and you can continue on any device. Legendary artifacts exist, dwarves have relationships, and trade caravans arrive seasonally. Sound effects and music play. A legends screen shows the history of your fortress run.

Items:
- **Login & accounts:** email/password or OAuth (GitHub/Google); anonymous play allowed, login to sync saves
- **Cloud save:** saves stored server-side, tied to account; IndexedDB as local cache
- **Trade caravans:** arrive seasonally, bring foreign goods, buy surplus; negotiation UI
- **Artifacts:** legendary items crafted by moody dwarves with high skill; named and tracked
- **Dwarf relationships:** friends, rivals, family; relationship quality affects mood
- **Legends/history screen:** chronological event log (who mined the first obsidian, who killed the forgotten beast)
- **Sound & music:** ambient mine sounds, footsteps, combat clangs, a looping OST
- **Seasons:** spring/summer/autumn/winter cycle; affects crop growth, surface temperature, migratory creature patterns
- **Automated headless playtesting CI:** post-merge playtest runs and auto-files GitHub issues on regressions
- **Balance passes:** needs rates, production throughput, creature difficulty

---

## How Issues Map to Phases

Each phase has a root design spike (a `docs/specs/` file written before implementation begins) that gets human review before coding starts. GitHub Issues are the source of truth for individual tasks — see the repo's issue tracker, filtered by phase label.

Integration tests gate phase transitions: the next phase doesn't start until the current phase's integration test is green.

---

## Brainstorm: Future Features (Phase 6+)

Ideas worth revisiting once the core loop is solid. Not committed to any phase yet.

### Gameplay depth
- **Migration waves:** new dwarves arrive each year if the fortress is thriving; population grows organically
- **Nobles:** noble dwarves with specific demands (a bedroom of a certain size, certain luxury goods); failure triggers tantrums or edicts
- **Children & aging:** dwarves are born, grow up, age, and eventually die; generational play
- **Pets & animals:** tame creatures that follow dwarves, guard the entrance, or provide wool/milk
- **Tavern & visitors:** dwarves socialize in a tavern; adventurers and scholars may petition to join
- **Embark screen:** choose your starting site on a world map, pick supplies and dwarves before the game begins
- **Megaprojects:** large zone designations (a castle, a great hall) that take dozens of dwarves many seasons to build
- **Aquifers:** underground water layers that flood tunnels if broken through carelessly
- **Underground farms:** mushroom farming underground for food security
- **Diplomacy:** relations with neighboring civilizations; tribute, war, and alliance

### World & systems
- **Weather:** rain, snow, flooding rivers; affects movement and crop growth
- **Day/night cycle:** torches and lighting become necessary underground; morale bonus from sunlight
- **Temperature & fire:** magma and fire spread through flammable tiles; hypothermia in cold biomes
- **Z-level flooding:** rivers break through, magma erupts; water + magma = obsidian
- **Modding support:** data-driven enough that community YAML packs can add creatures, materials, reactions

### Social & meta
- **Leaderboards:** longest-surviving fortress, most artifacts crafted, largest population
- **Seed sharing:** share an embark seed; friends start in the same world
- **Map screenshots / fortress sharing:** export a top-down view of your fortress to share
- **Achievements & milestones:** first kill, first legendary dwarf, first siege survived
- **Accessibility:** colorblind modes, high-contrast tiles, adjustable font size for UI text
- **Mobile / touch controls:** swipe to pan, pinch to zoom, tap to designate

### Infrastructure
- **Replay system:** record ECS state snapshots; play back a fortress run like a video
- **Spectator mode:** watch another player's fortress run (read-only cloud session)
- **Server-side world simulation:** for async multiplayer where friends cooperate on the same fortress across sessions
