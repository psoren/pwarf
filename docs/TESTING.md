# TESTING — DWARF FORTRESS CLONE
> Every new system gets unit tests AND a sim scenario. AI playtesting via Claude Haiku runs in headless mode and reports findings.

---

## PRINCIPLES

1. **Unit tests** verify isolated logic — a single function, a single calculation.
2. **Sim scenarios** verify emergent behavior — run the sim for N in-game days with controlled conditions and assert the world is in the expected state.
3. **AI playtesting** runs the sim headlessly with Claude Haiku making player decisions and reports what it found — bugs, balance issues, exploits, death causes, and general feel.

All three layers are required. Unit tests catch logic bugs. Sim scenarios catch integration bugs. AI playtesting catches balance and design problems that only emerge from real play.

---

## HEADLESS MODE

The sim must be runnable with zero UI, zero browser, zero human input. This is required for both sim scenarios and AI playtesting.

```
/sim
  src/
    engine/       ← pure headless sim logic
    scenarios/    ← scenario runners
    ai-player/    ← Claude Haiku playtest harness
  tests/
    unit/         ← unit tests (vitest)
    scenarios/    ← scenario tests (vitest)
```

### Headless sim API

The sim engine must expose a clean programmatic interface:

```typescript
// Create a world with a seed (deterministic)
const world = createWorld({ seed: 12345 })

// Create a civilization with controlled starting conditions
const civ = createCivilization(world, {
  tile_x: 10,
  tile_y: 10,
  embark_profile: 'balanced',
  starting_food: 200,
  starting_drink: 200,
})

// Step the sim forward N steps
await stepSim(world, civ, { steps: 1000 })

// Or step forward N in-game days
await stepSimDays(world, civ, { days: 30 })

// Or step forward N in-game years
await stepSimYears(world, civ, { years: 5 })

// Query state
const dwarves = getDwarves(civ)
const stockpiles = getStockpiles(civ)
const events = getEvents(world, { since_year: 0 })
const isAlive = civ.status === 'active'
```

All randomness must be seeded so scenarios are fully deterministic and reproducible. If a scenario fails, re-running with the same seed should reproduce the exact failure.

---

## UNIT TESTS

Write unit tests for every pure function in the sim engine. Run with `vitest`.

### Needs & Stress

```typescript
describe('needs decay', () => {
  test('food need decays by correct amount per step', () => {
    const dwarf = createDwarf({ need_food: 100 })
    stepNeeds(dwarf, 1)
    expect(dwarf.need_food).toBe(100 - FOOD_DECAY_PER_STEP)
  })

  test('need cannot go below 0', () => {
    const dwarf = createDwarf({ need_food: 0 })
    stepNeeds(dwarf, 100)
    expect(dwarf.need_food).toBe(0)
  })

  test('stress increases when food need is critical', () => {
    const dwarf = createDwarf({ need_food: 5, stress_level: 0 })
    recalcStress(dwarf)
    expect(dwarf.stress_level).toBeGreaterThan(0)
  })

  test('stress does not increase when all needs are met', () => {
    const dwarf = createDwarf({ need_food: 90, need_drink: 90, need_sleep: 90,
                                 need_social: 80, need_purpose: 80, need_beauty: 80,
                                 stress_level: 0 })
    recalcStress(dwarf)
    expect(dwarf.stress_level).toBe(0)
  })
})

describe('tantrum', () => {
  test('dwarf enters tantrum when stress exceeds threshold', () => {
    const dwarf = createDwarf({ stress_level: TANTRUM_THRESHOLD + 1 })
    checkTantrum(dwarf)
    expect(dwarf.is_in_tantrum).toBe(true)
  })

  test('tantrum does not trigger below threshold', () => {
    const dwarf = createDwarf({ stress_level: TANTRUM_THRESHOLD - 1 })
    checkTantrum(dwarf)
    expect(dwarf.is_in_tantrum).toBe(false)
  })
})
```

### Skills

