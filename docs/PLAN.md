# Dwarf Fortress Clone — Agent-Driven Development Plan

> Built with Claude Code Agents + GitHub Issues + CI/CD
> **Stack:** TypeScript · PixiJS · bitecs · Vite · React · Vitest

---

## 1. What You're Building

A browser-based Dwarf Fortress clone: a top-down, tile-based colony simulation where the player manages autonomous dwarves in a procedurally generated 3D world made of z-levels.

### Core Game Loop

| Feature | Description |
|---------|-------------|
| **World generation** | Perlin noise heightmaps, biomes, underground stone/ore layers, caverns, rivers |
| **ECS tick loop** | Every game tick runs systems in order — AI decisions, pathfinding, job execution, needs decay, combat, rendering |
| **Player-as-manager** | You never directly control dwarves. Designate zones (mine here, farm here, store here), place buildings, assign labor. Dwarves figure out the rest. |
| **Production chains** | Mine ore → smelt bars → forge weapons. Plant seeds → grow crops → cook meals. All data-driven from YAML. |
| **Combat** | Body-part targeting, material-based damage, injuries, military squads |
| **Mood/needs** | Hunger, thirst, sleep, happiness. Neglect leads to tantrum spirals. |

---

## 2. Repository Structure

Clear module boundaries so agents know exactly where to work:

```
dwarf-fortress-clone/
├─ .github/workflows/       ← CI + playtest + Claude review
├─ .claude/
│   ├─ settings.json        ← Claude Code project config
│   └─ commands/            ← Custom slash commands
├─ docs/
│   ├─ ARCHITECTURE.md      ← System overview (agents read this first)
│   ├─ CONVENTIONS.md       ← Code style, naming, patterns
│   ├─ AGENT_GUIDE.md       ← How agents approach issues
│   └─ specs/               ← Detailed specs per system
├─ src/
│   ├─ core/                ← ECS, world state, tick loop
│   ├─ map/                 ← Terrain gen, z-levels, tiles
│   ├─ entities/            ← Dwarves, creatures, items
│   ├─ systems/             ← Pathfinding, AI, jobs, physics
│   ├─ ui/                  ← Rendering, input, menus
│   └─ data/                ← YAML: materials, buildings, etc.
├─ scripts/
│   ├─ playtest.ts          ← Headless playtesting script
│   └─ file-issues.ts       ← Auto-files GitHub issues from reviews
├─ tests/
└─ assets/
```

---

## 3. The Agent Workflow

GitHub Issues are the task queue. Each issue is a bounded unit of work that a Claude Code agent picks up, implements, PRs, and closes.

### Issue Design Principles

- **One issue = one PR = one bounded task.** No mega-issues.
- Every issue includes: acceptance criteria, files to touch, interfaces to conform to, test plan.
- **Label system:** `phase-0` through `phase-5`, `agent-ready`, `blocked`, `needs-human-review`
- **Dependency links:** Issues reference blockers explicitly ("Blocked by #12, #14")

### Agent Session Flow

1. Read the GitHub issue — understand acceptance criteria and dependencies
2. Read `ARCHITECTURE.md` — understand where the work fits
3. Read existing code in relevant modules
4. Implement — write code conforming to `CONVENTIONS.md`
5. Write tests — unit tests for new functionality
6. Run tests — ensure nothing is broken
7. Create PR — with description referencing the issue

### Parallelization

At any phase, many issues are independent. Run 3–5 agents in parallel on non-conflicting issues. Use the `blocked` label and dependency links to enforce ordering. Do a human review pass every few hours on merged PRs.

---

## 4. CI/CD Pipeline

### 4a. Build & Test (`ci.yml`)

Runs on every push and PR. Blocks merging if anything fails.

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

> **Branch protection:** Settings → Branches → Add rule for `main`. Enable "Require status checks to pass before merging" and select the CI job.

### 4b. Claude PR Review (`claude-review.yml`)

Claude Code automatically reviews every PR against your architecture and conventions:

```yaml
name: Claude PR Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          review: true
          review_context: |
            Review against docs/CONVENTIONS.md and
            docs/ARCHITECTURE.md. Check tests exist and
            cover acceptance criteria from linked issue.
```

> **Setup:** Store your Anthropic API key in repo Settings → Secrets → `ANTHROPIC_API_KEY`

### 4c. Slack Notifications for Stuck Agents

- Set `timeout-minutes: 30` on agent jobs
- Add a failure step that posts to your Slack webhook
- Have agents add a `needs-human` label to issues they can't resolve after two attempts

```yaml
- name: Notify on failure
  if: failure()
  run: |
    curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
      -H 'Content-Type: application/json' \
      -d '{"text":"Agent stuck on PR #${{ github.event.pull_request.number }}"}'
```

> **Setup:** Create a Slack app with incoming webhooks. Store the URL in repo Settings → Secrets → `SLACK_WEBHOOK`

---

## 5. Automated Playtesting

After every merge to main, an agent plays the game headlessly and files bugs automatically.

### Step 1: Headless Game API

```ts
export class HeadlessGame {
  tick(): GameState { }
  designateMine(x, y, z): void { }
  buildWorkshop(type, x, y, z): void { }
  getStocks(): ItemCount[] { }
  getDwarves(): DwarfStatus[] { }
  runFor(ticks: number): GameState { }
}
```

### Step 2: Playtest Script

```ts
const game = new HeadlessGame({ seed: 12345 })
game.embark()
game.designateMine(10, 10, -1, 15, 15, -3)
game.runFor(500)
// Write game state to playtest-report.json
```

