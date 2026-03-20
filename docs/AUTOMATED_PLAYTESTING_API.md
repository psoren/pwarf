# Design Doc: API Endpoints for Automated Playtesting

**Issue:** #284
**Status:** Proposal
**Author:** Claude (AI-assisted)

## Motivation

The sim engine already runs headless with zero UI dependencies. An AI agent (e.g., Claude Haiku) could playtest the game automatically — discovering starvation bugs, stuck dwarves, imbalanced need decay rates, and other emergent issues — if it had a programmatic way to run scenarios, inspect state, and (optionally) issue commands.

This doc evaluates three approaches and recommends one.

---

## Option A: Batch Mode (Simplest)

### How it works

A CLI command runs a scenario to completion and dumps the final (or periodic) state as JSON. The AI agent reads the output, evaluates it, and writes a report.

```bash
npx pwarf-sim --scenario starvation --ticks 500 --output json
```

### What we'd build

1. **CLI flags** on the existing `sim/src/cli.ts`:
   - `--ticks <n>` — run exactly N ticks, then exit
   - `--output json` — print a JSON summary to stdout on exit
   - `--scenario <name>` — load a predefined scenario (initial dwarf count, map seed, pre-placed tasks, etc.)
   - `--snapshot-every <n>` — optionally dump state every N ticks (for time-series analysis)

2. **Scenario definitions** — JSON or TS files describing initial conditions:
   ```json
   {
     "name": "starvation",
     "seed": 42,
     "dwarves": 7,
     "initialFood": 3,
     "initialDrink": 10,
     "ticks": 500
   }
   ```

3. **JSON output schema** — a structured snapshot the agent can parse:
   ```json
   {
     "tick": 500,
     "year": 1,
     "day": 10,
     "dwarves": [
       {
         "name": "Urist McTestdwarf",
         "status": "alive",
         "need_food": 12,
         "need_drink": 45,
         "stress_level": 60,
         "current_task": "mine"
       }
     ],
     "summary": {
       "alive": 5,
       "dead": 2,
       "deaths": [
         { "name": "Zon Hammerfall", "cause": "starvation", "tick": 312 }
       ],
       "tasks_completed": 47,
       "events_count": 83
     }
   }
   ```

### Trade-offs

| Pro | Con |
|-----|-----|
| Minimal code — just CLI flags + JSON serializer | No mid-run decisions — can't test player strategy |
| No server to deploy or maintain | Agent can only observe, not interact |
| Easy to run in CI | Scenario design is manual |
| Deterministic with seeded RNG | Limited to pre-defined scenarios |

### Effort estimate

Small. Most of the sim machinery exists. The main work is:
- CLI argument parsing (~50 LOC)
- JSON snapshot serializer (~80 LOC)
- Scenario loader (~60 LOC)
- Bypass Supabase — run entirely in-memory with mock state (~100 LOC)

---

## Option B: Step Mode (Interactive)

### How it works

The sim exposes a step-at-a-time interface. The AI agent advances one tick (or a batch of ticks), inspects state, issues commands (designate mining, assign jobs), then advances again. This enables testing of player decision-making.

```bash
# Start a session
pwarf-sim --step-mode --seed 42 --dwarves 7

# In the agent's loop:
# 1. POST command to stdin or API
# 2. Read state from stdout or API
# 3. Decide next action
# 4. Repeat
```

### What we'd build

Everything from Option A, plus:

1. **Step-mode CLI** — reads JSON commands from stdin, writes state to stdout:
   ```
   → {"command": "tick", "count": 10}
   ← {"tick": 10, "dwarves": [...], "events": [...]}

   → {"command": "designate", "type": "mine", "x": 100, "y": 100, "z": 0}
   ← {"ok": true, "task_id": "abc-123"}

   → {"command": "tick", "count": 50}
   ← {"tick": 60, "dwarves": [...], "events": [...]}

   → {"command": "state"}
   ← {"tick": 60, "dwarves": [...], "tasks": [...], "items": [...]}
   ```

2. **Command schema**:
   - `tick` — advance N ticks
   - `state` — return full current state
   - `designate` — create a task (mine, build, farm, etc.)
   - `cancel` — cancel a pending/claimed task
   - `scenario` — load a scenario mid-session

3. **In-memory task injection** — instead of polling Supabase for new tasks, commands insert directly into `state.tasks`.

### Trade-offs

| Pro | Con |
|-----|-----|
| Agent can test player strategies | More complex protocol |
| Can discover "what should I do when X happens" bugs | Agent needs decision-making logic |
| Still no server — just stdin/stdout | Slower than batch (round-trip per decision) |
| Deterministic | Agent quality determines test quality |

### Effort estimate

Medium. Builds on Option A's foundation:
- stdin/stdout JSON protocol (~100 LOC)
- Command parser + dispatcher (~80 LOC)
- In-memory task injection (reuse existing `state.tasks.push()` pattern)
- State serializer (shared with Option A)

---

## Option C: REST API

### How it works