```typescript
describe('skill progression', () => {
  test('XP accumulates from work', () => {
    const skill = createSkill({ skill_name: 'mining', level: 1, xp: 0 })
    addSkillXP(skill, 50)
    expect(skill.xp).toBe(50)
  })

  test('skill levels up when XP threshold reached', () => {
    const skill = createSkill({ skill_name: 'mining', level: 1, xp: XP_PER_LEVEL - 1 })
    addSkillXP(skill, 1)
    expect(skill.level).toBe(2)
    expect(skill.xp).toBe(0)
  })

  test('skill does not exceed max level', () => {
    const skill = createSkill({ skill_name: 'mining', level: MAX_SKILL_LEVEL, xp: 9999 })
    addSkillXP(skill, 9999)
    expect(skill.level).toBe(MAX_SKILL_LEVEL)
  })

  test('skill decays when unused for too long', () => {
    const skill = createSkill({ skill_name: 'mining', level: 5, last_used_year: 0 })
    applySkillDecay(skill, { current_year: SKILL_DECAY_YEARS + 1 })
    expect(skill.level).toBeLessThan(5)
  })
})
```

### Mining

```typescript
describe('excavation', () => {
  test('dig progress advances per step based on skill', () => {
    const job = createDigJob({ material: 'granite' })
    const miner = createDwarf({ mining_skill: 5 })
    advanceDigJob(job, miner, 1)
    expect(job.progress).toBeGreaterThan(0)
  })

  test('skilled miner digs faster than unskilled', () => {
    const job1 = createDigJob({ material: 'granite' })
    const job2 = createDigJob({ material: 'granite' })
    const skilled = createDwarf({ mining_skill: 15 })
    const unskilled = createDwarf({ mining_skill: 1 })
    advanceDigJob(job1, skilled, 100)
    advanceDigJob(job2, unskilled, 100)
    expect(job1.progress).toBeGreaterThan(job2.progress)
  })

  test('tile becomes floor when dig job completes', () => {
    const tile = createTile({ type: 'granite' })
    const job = createDigJob({ tile, progress: DIG_COMPLETE_THRESHOLD - 1 })
    const miner = createDwarf({ mining_skill: 10 })
    advanceDigJob(job, miner, 1)
    expect(tile.type).toBe('floor')
  })
})
```

### Stockpiles & Consumption

```typescript
describe('food consumption', () => {
  test('dwarf consumes food when need is low', () => {
    const stockpile = createStockpile({ food: 100 })
    const dwarf = createDwarf({ need_food: 20 })
    satisfyNeeds(dwarf, stockpile)
    expect(stockpile.food).toBeLessThan(100)
    expect(dwarf.need_food).toBeGreaterThan(20)
  })

  test('dwarf does not consume food when need is high', () => {
    const stockpile = createStockpile({ food: 100 })
    const dwarf = createDwarf({ need_food: 90 })
    satisfyNeeds(dwarf, stockpile)
    expect(stockpile.food).toBe(100)
  })

  test('dwarf stress rises when no food available', () => {
    const stockpile = createStockpile({ food: 0 })
    const dwarf = createDwarf({ need_food: 10, stress_level: 0 })
    satisfyNeeds(dwarf, stockpile)
    recalcStress(dwarf)
    expect(dwarf.stress_level).toBeGreaterThan(0)
  })
})
```

### Monster

```typescript
describe('monster behavior', () => {
  test('aggressive monster moves toward fortress each step', () => {
    const monster = createMonster({ behavior: 'aggressive', current_tile_x: 5, current_tile_y: 5 })
    const fortress = { tile_x: 10, tile_y: 5 }
    moveMonster(monster, fortress, 1)
    expect(monster.current_tile_x).toBeGreaterThan(5)
  })

  test('dormant monster does not move', () => {
    const monster = createMonster({ behavior: 'hibernating', current_tile_x: 5, current_tile_y: 5 })
    moveMonster(monster, null, 100)
    expect(monster.current_tile_x).toBe(5)
  })

  test('monster threat reduces when wounded', () => {
    const monster = createMonster({ health: 100, threat_level: 80 })
    applyDamageToMonster(monster, 50)
    expect(monster.health).toBe(50)
  })

  test('monster status becomes slain at zero health', () => {
    const monster = createMonster({ health: 10 })
    applyDamageToMonster(monster, 10)
    expect(monster.status).toBe('slain')
  })
})
```

---

## SIM SCENARIOS

Sim scenarios run the full engine headlessly for a set number of in-game days or years, then assert on world state. Run with `vitest` as integration tests.

Each scenario lives in `/sim/tests/scenarios/` and follows this pattern:

```typescript
describe('Scenario: [name]', () => {
  let world, civ

  beforeEach(async () => {
    world = createWorld({ seed: FIXED_SEED })
    civ = createCivilization(world, SCENARIO_CONDITIONS)
  })

  test('[assertion]', async () => {
    await stepSimDays(world, civ, { days: N })
    // assert
  })
})
```

---

