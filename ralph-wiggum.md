# Ralph Wiggum — Overnight Run Instructions

Hey Ralph. Parker is asleep. You're in charge. Here's everything you need to know.

## Environment

- Local Supabase should be running (Parker set it up before going to sleep).
- Check with `supabase status`. If it's stopped, run `supabase start`.
- Local Supabase URL: `http://127.0.0.1:54321`
- Credentials files (gitignored, on disk):
  - App: `.env.local.supabase-local` → copy to `app/.env.local` to point the frontend at local DB
  - Sim: `.env.sim.local` → `source .env.sim.local` before running the sim CLI
- Apply new migrations: `supabase migration up` (or `supabase db reset` to start fresh)
- Studio UI: http://127.0.0.1:54323

## What you are

You're running autonomously overnight on the `pwarf` project — a Dwarf Fortress-inspired browser sim built with React/Vite + Node.js + Supabase. The sim runs as a headless Node.js process; the frontend connects via Supabase Realtime.

## Tone

Keep it casual. Don't be overly formal. Parker is chill.

## What to work on

### Priority order

1. **Fix bugs first** — bugs block playtesting and everything else.
2. **Milestone 02: Core Sim Engine** — foundational work, unblocks everything.
3. **Milestone 03: Needs & Stress** — game content, can be done in parallel.
4. **Milestone 11: Testing & Automation** — depends on Milestone 02 being done.
5. **Design doc issues** — if the backlog runs dry, read `docs/design/` and file new tickets.

### Current open tickets (as of 2026-03-20)

| # | Milestone | Title |
|---|---|---|
| #302 | — (bug) | embark fails — 'position_x' column missing from structures schema cache |
| #195 | 02 | Define WRITE_INTERVAL and WRITE_TICKS constants |
| #282 | 02 | Seeded RNG for deterministic sim runs |
| #280 | 02 | State adapter interface: decouple sim from Supabase |
| #281 | 02 | Headless tick runner for scenario testing |
| #289 | 03 | Social need satisfaction: proximity to other dwarves |
| #290 | 03 | Purpose need satisfaction: restore on task completion |
| #291 | 03 | Beauty need satisfaction: passive recovery near structures |
| #293 | 05 | Set up local Supabase for development and testing |
| #283 | 01 | Custom map fixtures for test scenarios |
| #298 | 11 | feat: batch mode automated playtesting (Phase 1) |
| #299 | 11 | feat: step mode automated playtesting (Phase 2) |

**Dependency order for Milestone 02:**
`#195` (trivial) → `#282` (seeded RNG) → `#280` (state adapter) → `#281` (headless runner)

Milestone 11 (#298, #299) is blocked until #281 is done.

### When the backlog runs out

Read `docs/design/` top to bottom. Every doc maps to a milestone:

| File | Milestone |
|---|---|
| `01-world-generation.md` | 01: World Generation |
| `02-core-game-loop.md` | 02: Core Sim Engine |
| `03-dwarf-needs-and-stress.md` | 03: Needs & Stress |
| `04-rendering-and-ui.md` | 04: Rendering & UI |
| `05-data-flow-and-persistence.md` | 05: Data Flow & Persistence |
| `06-graveyard-and-ruins.md` | 06: Graveyard & Ruins |
| `07-monsters-and-combat.md` | 07: Monsters & Combat |
| `08-event-system.md` | 08: Event System |
| `09-ui-screens-and-interaction.md` | 09: UI Screens & Interaction |
| `10-dwarf-task-dispatch.md` | 10: Task Dispatch & Jobs |

For each thing in the design doc that isn't implemented yet: file a GitHub issue under the right milestone, then implement it.

## Workflow rules (from CLAUDE.md + memory)

- **Every change needs a GitHub issue filed first.** Include description + appropriate labels.
- **Always use a git worktree for new work.** Never edit in the main checkout.
- **Branch off main.** Always.
- **One commit per PR.** Squash before merging.
- **Every PR needs a playtest** — run `/playtest` and include a text report + before/after screenshots.
- **Every PR needs `/review-pr`** before opening it.
- **Always add tests.** Every new feature or module needs Vitest tests.
- **Run `npm test` after any sim changes** to confirm nothing breaks.
- **No hardcoded secrets.** Supabase creds come from env vars only.
- **Apply the "bug" label** when filing bug issues.
- **Force push after rebase is fine** — no need to confirm.

## Small/trivial changes

Small fixes (typos, constants, one-liners) can go directly to main without a worktree or PR. Use judgment — if it's > ~10 lines or touches logic, use a PR.

## Codebase layout

```
app/          React/Vite frontend
sim/          Node.js simulation engine
shared/       Shared types and constants
docs/design/  Design docs (source of truth for what to build)
supabase/     DB migrations
```

Key files:
- `shared/src/constants.ts` — timing constants, shared config
- `sim/src/sim-runner.ts` — main tick loop
- `sim/src/phases/` — each sim phase is its own file
- `app/src/hooks/` — React hooks (data fetching, world lifecycle)
- `app/src/App.tsx` — layout/orchestration only

## Code health rules (from CLAUDE.md)

- No dead code — if nothing imports it, delete it
- No duplicated constants — define once, import everywhere
- Keep files under ~300 LOC — split if bigger
- Extract React hooks out of App.tsx
- Each sim phase gets its own file under `sim/src/phases/`
- Test helpers live in `sim/src/__tests__/test-helpers.ts`

## Cost tracking per ticket

You're running as one long session, so `session-cost.mjs` will report cumulative cost. To get a per-ticket cost, snapshot before you start and diff after:

```sh
# Before starting a ticket — save the baseline
COST_BEFORE=$(node scripts/session-cost.mjs --snapshot)

# ... do the work ...

# When creating the PR — get the delta
node scripts/session-cost.mjs --delta $COST_BEFORE
```

Embed the output in the `## Claude Cost` section of the PR description as usual.

## Commits

Format: `type: description (closes #N)`

Examples:
- `feat: seeded RNG for deterministic sim runs (closes #282)`
- `fix: reload Supabase schema cache after column additions (closes #302)`

## If something is broken or unclear

Don't brute-force it. Stop, think, try a different approach. If truly stuck, leave a comment on the relevant GitHub issue explaining what you tried and where it got stuck, then move on to the next ticket.

## Have fun

You're building a dwarf sim. That's pretty cool.
