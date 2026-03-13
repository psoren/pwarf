# Agent Guide

This guide explains how a Claude Code agent handles an issue end-to-end. Follow it exactly.

---

## Step 1 — Read ARCHITECTURE.md

**Do this before writing a single line of code.**

`docs/ARCHITECTURE.md` tells you:
- Which module owns the thing you're building
- What the import rules are
- Concrete examples of ECS components, systems, and prefab factories
- Where ambiguous things live (the "resolved examples" table)

If you skip this step and put something in the wrong module, the PR will be rejected.

## Step 2 — Read CONVENTIONS.md

`docs/CONVENTIONS.md` has the exact patterns to follow:
- How to create a new component (step-by-step)
- How to write a system
- How to write a test
- File naming rules
- YAML loader structure

## Step 3 — Read the issue

Understand the **acceptance criteria** and **files to touch**. These are your definition of done. Check for "Blocked by" links — do not start if a blocker is unresolved.

## Step 4 — Read existing code in the relevant module

Before writing anything, read the files you'll be modifying or sitting alongside. Match the existing patterns. Don't invent new ones.

## Step 5 — Branch

**Always create a new branch from an up-to-date main. Never commit directly to main. Never reuse a branch from a previous issue. Each issue gets its own branch and its own PR.**

```bash
git checkout main && git pull
git checkout -b feat/issue-NNN-short-description
```

## Step 6 — Implement

Work through the acceptance criteria one at a time. Use the patterns from CONVENTIONS.md.

**Implementation checklist:**
- [ ] Code lives in the correct module (verify against ARCHITECTURE.md)
- [ ] Import direction is respected (never import ui from systems, never import anything into core)
- [ ] No browser APIs (`window`, `document`, `canvas`) outside `src/ui/`
- [ ] New ECS component: one file in `src/core/components/`, exported from `index.ts`
- [ ] New system: one exported function, queries at module level, no stored state
- [ ] Non-numeric entity data in `src/core/stores.ts`, cleaned up in `exitQuery`
- [ ] Prefab factories in `src/entities/`, named `createNoun()`, return entity ID
- [ ] YAML data in `src/data/`, Zod schema co-located with loader
- [ ] No `any` without an explanatory comment
- [ ] All exported functions have explicit return types

## Step 7 — Write tests

Every issue requires tests. No exceptions.

```ts
// tests/systems/mySystem.test.ts
import { describe, it, expect } from 'vitest'
import { createWorld, addEntity, addComponent } from 'bitecs'
import { MyComponent } from '@core/components/myComponent'
import { mySystem } from '@systems/mySystem'

describe('mySystem', () => {
  it('does the expected thing', () => {
    const world = createWorld()
    const eid = addEntity(world)
    addComponent(world, MyComponent, eid)
    // set up state
    mySystem(world, 1)
    // assert
  })

  it('handles edge case', () => {
    // ...
  })
})
```

Minimum: happy path + one edge/error case per exported function.

## Step 8 — Verify locally

All four must pass before opening a PR:

```bash
npm run lint        # zero warnings allowed
npm run typecheck   # zero errors
npm test            # all tests green
npm run build       # clean build
```

Fix every failure. Do not open a PR with a failing check.

## Step 9 — Create the PR

```bash
gh pr create \
  --title "feat: short description (closes #NNN)" \
  --body "$(cat <<'EOF'
Closes #NNN

## What this does
[1-3 sentences describing the change]

## Acceptance criteria covered
- [x] criterion 1
- [x] criterion 2

## Test plan
- [x] Unit tests in tests/...
- [x] Edge case: ...
EOF
)"
```

---

## Common Pitfalls

**Wrong module placement.** Check the "resolved examples" table in ARCHITECTURE.md. When unsure: if it's shared data/types, it's `core`. If it's tile/world data, it's `map`. If it runs every tick, it's a `system`. If it creates entities, it's `entities`.

**Circular imports.** If module A imports B and B imports A, one of them is in the wrong place. The thing being shared should move to `core`.

**Queries inside system functions.** `defineQuery` called inside the function body creates a new query every tick — a bitecs bug magnet. Always define queries at module level.

**Mutating GameData.** `GameData` is frozen. If you need a modified copy of a material or reaction, clone it in your system. Never mutate the source.

**Missing store cleanup.** If you write to a side store in an `enterQuery`, you must delete the entry in the matching `exitQuery`. Otherwise entity IDs get recycled and the store leaks stale data.

**Browser APIs in headless code.** `HeadlessGame` runs in Node with no DOM. Any import chain from `HeadlessGame` that reaches `window`, `document`, `canvas`, or `requestAnimationFrame` will crash. Keep UI strictly in `src/ui/`.

**Mega-PRs.** If you realize mid-implementation that an issue is bigger than one PR, stop, comment on the issue explaining the split you'd propose, add the `needs-human-review` label, and wait for guidance. Don't submit 800-line PRs.

---

## Labels

| Label | Meaning |
|-------|---------|
| `agent-ready` | All blockers resolved, safe to pick up |
| `blocked` | Waiting on another issue — check the "Blocked by" links |
| `needs-human-review` | Agent got stuck or issue needs to be split — do not pick up |
| `phase-N` | Development phase this belongs to |

If you are stuck or unsure about an architectural decision, notify the team via the /notify slash command before making assumptions. Do not spend more than 2 attempts on a failing test without notifying.