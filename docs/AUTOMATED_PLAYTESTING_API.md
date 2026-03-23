# Design Doc: Automated Playtesting System

**Issue:** #284 (original API), #528 (subagent integration)
**Status:** Implemented (Phase 1 + Phase 2 + subagent loop)
**Last updated:** 2026-03-23

## Overview

The sim engine runs headlessly with zero UI dependencies. A Claude Code subagent plays the game automatically — running scenarios, inspecting state, making decisions, and writing playtest reports that identify balance issues, bugs, and fun problems.

## Architecture

```
┌──────────────────────────────────────────────────┐
│  Claude Code (main session)                      │
│                                                  │
│  /headless-playtest  ──launches──▶  Subagent     │
│                                      │           │
│                            ┌─────────┴────────┐  │
│                            │ Phase 1: Batch   │  │
│                            │ playtest-all.mjs │  │
│                            │ (all scenarios)  │  │
│                            ├──────────────────┤  │
│                            │ Phase 2: Step    │  │
│                            │ playtest-        │  │
│                            │ interactive.mjs  │  │
│                            │ (investigate)    │  │
│                            ├──────────────────┤  │
│                            │ Phase 3: Report  │  │
│                            │ playtest-reports/│  │
│                            └──────────────────┘  │
└──────────────────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │  sim/dist/cli.js      │
          │  --scenario / --step  │
          │  (in-memory, no DB)   │
          └───────────────────────┘
```

## Components

### 1. Batch Mode (Phase 1 — `sim/src/headless-runner.ts`)

Runs a scenario to completion and dumps final state as JSON.

```bash
npx pwarf-sim --scenario starvation --ticks 500 --output json
```

**Key files:**
- `sim/src/headless-runner.ts` — in-memory sim runner (no Supabase)
- `sim/src/scenarios.ts` — predefined scenario definitions
- `sim/src/state-serializer.ts` — LLM-friendly JSON output
- `sim/src/cli.ts` — CLI flags (`--scenario`, `--ticks`, `--output`, `--snapshot-every`, `--seed`)

**Predefined scenarios:**

| Name | Dwarves | Food | Drink | Default ticks | Tests |
|------|---------|------|-------|---------------|-------|
| `starvation` | 7 | 3 | 20 | 500 | Resource scarcity |
| `idle-fortress` | 7 | 30 | 30 | 300 | Plenty of supplies, no tasks |
| `long-run-stability` | 7 | 20 | 20 | 5000 | Regression/crash detection |
| `overcrowding` | 20 | 10 | 10 | 500 | Stress from too many dwarves |

### 2. Step Mode (Phase 2 — `sim/src/step-mode.ts`)

Interactive JSON protocol on stdin/stdout. The agent advances ticks, inspects state, and issues commands.

```bash
npx pwarf-sim --step-mode --scenario idle-fortress --seed 42
```

**Commands:**

| Command | Description |
|---------|-------------|
| `{"command":"tick","count":N}` | Advance N ticks, return state |
| `{"command":"state"}` | Return current state |
| `{"command":"designate","type":"mine","x":N,"y":N,"z":N}` | Create a task |
| `{"command":"cancel","taskId":"..."}` | Cancel a task |
| `{"command":"scenario","name":"..."}` | Load scenario mid-session |

**Available task types:** `mine`, `build_wall`, `build_bed`, `build_table`, `build_chair`, `build_door`, `build_well`, `farm`, `eat`, `drink`

### 3. Orchestration Scripts

**`scripts/playtest-all.mjs`** — runs all scenarios in batch, outputs combined JSON:
```bash
node scripts/playtest-all.mjs --pretty              # all scenarios
node scripts/playtest-all.mjs --scenario starvation  # single scenario
node scripts/playtest-all.mjs --ticks 1000           # override tick count
```

**`scripts/playtest-interactive.mjs`** — drives step mode with a plan:
```bash
# Observe at checkpoints
node scripts/playtest-interactive.mjs --scenario starvation --observe 50,200,500,1000

# Custom plan via stdin
echo '[{"command":"designate","type":"farm","x":100,"y":100,"z":0},{"command":"tick","count":200},{"command":"state"}]' | \
  node scripts/playtest-interactive.mjs --scenario idle-fortress
```

### 4. Subagent Playtest Skill (`/headless-playtest`)

The `/headless-playtest` skill launches a Claude Code subagent that:

1. **Batch observation** — runs `playtest-all.mjs` to get baseline data across all scenarios
2. **Interactive investigation** — uses `playtest-interactive.mjs` to dig into concerning scenarios (designate tasks, try strategies, observe outcomes)
3. **Report writing** — writes a structured report to `playtest-reports/YYYY-MM-DD-<name>.md`
4. **Issue filing** (optional) — files GitHub issues for bugs or balance problems found

**Reports are committed to the repo** in `playtest-reports/` so they're available for review and historical comparison.

### 5. State Serializer (`sim/src/state-serializer.ts`)

Converts raw sim state into LLM-friendly JSON with human-readable labels:

```json
{
  "summary": {
    "tick": 500, "year": 1, "day": 10,
    "population": { "alive": 5, "dead": 2 },
    "alerts": ["2 dwarfs critically hungry", "1 dwarf in tantrum"],
    "deaths": [{ "name": "Zon Hammerfall", "cause": "starvation", "year": 1 }],
    "tasks_completed": 47,
    "events_count": 83
  },
  "dwarves": [
    {
      "name": "Urist McTestdwarf",
      "status": "alive",
      "needs": { "food": "critical (8)", "drink": "ok (65)", "sleep": "low (22)" },
      "activity": "mining at (100, 95, 0)",
      "stress": "moderate (45)",
      "is_in_tantrum": false
    }
  ],
  "recent_events": [
    { "tick": 480, "text": "Zon Hammerfall died of starvation" }
  ]
}
```

### 6. Prompt Template (`sim/src/playtest-prompt.ts`)

Builds a structured prompt for LLM analysis of batch output. Asks for population health, balance issues, emergent behavior, bugs, and a pass/warn/fail verdict.

## Playtest Report Format

Reports live in `playtest-reports/` and follow this structure:

```markdown
# Playtest Report — YYYY-MM-DD

## Scenarios Tested
(table of scenario outcomes)

## Balance Issues
(specific problems with data)

## Fun Assessment
(player agency, difficulty, events, pacing — rated 1-5)

## Bugs or Unexpected Behavior

## Suggestions
(actionable changes, referencing constants.ts)

## Raw Data
(collapsible JSON output)
```

## Design Decisions

- **In-memory runner reuses all existing phases.** Phase functions take `SimContext` and don't care where state came from.
- **Scenario files are TypeScript** (not JSON) so they use shared constants and types.
- **The serializer is a separate module** reused by both batch and step mode.
- **No new dependencies.** CLI arg parsing uses `process.argv` directly.
- **No Claude API calls.** Playtest analysis runs as a local Claude Code subagent, avoiding API cost and complexity.
- **Reports are committed** for historical comparison and accountability.

## What We Skipped

**Option C (REST API)** was evaluated and rejected. A REST server adds deployment overhead with no benefit — stdin/stdout is sufficient for a single AI agent. Revisit only if concurrent worlds or external tool integration becomes necessary.