### Step 3: Claude Reviews the Playtest

A Claude Code agent reads the report and evaluates:
- Did dwarves mine successfully?
- Did anyone starve or get stuck pathfinding?
- Are there broken entity states?

It outputs a JSON array of issues.

### Step 4: Auto-File Issues

A script reads Claude's JSON output and creates GitHub issues via the Octokit API, complete with labels and descriptions.

### Step 5: GitHub Action

Wire it all together as a workflow that triggers on pushes to `main`. The playtest runs, Claude reviews, and issues are filed automatically.

---

## 6. Development Phases

~100 issues across 6 phases. Don't start the next phase until the current phase's integration test passes.

### Phase 0 — Scaffolding & Core (Issues #1–10)

Foundational work. Run these mostly sequentially with human review.

| # | Issue |
|---|-------|
| 1 | Repo scaffolding: folder structure, tsconfig, vite.config, package.json |
| 2 | ECS world setup: bitecs world, component definitions (Position, Velocity) |
| 3 | Tick loop: fixed-timestep game loop, system registration |
| 4 | World data structure: 3D tile array, z-level indexing, chunk model |
| 5 | PixiJS renderer stub: canvas init, viewport, basic tile draw |
| 6 | React UI shell: root component, overlay layout |
| 7 | Input handling: keyboard + mouse, command dispatch |
| 8 | YAML loader: load & validate materials.yaml with Zod |
| 9 | HeadlessGame API: programmatic interface for tests and playtest |
| 10 | Integration test: render a map with moving entities |

### Phase 1 — Terrain Generation (Issues #11–20)

| # | Issue |
|---|-------|
| 11 | Perlin noise heightmap |
| 12 | Biome assignment |
| 13 | Underground stone/ore layer generation |
| 14 | Cavern generation |
| 15 | River generation |
| 16 | Surface feature placement (trees, boulders) |
| 17 | Z-level viewer (render any z-level) |
| 18 | Embark site selection UI |
| 19 | World export/import (serialization) |
| 20 | Terrain integration test |

### Phase 2 — Dwarf Simulation Core (Issues #21–40)

The heart of the game. Many issues here can be parallelized.

| # | Issue |
|---|-------|
| 21 | Dwarf entity: components (Position, Needs, Skills, Mood) |
| 22 | Needs system: hunger, thirst, sleep decay |
| 23 | Pathfinding: A* on 3D tile grid |
| 24 | Movement system: follow path, z-level transitions |
| 25 | Job system: job queue, assignment, execution |
| 26 | Mining job: designate tiles, dwarf mines, tile removed |
| 27 | Hauling job: pick up item, carry to stockpile |
| 28 | Stockpile zones: designate area, filter by item type |
| 29 | Idle behavior: dwarves wander/rest when no jobs |
| 30 | Mood system: happiness calc, grumbling, tantrums |
| 31–40 | … additional dwarf sim issues … |

### Phase 3 — Economy & Production (Issues #41–60)

| # | Issue |
|---|-------|
| 41 | Workshop entity and placement |
| 42 | Reaction system: input items → output items |
| 43 | Crafting job: dwarf uses workshop to run reaction |
| 44 | Food production chain: farming → cooking |
| 45 | Metalworking chain: mining → smelting → forging |
| 46–60 | … additional economy issues … |

### Phase 4 — Combat & Creatures (Issues #61–80)

| # | Issue |
|---|-------|
| 61 | Creature entity: components, AI behavior flags |
| 62 | Body-part model: limbs, vital organs |
| 63 | Combat system: attack resolution, damage calc |
| 64 | Injury system: wound tracking, bleeding, death |
| 65 | Military squads: formation, orders, equipment |
| 66–80 | … additional combat/creature issues … |

### Phase 5 — Polish & Advanced (Issues #81–100)

| # | Issue |
|---|-------|
| 81 | Save/load game state |
| 82 | Sound effects |
| 83 | Legends mode (history generation) |
| 84 | Automated playtest CI integration |
| 85–100 | … polish, balance, and stretch goals … |

---

## 7. Action Items

### Setup (do once)

- [ ] Create the GitHub repo with the folder structure from Section 2
- [ ] Initialize the project: `npm init`, install TypeScript, Vite, Vitest, bitecs, PixiJS, React
- [ ] Write `ARCHITECTURE.md` — ECS pattern, tick loop, module boundaries, data flow
- [ ] Write `CONVENTIONS.md` — code style, naming conventions, file organization, test expectations
- [ ] Write `AGENT_GUIDE.md` — how agents should read issues, branch, implement, test, and PR
- [ ] Set up `.claude/settings.json` pointing to docs as required context
- [ ] Set up GitHub Actions: `ci.yml` (build/test) and `claude-review.yml` (PR review)
- [ ] Configure branch protection: require CI pass before merge
- [ ] Create a Slack app with incoming webhooks; store URL in repo secrets
- [ ] Store `ANTHROPIC_API_KEY` in repo secrets

### Phase 0

- [ ] File issues #1–10 on GitHub with detailed acceptance criteria
- [ ] Run agents mostly sequentially: ECS core → map → renderer → entities
- [ ] Human-review every PR in this phase — these set the patterns
- [ ] Verify the integration: a rendered map with entities moving on it

### Ongoing (per phase)

- [ ] File next phase's issues once current integration test passes
- [ ] Run 3–5 agents in parallel on non-blocking issues
- [ ] Human review pass every few hours on merged code
- [ ] Set up the playtest workflow once Phase 2 is far enough along
- [ ] Refine issue descriptions when agent output misses the mark