### SCENARIO 1 — Basic Survival (Enough Food)
**Setup:** 7 dwarves, 300 food, 300 drink, 1 farmer assigned, plains biome.
**Run:** 60 in-game days (~5 real minutes at sim speed)
**Assert:**
- All 7 dwarves alive
- No dwarf stress > 40
- No tantrum triggered
- Food stockpile > 0
- Farmer has gained farming XP

```typescript
test('fortress survives 60 days with adequate food', async () => {
  await stepSimDays(world, civ, { days: 60 })
  const dwarves = getDwarves(civ)
  expect(dwarves.every(d => d.status === 'alive')).toBe(true)
  expect(dwarves.every(d => d.stress_level < 40)).toBe(true)
  expect(getStockpile(civ).food).toBeGreaterThan(0)
})
```

---

### SCENARIO 2 — Starvation
**Setup:** 7 dwarves, 50 food (not enough to last), 200 drink, no farmer.
**Run:** Until fortress falls or 120 days pass
**Assert:**
- Fortress falls before day 120
- Cause of death is `starvation`
- At least one dwarf died before the fortress was fossilized
- `world_events` contains a `fortress_fallen` entry

```typescript
test('fortress falls from starvation without farmer', async () => {
  await stepSimDays(world, civ, { days: 120 })
  expect(civ.status).toBe('fallen')
  expect(civ.cause_of_death).toBe('starvation')
  const events = getEvents(world)
  expect(events.some(e => e.category === 'fortress_fallen')).toBe(true)
})
```

---

### SCENARIO 3 — Tantrum Spiral
**Setup:** 7 dwarves, adequate food/drink, but need_beauty and need_social start at 10. No furniture, no social structures, cramped quarters.
**Run:** 90 days
**Assert:**
- At least one dwarf reaches tantrum before day 90
- Tantrum dwarf damages at least one item or injures another dwarf
- Stress is contagious — at least 2 other dwarves show elevated stress after the tantrum

```typescript
test('low beauty and social needs trigger tantrum cascade', async () => {
  await stepSimDays(world, civ, { days: 90 })
  const dwarves = getDwarves(civ)
  const tantrummed = dwarves.filter(d => d.is_in_tantrum || d.memories.some(m => m.type === 'tantrum'))
  expect(tantrummed.length).toBeGreaterThan(0)
  const highStress = dwarves.filter(d => d.stress_level > 60)
  expect(highStress.length).toBeGreaterThanOrEqual(2)
})
```

---

### SCENARIO 4 — Monster Siege
**Setup:** 10 dwarves (4 soldiers, 6 civilians), adequate supplies, fortress on a mountain tile. Spawn an aggressive forgotten beast 2 tiles out at day 0.
**Run:** Until monster is slain or fortress falls, max 180 days.
**Assert:**
- Monster arrives at fortress (encounter record created)
- At least one combat event fires
- Outcome is either monster_slain or fortress_fallen
- If fortress survives, slaying dwarf gained combat XP
- `world_events` has a monster_siege and either monster_slain or fortress_fallen entry

```typescript
test('monster siege resolves as either slain or fortress fallen', async () => {
  spawnMonster(world, { type: 'forgotten_beast', threat_level: 60,
                         tile_x: civ.tile_x + 2, tile_y: civ.tile_y, behavior: 'aggressive' })
  await stepSimDays(world, civ, { days: 180 })
  const events = getEvents(world)
  const resolved = events.some(e => e.category === 'monster_slain' || e.category === 'fortress_fallen')
  expect(resolved).toBe(true)
})
```

---

### SCENARIO 5 — Skill Growth
**Setup:** 1 miner with skill level 1, one large dig designation (50 tiles of granite).
**Run:** Until all tiles are dug or 365 days pass.
**Assert:**
- Miner skill level has increased
- All designated tiles are dug
- Stone produced matches expected yield from tile count

```typescript
test('miner gains skill from sustained digging', async () => {
  designateDig(civ, { tiles: generateGraniteTiles(50) })
  const miner = getDwarves(civ).find(d => hasJob(d, 'mining'))
  const initialLevel = getMinerLevel(miner)
  await stepSimDays(world, civ, { days: 365 })
  expect(getMinerLevel(miner)).toBeGreaterThan(initialLevel)
})
```

---

### SCENARIO 6 — Cavern Breach
**Setup:** 1 miner, designate dig straight down from z-0 to z-16 (into cavern layer 1 depth).
**Run:** Until breach occurs or 200 days pass.
**Assert:**
- A `discovery` world event fires when z-16 is reached
- Cavern tiles are now accessible
- Monster spawning from cavern begins (at least one cave creature appears in entity list)

