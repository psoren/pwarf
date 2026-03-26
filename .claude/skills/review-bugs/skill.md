Base directory for this skill: /Users/parker/github/pwarf/.claude/skills/review-bugs

# Review Bug Reports Skill

Fetch player-submitted bug reports from Supabase, analyze the captured game state, and attempt to reproduce each bug with a scenario test.

## When to use

- Periodically to triage incoming bug reports
- When the user asks to check on bug reports
- After a batch of playtesting where bugs may have been filed

## Instructions

Launch a subagent (use **haiku** model) with the prompt below. The subagent fetches bug reports, analyzes them, attempts reproduction, and reports findings.

### Subagent prompt

You are a bug report reviewer for a dwarf fortress sim. Your job is to fetch recent bug reports from the database, understand what the player reported, and attempt to reproduce the bug using the sim's scenario test infrastructure.

**Step 1: Fetch bug reports from Supabase.**

Use `mcp__supabase__execute_sql` to query recent unreviewed bug reports:

```sql
SELECT id, title, description, game_state, created_at
FROM bug_reports
WHERE reviewed_at IS NULL
ORDER BY created_at DESC
LIMIT 10;
```

If no bug reports exist, report that and stop.

**Step 2: For each bug report, analyze the game state.**

Read these files to understand the sim systems:
- `sim/src/run-scenario.ts` — how to write scenario tests and the ScenarioConfig shape
- `sim/src/__tests__/test-helpers.ts` — factory functions (makeDwarf, makeContext, etc.)
- `shared/src/constants.ts` — tuning constants
- `scripts/bug-to-test.mjs` — existing bug-to-test conversion script (for reference)

For each bug report:
1. Read the title and description to understand what the player observed
2. Examine the `game_state` JSONB snapshot — look at dwarf statuses, pending tasks, items, etc.
3. Identify what looks wrong: stuck dwarves, unfulfilled tasks, unexpected deaths, missing items, etc.
4. Check if the bug matches any recently fixed issues by reading recent git history: `git log --oneline -20`

**Step 3: Attempt to reproduce each bug.**

For each bug report, write a minimal scenario test that tries to reproduce the issue. Create the test file at `sim/src/__tests__/bug-repro-temp.test.ts`.

The test should:
- Set up the game state from the bug report snapshot (dwarves, tasks, items, structures, tiles)
- Run for enough ticks to see if the bug manifests
- Assert on the specific behavior the player reported as broken

Keep the test minimal — don't include the entire game state if only a subset is relevant. Extract the entities that matter for the bug.

Run the test:
```bash
npm run build --workspace=shared --workspace=sim && npm test --workspace=sim -- --run src/__tests__/bug-repro-temp.test.ts
```

**Step 4: Classify each bug report.**

For each bug report, classify it as one of:
- **REPRODUCED** — the scenario test demonstrates the bug (test fails as expected)
- **ALREADY FIXED** — the bug appears to be fixed in the current code (test passes, meaning the buggy behavior no longer occurs)
- **WORKING AS INTENDED** — the game state looks healthy and the reported behavior is not a bug
- **CANNOT REPRODUCE** — couldn't set up a scenario that triggers the reported behavior
- **INSUFFICIENT INFO** — the game state snapshot doesn't contain enough information to understand the bug
- **DUPLICATE** — matches a known/recently-fixed issue

**Step 5: Mark each bug report as reviewed.**

After classifying a bug report, mark it as reviewed in the database so it won't appear in future runs:

```sql
UPDATE bug_reports
SET reviewed_at = now(), classification = '<CLASSIFICATION>'
WHERE id = '<bug-report-id>';
```

Replace `<CLASSIFICATION>` with the classification from Step 4 (e.g. `ALREADY FIXED`, `WORKING AS INTENDED`, etc.).

**Step 6: Clean up and report.**

Delete the temporary test file when done:
```bash
rm -f sim/src/__tests__/bug-repro-temp.test.ts
```

Write a summary report with this structure for each bug report:

```
## Bug Report Review — YYYY-MM-DD

### [Bug Title] (id: <short-id>)
- **Submitted:** <date>
- **Player description:** <what they said>
- **State analysis:** <what the game state reveals>
- **Classification:** REPRODUCED | ALREADY FIXED | WORKING AS INTENDED | CANNOT REPRODUCE | INSUFFICIENT INFO | DUPLICATE
- **Reproduction details:** <what the scenario test showed>
- **Suggested action:** <file an issue / already fixed in commit X / needs investigation>
```

If a bug is REPRODUCED and not yet tracked, suggest filing a GitHub issue with the `bug` label. Include the relevant game state details in the suggestion.

**Important rules:**
- Do NOT modify any source files other than the temporary test file
- Always clean up `bug-repro-temp.test.ts` when done
- If a bug was clearly already fixed, note which commit likely fixed it
- Be concise — focus on whether the bug reproduces, not on lengthy analysis

## Arguments

- No args: review all recent bug reports (up to 10)
- `<id>`: review a specific bug report by ID
- `--limit <N>`: review the N most recent reports
