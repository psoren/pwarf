Base directory for this skill: /Users/parker/github/pwarf/.claude/skills/chaos-test

# Chaos Test Skill

Adversarial game-breaker agent. Tries to crash, deadlock, corrupt, or otherwise break the sim by writing and running nasty scenario tests. Thinks like a malicious player and a fuzz tester combined.

## When to use

- Before merging major sim changes
- When you suspect there are hidden bugs
- Periodically to stress-test the sim
- When the user says "try to break it"

## Instructions

Launch a **sonnet** subagent with the prompt below. The subagent writes scenario tests, runs them, and reports what broke.

### Subagent prompt

You are a chaos tester for a dwarf fortress sim. Your goal is to BREAK THE GAME. You are adversarial — you want crashes, deadlocks, assertion failures, corrupted state, and impossible situations.

**Step 1: Read the codebase to find attack surfaces.**

Read these files to understand the systems:
- `sim/src/run-scenario.ts` — how to write scenario tests
- `sim/src/__tests__/test-helpers.ts` — factory functions
- `sim/src/phases/task-execution.ts` — movement, work, adjacency
- `sim/src/pathfinding.ts` — BFS, walkable tiles
- `sim/src/phases/task-completion.ts` — what happens on completion
- `sim/src/phases/need-satisfaction.ts` — autonomous eat/drink/sleep
- `sim/src/phases/job-claiming.ts` — task claiming
- `sim/src/resource-check.ts` — resource consumption
- `sim/src/phases/deprivation.ts` — starvation/dehydration death
- `sim/src/phases/combat-resolution.ts` — combat
- `sim/src/phases/haul-assignment.ts` — auto-haul
- `sim/src/phases/auto-brew.ts` — auto-brew
- `sim/src/phases/auto-cook.ts` — auto-cook
- `sim/src/phases/auto-forage.ts` — auto-forage
- `sim/src/inventory.ts` — item pickup, carry weight
- `sim/src/sim-context.ts` — state shape
- `shared/src/constants.ts` — all tuning constants

**Step 2: Think of adversarial scenarios.**

Categories of chaos to explore:

#### Resource edge cases
- Zero items in the world — does everything gracefully degrade?
- All items held by dwarves — can anything still work?
- Negative or zero work_required on a task
- Items at null positions
- Items belonging to a different civ

#### Pathfinding nightmares
- Dwarf completely walled in (no walkable neighbors)
- Task target on an unwalkable tile
- Task target at a position that doesn't exist (negative coords, huge coords)
- Two dwarves on the same tile (violates occupancy invariant)
- Circular wall with no door — task inside, dwarf outside
- Mine task targeting an already-mined tile

#### Population stress
- 0 dwarves — does the sim crash?
- 1 dwarf — solo survival
- 50 dwarves — performance and correctness under load
- All dwarves dead — does the sim handle an empty fortress?
- Dwarf with status "dead" but current_task_id set
- Dwarf with status "missing" and a task assigned

#### Task system abuse
- Task with no target position (null x/y/z)
- Task assigned to a nonexistent dwarf
- Two tasks assigned to the same dwarf
- Duplicate tasks at the same position
- Build task with wrong material available (wood instead of stone)
- Haul task for a nonexistent item
- 100 pending tasks with 1 dwarf — does priority work?

#### Combat chaos
- Monster on top of a dwarf at tick 0
- Monster with 0 health
- Monster with 999 health and 999 threat
- Multiple monsters attacking one dwarf simultaneously
- Dwarf dies mid-task from monster attack

#### Need satisfaction races
- All needs at 0 simultaneously — what fires first?
- Need at exactly the threshold value
- Need satisfaction with no food/drink/beds available
- Sleep interrupted by starvation

#### State corruption
- Expedition with dwarf_ids pointing to dead dwarves
- Structure at position with no matching tile
- Skill record for nonexistent dwarf
- Task referencing item that was already consumed

#### Long-duration stability
- 50,000 tick run — memory leaks? infinite loops? NaN propagation?
- Year rollup boundary — do things break at step % STEPS_PER_YEAR == 0?

**Step 3: Write the test file.**

Create `sim/src/__tests__/chaos-test.test.ts` with as many adversarial tests as you can fit. Each test should:
- Set up a degenerate or adversarial scenario
- Run it via `runScenario()`
- Assert that the sim doesn't crash, throw, or produce NaN/Infinity values
- Check for corrupted state (dead dwarves with tasks, null positions, etc.)

Use `describe` blocks to organize by category. Each test should have a descriptive name like "survives when all dwarves are walled in with no food".

**Important rules:**
- Do NOT modify any source files — only create the test file
- If a test exposes a real crash or bug, that's SUCCESS — report it clearly
- If the sim handles a degenerate case gracefully, that's fine — note it as "resilient"
- Run `npm test --workspace=sim -- --run src/__tests__/chaos-test.test.ts` after writing
- Then run `npm test --workspace=sim -- --run` to make sure you didn't break existing tests

**Step 4: Report findings.**

Classify each test result:
- **CRASH** — sim threw an unhandled error
- **BUG** — sim didn't crash but produced incorrect/corrupted state
- **DEADLOCK** — sim ran but dwarves got permanently stuck
- **RESILIENT** — sim handled the edge case correctly

Write a summary at the end with the total count of each category. Focus most detail on CRASH and BUG findings — those need fixes.

## Arguments

- No args: run full chaos suite
- `--quick`: only run the fastest tests (skip 50k tick stability)
- `--category <name>`: only test one category (e.g., `--category pathfinding`)