An Express or Fastify server wraps the sim engine. Multiple worlds can run concurrently. The agent (or any HTTP client) creates worlds, advances ticks, reads state, and issues commands via REST endpoints.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/world` | Create a new world (accepts scenario config) |
| `GET` | `/world/:id` | Get world metadata (tick count, year, day) |
| `GET` | `/world/:id/state` | Full state dump (dwarves, tasks, items) |
| `POST` | `/world/:id/tick` | Advance N ticks (body: `{ "count": 10 }`) |
| `POST` | `/world/:id/designate` | Create a task (body: `{ "type": "mine", "x": 100, ... }`) |
| `DELETE` | `/world/:id/task/:taskId` | Cancel a task |
| `GET` | `/world/:id/events` | Get events (with optional tick range filter) |
| `DELETE` | `/world/:id` | Tear down a world |

### What we'd build

Everything from Options A and B, plus:
- HTTP server with routing (~150 LOC)
- World lifecycle manager — create, store, destroy multiple sim instances (~100 LOC)
- Request validation (~50 LOC)
- New workspace or add to `sim/` package

### Trade-offs

| Pro | Con |
|-----|-----|
| Most flexible — any HTTP client works | Most code to write and maintain |
| Multiple concurrent worlds | Server deployment & lifecycle management |
| Could serve a future web-based test dashboard | Overkill for a single AI agent |
| Language-agnostic | Network latency on every call |

### Effort estimate

Large. The server infrastructure is new surface area that needs testing, error handling, and potentially auth.

---

## Analysis

### What level of interaction does automated playtesting actually need?

For the highest-value playtesting scenarios, **observation is enough**:
- "Do dwarves starve when food is scarce?" → batch mode
- "Does the sim crash after 10,000 ticks?" → batch mode
- "Are need decay rates balanced?" → batch mode with snapshots

Interactive testing adds value for:
- "What's the optimal mining strategy for a new embark?" → step mode
- "Can a player recover from a tantrum spiral?" → step mode
- "Does the job claiming algorithm make reasonable assignments?" → step mode

A REST API is only justified if we need concurrent worlds or external tool integration, neither of which is on the roadmap.

### Can Haiku make meaningful decisions with just a JSON state dump?

Yes, if we design the output well. Key principles:
- **Summarize, don't dump raw DB rows.** Include computed fields like "is starving," "is idle," "time until death."
- **Include events.** Events tell the story — deaths, tantrums, task completions. Raw need numbers alone are hard to interpret.
- **Keep it compact.** Haiku's context window is limited. A 7-dwarf fortress with summary stats fits easily in ~2K tokens.

### How do we represent game state for an LLM?

A good state representation for an LLM should:
1. Lead with a **summary** (alive/dead counts, critical alerts)
2. Include **per-dwarf status** with human-readable labels (not just numbers)
3. List **recent events** (last N ticks) for narrative context
4. Flag **anomalies** (stuck dwarves, impossible states, need values at extremes)

Example:
```json
{
  "summary": {
    "tick": 500, "year": 1, "day": 10,
    "population": { "alive": 5, "dead": 2 },
    "alerts": ["2 dwarves critically hungry", "1 dwarf idle for 100+ ticks"]
  },
  "dwarves": [
    {
      "name": "Urist McTestdwarf",
      "status": "alive",
      "needs": { "food": "critical (8)", "drink": "ok (65)", "sleep": "low (22)" },
      "activity": "mining at (100, 95, 0)",
      "stress": "moderate (45)"
    }
  ],
  "recent_events": [
    { "tick": 480, "text": "Zon Hammerfall died of starvation" },
    { "tick": 495, "text": "Urist McTestdwarf entered a tantrum" }
  ]
}
```

### What's the minimum viable surface?

**Option A (batch mode)** is the minimum viable surface. It delivers immediate value with minimal code and no ongoing maintenance burden.

---

## Recommendation

**Start with Option A (batch mode), design it so Option B (step mode) is a natural extension.**

### Phase 1: Batch mode

1. Add CLI flags to `sim/src/cli.ts`: `--ticks`, `--output`, `--scenario`, `--snapshot-every`, `--seed`
2. Build an in-memory sim runner that bypasses Supabase entirely (useful for tests too)
3. Define 3-5 starter scenarios (starvation, overcrowding, idle fortress, monster attack, long-run stability)
4. Build a JSON state serializer with the LLM-friendly format described above
5. Write a prompt template that feeds the JSON to Haiku and asks for a playtest report

### Phase 2: Step mode (if batch mode proves too limiting)

1. Add `--step-mode` flag that reads JSON commands from stdin
2. Reuse the state serializer and in-memory runner from Phase 1
3. Build a thin command dispatcher (tick, designate, cancel, state)
4. Write an agent loop that alternates between reading state and issuing commands

### Skip Option C unless we need concurrent worlds or external integrations.

### Implementation plan (Phase 1)

| Step | File(s) | Description |
|------|---------|-------------|
| 1 | `sim/src/headless-runner.ts` | New in-memory sim runner (no Supabase, no flush, no poll) |
| 2 | `sim/src/scenarios.ts` | Scenario definitions + loader |
| 3 | `sim/src/state-serializer.ts` | JSON snapshot with LLM-friendly formatting |
| 4 | `sim/src/cli.ts` | Add CLI flags, wire up headless runner |
| 5 | `sim/src/__tests__/headless-runner.test.ts` | Tests for headless runner |
| 6 | `sim/src/__tests__/state-serializer.test.ts` | Tests for serializer output format |
| 7 | Prompt template (TBD) | Haiku prompt for analyzing batch output |

### Key design decisions

- **In-memory runner reuses all existing phases.** The phase functions take a `SimContext` and don't care where state came from. We just need to build a `SimContext` without Supabase.
- **Scenario files are TypeScript**, not JSON, so they can use shared constants and types.
- **The serializer is a separate module** so it can be reused by step mode later.
- **No new dependencies.** CLI arg parsing can use `process.argv` or a lightweight lib like `minimist` if we want flags.