---

### SCENARIO 7 — Magma Breach (Catastrophic)
**Setup:** Fortress on volcano biome, dig designation reaching z-50.
**Run:** Until magma breach or 300 days.
**Assert:**
- Magma breach event fires
- Dwarves in path of magma die within a small number of steps
- Fortress falls with cause_of_death `magma` if no containment

---

### SCENARIO 8 — Immigration Wave
**Setup:** Wealthy fortress, year 3, population 12, wealth > 10,000.
**Run:** Through year 5.
**Assert:**
- At least one immigration wave arrives before year 5
- New dwarves added to civilization
- Population increases

---

### SCENARIO 9 — Graveyard Publication
**Setup:** Let scenario 2 (starvation) run to completion.
**Assert:**
- `fossilize_civilization()` was called
- A ruins record exists for the fallen civ
- Player can publish the ruin (`is_published = true`)
- Another player cannot expedition into their own published ruin (RLS policy check)

---

### SCENARIO 10 — Long Survival (10 years)
**Setup:** Balanced embark, good biome, seed chosen to avoid early monster spawns.
**Run:** 10 in-game years (5 real hours at sim speed — run headlessly)
**Assert:**
- Fortress still active at year 10
- At least 2 dwarves have reached skill level 10+ in their primary job
- At least 1 masterwork item has been produced
- At least 1 immigration wave has occurred
- World events log has > 50 entries
- No data corruption (all FK references resolve, no orphaned rows)

---

## AI PLAYTESTING WITH CLAUDE HAIKU

### Overview

An AI player harness lets Claude Haiku drive the game in headless mode. It reads the current sim state, decides what actions to take, executes them, and reports back on what it experienced. This surfaces balance issues, exploits, unfun loops, and outright bugs that scenario tests miss — because it plays like a real player, not a scripted test.

### Architecture

```
/sim/src/ai-player/
  harness.ts       ← runs the playtest loop
  state-reader.ts  ← serializes sim state into a prompt-friendly format
  action-executor.ts ← maps Claude's decisions to sim API calls
  reporter.ts      ← collects findings and generates a report
```

### How It Works

The harness runs a loop:

1. **Read state** — serialize the current sim state into a concise text summary
2. **Prompt Haiku** — send the state summary to Claude Haiku with a system prompt describing what actions are available
3. **Parse response** — extract the action Haiku chose
4. **Execute** — call the sim API with that action
5. **Step sim** — advance N steps
6. **Repeat**
7. **On fortress fall or session end** — generate a report

```typescript
// harness.ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const SYSTEM_PROMPT = `
You are playing a Dwarf Fortress-style game. You manage a fortress of dwarves.
Your goal is to survive as long as possible.

Each turn you will receive:
- Current year and season
- Dwarf roster with needs and stress levels
- Stockpile levels (food, drink, materials)
- Active work orders and designations
- Recent log entries
- Any active threats

You must respond with ONE action in this exact JSON format:
{
  "action": "<action_name>",
  "params": { ... }
}

Available actions:
- designate_dig: { tiles: [{x, y, z}] }
- assign_labor: { dwarf_id, job_name, enabled: boolean }
- create_work_order: { job_type, material, quantity }
- set_alert_level: { level: "normal" | "guarded" | "high" | "lockdown" }
- assign_squad: { dwarf_ids: [], squad_name }
- wait: {}  (do nothing this turn)

Be decisive. Prioritize survival. If dwarves are hungry, get food. If a monster is approaching, prepare defenses.
`

async function runPlaytest(config: PlaytestConfig): Promise<PlaytestReport> {
  const world = createWorld({ seed: config.seed })
  const civ = createCivilization(world, config.startingConditions)
  const log: PlaytestEntry[] = []

  while (civ.status === 'active' && getYear(world) < config.max_years) {
    const state = serializeState(world, civ)

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: state }]
    })

    const action = parseAction(response.content[0].text)
    executeAction(civ, action)

    // Step sim forward one in-game day between each AI decision
    await stepSimDays(world, civ, { days: 1 })

    log.push({
      year: getYear(world),
      day: getDay(world),
      state_summary: state,
      action_taken: action,
      notable_events: getRecentEvents(world, { last_n: 5 })
    })
  }

  return generateReport(world, civ, log, config)
}
```

### State Serialization

Keep the state summary concise — Haiku has a small context window and you're calling it thousands of times per playtest.

