# pwarf — Development Roadmap

> Browser-based Dwarf Fortress clone. Stack: TypeScript · PixiJS · bitecs · Vite · React · Vitest

---

## Game Vision

A top-down, tile-based colony sim where the player manages autonomous dwarves in a procedurally generated 3D world. The player never directly controls dwarves — instead they designate zones, place buildings, and assign labor. Dwarves handle the rest.

**Core pillars:** world generation → dwarf AI & jobs → economy & production chains → combat

---

## Phases

### Phase 0 — Scaffolding ✅ Complete

**Deliverable:** A running game you can see and interact with — 7 dwarves wandering a flat stone map, rendered in the browser at 20 ticks/sec, controllable with WASD/arrow keys.

What shipped: ECS (bitecs), tick loop, World3D tile structure, HeadlessGame API, PixiJS renderer, keyboard/mouse input handler, random-walk movement system, structured logging (Axiom), integration tests.

---

### Phase 1 — Terrain Generation 🔄 In progress

**Deliverable:** A procedurally generated world — heightmap with biomes (grass/sand/snow/tundra), rivers, underground stone + ore layers, caverns at depth, magma at the bottom. `embark()` produces a varied map instead of a flat stone floor. Progress bar shown during generation.

Spec: [`docs/specs/world-gen-design.md`](specs/world-gen-design.md)

Pipeline: heightmap → biome assignment → underground layers → rivers → tile resolver → world slice builder → embark site

---

### Phase 2 — Dwarf Simulation Core

**Deliverable:** Dwarves that do things on their own — path to destinations, pick up and haul items, execute jobs, feel hunger/thirst/sleep, and react to neglect.

Systems needed: A* pathfinding on 3D grid, job queue + assignment, mining job, hauling job, stockpile zones, needs decay, mood system, idle behavior.

---

### Phase 3 — Economy & Production

**Deliverable:** Production chains that work end-to-end. Mine ore → smelt bars → forge weapons. Grow crops → cook meals. All reactions data-driven from YAML.

Systems needed: workshop entities, reaction system (inputs → outputs), farming, metalworking chain, food chain, item management.

---

### Phase 4 — Combat & Creatures

**Deliverable:** Hostile creatures invade; military dwarves fight back. Body-part targeting, material-based damage, injuries, military squads.

Systems needed: creature AI, body-part model, combat resolution, injury tracking, military squad orders.

---

### Phase 5 — Polish & Depth

**Deliverable:** A completable game loop with save/load, sound, a legends/history layer, and automated playtesting CI.

Items: save/load serialization, sound effects, legends mode, automated headless playtesting workflow, balance passes.

---

## How Issues Map to Phases

Each phase has a root design spike (a `docs/specs/` file written before implementation begins) that gets human review before coding starts. GitHub Issues are the source of truth for individual tasks — see the repo's issue tracker, filtered by phase label.

Integration tests gate phase transitions: the next phase doesn't start until the current phase's integration test is green.
