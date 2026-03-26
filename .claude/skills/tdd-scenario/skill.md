Base directory for this skill: /Users/parker/github/pwarf/.claude/skills/tdd-scenario

# TDD Scenario Skill

Red-green TDD workflow: user describes a bug or expected behavior, you write a failing scenario test, then implement the fix, then verify the test passes.

## When to use

- User describes a bug to reproduce and fix
- User describes expected behavior that doesn't work yet
- User says "tdd", "red-green", or describes a scenario they want tested and fixed

## Instructions

Follow this exact workflow. Do NOT skip steps or reorder them.

### Step 1: Understand the scenario

Read the user's description carefully. Identify:
- **What should happen** (expected behavior)
- **What actually happens** (current bug or missing feature)
- **Key actors** (dwarves, items, tasks, tiles involved)

If the description is ambiguous, ask clarifying questions before proceeding.

### Step 2: Read relevant code

Before writing anything, read:
- `sim/src/run-scenario.ts` — how to write scenario tests
- `sim/src/__tests__/test-helpers.ts` — factory functions (`makeDwarf`, `makeTask`, `makeSkill`, `makeItem`, etc.)
- The specific sim phases related to the scenario (e.g., `sim/src/phases/task-execution.ts`, `sim/src/phases/task-completion.ts`, etc.)
- `shared/src/constants.ts` — relevant constants

Also read 1-2 existing scenario tests in `sim/src/__tests__/` that are similar to the one you'll write, to match the style.

### Step 3: Write the failing test (RED)

Create the scenario test file in `sim/src/__tests__/`. Name it descriptively after what it tests (e.g., `dwarf-hauls-after-mining.test.ts`).

The test should:
- Use `runScenario()` for full tick-loop integration testing
- Set up realistic conditions (multiple dwarves if relevant, decaying needs, pre-placed food/drink)
- Assert on the outcome the player cares about
- Follow the patterns in CLAUDE.md's "What makes a good scenario test" section

### Step 4: Run the test — confirm it FAILS

```sh
npm test --workspace=sim -- --run src/__tests__/<test-file>.test.ts
```

**The test MUST fail.** If it passes, the bug isn't reproduced — revisit the test setup. Tell the user what the failure looks like and confirm it matches the described bug.

### Step 5: Implement the fix (GREEN)

Now fix the sim code to make the test pass. Keep the fix minimal — don't refactor or add unrelated improvements.

### Step 6: Run the test — confirm it PASSES

```sh
npm test --workspace=sim -- --run src/__tests__/<test-file>.test.ts
```

**The test MUST pass now.** If it doesn't, iterate on the fix.

### Step 7: Run full test suite — check for regressions

```sh
npm test --workspace=sim -- --run
```

All existing tests must still pass. If any regress, fix them.

### Step 8: Typecheck

```sh
npm run build
```

### Step 9: Report

Summarize:
- **Scenario:** what was tested
- **Root cause:** what was wrong
- **Fix:** what changed
- **Test file:** path to the new test
- **Changed files:** list of modified source files

## Arguments

The user's natural-language description of the bug or scenario is the only argument. Pass it directly — no special formatting needed.