```typescript
function serializeState(world, civ): string {
  const dwarves = getDwarves(civ)
  const stockpile = getStockpile(civ)
  const threats = getThreats(world, civ)
  const recentLog = getEvents(world, { last_n: 5 })

  return `
YEAR ${getYear(world)}, DAY ${getDay(world)} | POP: ${dwarves.length} | WEALTH: ${civ.wealth}

DWARVES:
${dwarves.map(d =>
  `  ${d.name}: food=${d.need_food} drink=${d.need_drink} stress=${d.stress_level} job=${d.current_job ?? 'idle'}`
).join('\n')}

STOCKPILES: food=${stockpile.food} drink=${stockpile.drink} stone=${stockpile.stone} wood=${stockpile.wood}

THREATS: ${threats.length === 0 ? 'none' : threats.map(t => `${t.name} (${t.type}, threat=${t.threat_level}, ${t.distance} tiles out)`).join(', ')}

RECENT LOG:
${recentLog.map(e => `  - ${e.description}`).join('\n')}

What do you do?
`.trim()
}
```

### Report Format

After a playtest run, generate a structured report:

```typescript
interface PlaytestReport {
  seed: number
  starting_conditions: StartingConditions
  survived_years: number
  cause_of_death: string | null  // null if still alive at max_years
  peak_population: number
  peak_wealth: number
  notable_events: string[]       // most interesting world_events entries
  ai_observations: string        // ask Haiku to reflect on what happened
  bugs_encountered: Bug[]        // any exceptions, NaN values, impossible states
  balance_notes: string          // Haiku's assessment of difficulty and fairness
}
```

After the run, do one final prompt asking Haiku to reflect:

```typescript
const reflectionPrompt = `
You just played a Dwarf Fortress-style game for ${report.survived_years} years.
Your fortress ${report.cause_of_death ? `fell to ${report.cause_of_death}` : 'survived'}.

Here is a summary of major events:
${report.notable_events.join('\n')}

Please report:
1. What killed you (or what kept you alive)?
2. What felt unfair or impossible to prevent?
3. What felt too easy or exploitable?
4. Any moments that felt particularly fun or dramatic?
5. Any bugs or impossible game states you noticed?

Be specific and honest. This is a playtesting report for the developer.
`

const reflection = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1024,
  messages: [{ role: 'user', content: reflectionPrompt }]
})

report.ai_observations = reflection.content[0].text
```

### Running Playtests

```bash
# Single playtest with a fixed seed
npm run playtest -- --seed 12345 --years 20

# Batch playtests (runs N games with random seeds, aggregates findings)
npm run playtest:batch -- --count 20 --years 10 --output reports/batch-001.json

# Stress test — push sim to failure as fast as possible
npm run playtest:stress -- --count 50 --years 5 --profile hostile
# hostile profile: spawns monsters earlier, starts with less food

# Difficulty sweep — run same seed across difficulty variants
npm run playtest:sweep -- --seed 12345
```

### What to Look For in Reports

When reviewing batch playtest output, flag:

- **Consistent early death** (< year 5) across most seeds → embark is too harsh
- **Consistent survival** (> year 20) without stress → game is too easy
- **Single dominant cause of death** → one system is overpowered or undertuned
- **Haiku consistently ignoring a mechanic** → mechanic is confusing, useless, or broken
- **Bugs_encountered array non-empty** → fix before next playtest batch
- **"Impossible to prevent" feedback** → player agency is missing somewhere

---

## CONTINUOUS INTEGRATION

Add these to your CI pipeline (GitHub Actions or equivalent):

```yaml
# .github/workflows/test.yml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:unit

  scenario-tests:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:scenarios

  # AI playtests run on demand only (cost + time), not on every PR
  # Trigger manually or on release branches
  ai-playtest:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/release'
    steps:
      - run: npm run playtest:batch -- --count 10 --years 10
```

Unit and scenario tests run on every PR. AI playtests run on release branches only — they cost API credits and take time.

---

## CHECKLIST — NEW FEATURE TESTING

When adding any new system to the sim, complete this checklist before merging:

- [ ] Unit tests for all pure functions in the new system
- [ ] At least one sim scenario that exercises the new system in isolation
- [ ] At least one sim scenario that exercises the new system interacting with existing systems
- [ ] Headless mode confirmed working (no new browser dependencies introduced)
- [ ] Run a single AI playtest with `--years 10` and review the report
- [ ] No new entries in `bugs_encountered` from the playtest
- [ ] Update this document with any new scenarios relevant to the feature
