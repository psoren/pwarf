Base directory for this skill: /Users/parker/github/pwarf/.claude/skills/headless-playtest

# Headless Playtest Skill

Run the game headlessly via subagent. The subagent plays the game, analyzes the results, and writes a playtest report with balance findings and suggestions.

## When to use

- After sim logic changes (new phases, need tuning, constant changes)
- To check game balance across scenarios
- When you want to know if the game is fun/broken/boring without opening a browser

## Instructions

Launch a subagent to perform the headless playtest. The subagent should:

### Phase 1: Batch observation

Run all scenarios to get baseline data:

```bash
npm run build --workspace=sim
node scripts/playtest-all.mjs --pretty
```

This runs: `starvation`, `idle-fortress`, `long-run-stability`, `overcrowding`

### Phase 2: Interactive investigation

If batch results show issues, use step mode to investigate:

```bash
# Observe at checkpoints
node scripts/playtest-interactive.mjs --scenario <name> --observe 50,200,500,1000

# Custom plan via stdin
echo '[
  {"command":"state"},
  {"command":"designate","type":"mine","x":100,"y":100,"z":0},
  {"command":"tick","count":100},
  {"command":"state"},
  {"command":"tick","count":400},
  {"command":"state"}
]' | node scripts/playtest-interactive.mjs --scenario idle-fortress
```

Available task types for designate: `mine`, `build_wall`, `build_bed`, `build_table`, `build_chair`, `build_door`, `build_well`, `farm`, `eat`, `drink`

### Phase 3: Write the report

Write a playtest report to `playtest-reports/` with this structure:

```markdown
# Playtest Report — YYYY-MM-DD

## Scenarios Tested
- List each scenario and high-level outcome

## Balance Issues
- Specific problems found (e.g., "all dwarves die of dehydration by tick 3000")
- Include data: dwarf names, need values, death causes

## Fun Assessment
Rate each scenario:
- Is there meaningful player agency? (Can decisions change outcomes?)
- Is the difficulty appropriate? (Not too easy, not unfairly hard?)
- Are there interesting events/stories? (Emergent behavior?)
- Is the pacing right? (Things happen at a good rate?)

## Bugs or Unexpected Behavior
- Anything that seems broken or impossible

## Suggestions
- Specific, actionable balance changes (e.g., "reduce FOOD_DECAY_RATE from X to Y")
- New features that would improve fun
- Reference the relevant constants in `shared/src/constants.ts`

## Raw Data
<details>
<summary>Batch results</summary>

```json
(paste batch output here)
```
</details>
```

### Phase 4: File issues (optional)

If the subagent finds balance issues or bugs, it can file GitHub issues with the `bug` or `enhancement` label.

## Arguments

- No args: run all scenarios with defaults
- `<scenario>`: run a single scenario (e.g., `/headless-playtest starvation`)
- `--interactive`: also run interactive investigation phase
