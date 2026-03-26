---
name: docs-audit
description: Audit docs/ for accuracy, staleness, and gaps — then fix or flag issues
user_invocable: true
---

# Docs Audit Skill

Run this periodically (e.g. after a batch of PRs, a new phase, or when docs feel stale) to keep `docs/` accurate and useful.

## Philosophy

Docs should be **trustworthy or absent**. A wrong doc is worse than no doc — it misleads. Every doc must earn its place by being either:
- **Accurate reference** for something implemented in code, OR
- **Clearly marked design spec** for something not yet built

## Audit Checklist

Work through each section. Use parallel agents where possible.

### 1. Inventory

List every file in `docs/`, `docs/design/`, and `docs/system-overviews/`. For each file, note:
- What system/feature it covers
- Last meaningful git update (`git log -1 --format='%ci' -- <file>`)

### 2. Constants and numbers check

Cross-reference **every numeric constant** mentioned in docs against `shared/src/constants.ts` and the actual code. Common drift points:
- `STEPS_PER_DAY`, `STEPS_PER_YEAR` and any derived timing/pacing math
- `SIM_FLUSH_INTERVAL_MS` and data-loss window claims
- Decay rates (`FOOD_DECAY_PER_TICK`, etc.)
- Threshold values (`STRESS_TANTRUM_THRESHOLD`, etc.)
- Any "~X real seconds" or "~X real minutes" claims

**Action:** Fix wrong numbers in-place. If a doc computes derived values (e.g. "one year = 30 real minutes"), recompute from current constants.

### 3. Phase list accuracy

Read `sim/src/tick.ts` and extract the full ordered phase list from `runTick`. Compare against `docs/design/02-core-game-loop.md` and any other doc listing phases.

**Action:** Update phase lists to match code exactly. Include every phase, in order.

### 4. File/function/type references

Grep for every file path, function name, and type name mentioned in docs. Flag any that no longer exist.

**Action:** Remove or update stale references.

### 5. Implementation status check

For each design doc (`docs/design/*.md`), determine implementation status:
- **Implemented**: Core functionality exists in code and is tested
- **Partial**: Some parts built, others not
- **Design only**: No code exists for this system

**Action:** Add or update a status banner at the top of each design doc:

```markdown
> **Status:** Implemented | Partial | Design only
> **Last verified:** YYYY-MM-DD
```

Use "Design only" — never "planned" or "coming soon" (those go stale silently).

### 6. Gap analysis — undocumented systems

Search for sim phases, major modules, and systems that have NO corresponding doc. Check:
- Every file in `sim/src/phases/`
- Every file in `sim/src/` that defines a major system
- Any `shared/src/` module with complex logic

**Action:** Don't auto-generate docs for these. Instead, list them in a summary and ask the user which ones are worth documenting.

### 7. Removal candidates

Flag docs that are:
- **Fully superseded** by a more detailed doc covering the same system
- **Pure brainstorming** with no actionable content and no implementation
- **So stale** that fixing them would be a full rewrite

**Action:** Don't delete without user approval. List candidates with reasoning.

## Criteria for Adding a New Doc

Only add a doc to `docs/` if ALL of these are true:
- The system is **complex enough** that reading the code alone is insufficient (>2 files, non-obvious interactions)
- The information is **not derivable** from code comments, types, or test names
- Someone (future you, a contributor, the user) would **reasonably search for this**
- You commit to keeping it accurate (or marking it "Design only")

Do NOT create docs for:
- Simple CRUD or one-file utilities
- Things fully covered by CLAUDE.md
- Anything that `git log` or inline comments explain

## Criteria for Removing a Doc

Remove (with user approval) if ANY of these are true:
- Every claim in the doc is wrong and fixing it would be a full rewrite
- The doc duplicates another doc with no unique content
- The system it describes was removed from the codebase
- It's a brainstorm/scratchpad with no reference value

## Criteria for Updating a Doc

Update in-place (no approval needed) when:
- A constant or number changed and the doc references the old value
- A file/function was renamed and the doc uses the old name
- A phase was added/removed and the doc lists phases
- Implementation status changed (design only -> partial -> implemented)

## Output

After the audit, produce a summary with:

1. **Fixed** — list of docs updated with what changed
2. **Flagged** — issues that need user input (removal candidates, ambiguous status)
3. **Gaps** — undocumented systems worth considering
4. **Health score** — X/Y docs are accurate and up-to-date
