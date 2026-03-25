# CLAUDE.md

## Project Structure

Monorepo with npm workspaces: `app/` (React/Vite frontend), `sim/` (Node.js simulation engine), `shared/` (shared types/constants).

## Testing

- **All new features and modules must include tests.**
- Test framework: Vitest (configured in each workspace)
- Run all tests: `npm test` (from root)
- Run sim tests: `npm test --workspace=sim`
- Run shared tests: `npm test --workspace=shared`
- Tests live next to source files as `*.test.ts`

### Unit tests

Write unit tests for every pure function in the sim engine. Tests verify isolated logic — a single function, a single calculation.

### Headless mode

The sim must be runnable with zero UI, zero browser, zero human input. All randomness must be seeded for deterministic, reproducible results.

### Scenario tests

Every new sim feature must include a `runScenario()` integration test in `sim/src/__tests__/`. Scenario tests exercise the full tick loop end-to-end — dwarves claim tasks, walk to targets, complete work, and produce results — unlike unit tests which test a single function in isolation. If your feature adds new `ScenarioConfig` fields (e.g. `expeditions`, `ruins`, `fortressDeriver`), wire them into `run-scenario.ts` so scenarios can use them.

### New feature testing checklist

Before merging any new sim system:
- Unit tests for all pure functions
- A `runScenario()` integration test covering the full feature lifecycle
- Headless mode still works (no new browser dependencies)

### Sim/app integration contract

When changing a public API that both `sim/` and `app/` use (e.g. `SimRunner` constructor signature, exported types), **always update both sides in the same PR**. The TypeScript build covers this if types are correct, but `as any` casts in the app can hide mismatches. Avoid `as any` on sim/app boundaries.

## Secrets & credentials

**Never hardcode secrets in source files.** All credentials must come from environment variables.

| Secret | Where it lives | How code accesses it |
|---|---|---|
| Supabase URL | `app/.env.local` (local), GitHub Actions secret | `import.meta.env.VITE_SUPABASE_URL` |
| Supabase anon key | `app/.env.local` (local), GitHub Actions secret | `import.meta.env.VITE_SUPABASE_ANON_KEY` |

- `.env` and `.env.local` files are gitignored — never commit them.
- `.claude/worktrees/` and `.claude/projects/` are also gitignored — they contain copies of local env files.
- GitHub Actions uses repository secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) injected at build time. The hourly digest workflow uses only the built-in `GITHUB_TOKEN` — no extra secrets needed.
- Before opening a PR, confirm no secrets appear in the diff. If a secret is ever accidentally committed, rotate it immediately.

## Workflow

- **`main` has force-push protection enabled.** Never `git push --force` to main. Force-pushing feature branches after a rebase is fine.
- **Always `git pull` on main before starting new work.** Create worktrees off the latest main to avoid missing recently merged changes.
- **Every code change must be made in a worktree, never in the main checkout.** Multiple Claude Code sessions sharing the same working directory will silently overwrite each other's changes. Always use `isolation: "worktree"` for agents or `git worktree add` manually. The main checkout should only be used for read-only operations (browsing, `git log`, etc.).
- **Always run `npm install` after creating a worktree.** Worktrees don't share `node_modules` (it's gitignored). Without `npm install`, npm workspace symlinks won't exist and cross-package imports (e.g., `@pwarf/shared` from `sim/`) will fail to resolve the worktree's versions of the source files.
- **Every change must have a GitHub issue filed first.** Include a description and apply appropriate labels (`bug`, `documentation`, `enhancement`, `phase-0` through `phase-5`, etc.).
- Reference the issue number in commits and PRs (e.g., `closes #123`).
- Close the issue when the PR is merged.
- **One conversation per ticket.** Start a new Claude Code conversation for each ticket/PR. This keeps cost tracking accurate — the session cost reported in the PR description reflects exactly that ticket's work.
- **Use the `in-progress` label to signal active work.** When starting a ticket, add the `in-progress` label (`gh issue edit <N> --add-label "in-progress"`). Before picking up any ticket, check whether it already has this label — if it does, someone else is working on it; skip it and pick the next one.
- **Always return to `main` after finishing work.** After merging a PR or finishing on a feature branch, check out `main` — never leave the working directory on a feature branch.

## Cost Tracking

Every PR description includes a `## Claude Cost` section showing the token count and USD cost for the conversation that produced it. This data flows automatically into the hourly digest blog posts.

**Normal (one conversation per ticket):** The full session cost equals the ticket cost:
```sh
node scripts/session-cost.mjs
```

**Multi-ticket sessions (e.g. Ralph overnight runs):** Snapshot cost before starting a ticket, diff after:
```sh
COST_BEFORE=$(node scripts/session-cost.mjs --snapshot)
# ... do the work ...
node scripts/session-cost.mjs --delta $COST_BEFORE
```

This is done as part of the `/review-pr` skill — no need to run it manually for normal sessions.

## Build & Typecheck

- Typecheck all: `npm run build` (runs tsc in each workspace)
- Dev app: `npm run dev:app`
- Dev sim: `npm run dev:sim`
- **Always run `npm run build` before committing.** TypeScript composite builds cache `.d.ts` files locally; a previously-passing cache can hide errors at cross-package boundaries. If a build passes locally but fails in CI, run `tsc -b --force` in the affected workspace to bust the cache.

## Code Style

- TypeScript throughout
- ESM modules (`"type": "module"`)
- No default exports — use named exports

### Code health rules

Follow these when writing or modifying code to keep the codebase clean:

- **No dead code.** Don't leave unused modules, components, or functions. If nothing imports it (other than its own test), delete it.
- **No duplicated constants.** Glyph maps, magic numbers, config objects — define once, import everywhere. If you need a value in two places, extract it to a shared module.
- **Keep files under ~300 LOC.** If a file grows beyond that, split it into focused modules. Sim phases, React hooks, and utility functions should each be in their own file.
- **Extract React hooks.** `App.tsx` is for layout and orchestration. State logic (data fetching, designation handling, world lifecycle) belongs in custom hooks under `hooks/`.
- **Extract sim phases.** Each sim concern (deprivation, task completion, needs decay) gets its own file under `sim/src/phases/`. Don't let `task-execution.ts` become a catch-all.
- **Shared test helpers.** Test factory functions (`makeDwarf`, `makeContext`, etc.) live in `sim/src/__tests__/test-helpers.ts`. Don't duplicate them across test files.
- **Name test files after what they test.** `dwarf-names.test.ts` tests `dwarf-names.ts`, not `embark.test.ts`.

### Sim tick loop

All sim phase ordering lives in `sim/src/tick.ts` (`runTick`, `advanceTime`, `maybeYearRollup`). Runners (`sim-runner.ts`, `headless-runner.ts`, `run-scenario.ts`, `step-mode.ts`) import from `tick.ts` — never duplicate the phase call list. When adding a new phase, add it once in `tick.ts`.

### Types and constants

- **Derive union types from `as const` arrays.** `TaskType`, `TaskStatus`, `DwarfStatus`, `SkillName` are all defined as `as const` arrays in `shared/src/db-types.ts` with the type derived via `(typeof ARRAY)[number]`. This gives both a runtime value and a compile-time type from a single source of truth. Follow this pattern for new enum-like types.
- **Domain sets belong in `shared/src/constants.ts`.** Sets like `AUTONOMOUS_TASK_TYPES` that both `sim/` and `app/` need should be defined once in shared and imported everywhere. Never duplicate a set of values across files.
- **Skill-to-task mappings stay in `sim/src/task-helpers.ts`.** `TASK_SKILL_MAP` is sim-internal logic — it doesn't need to be in shared.

## PR Self-Review

- **Run `npm test` and `npm run build` before creating a PR.** Confirm both pass before pushing.
- **Every PR must be self-reviewed after creation, before merging.** The workflow is: push branch → create PR → run `/review-pr` → fix blocking issues → merge.
- `/review-pr` checks diff, tests, types, code quality, and embeds the Claude cost in the PR description.
- **After review passes, merge the PR immediately.** Don't leave open PRs sitting around. Once `/review-pr` finds no blocking issues, merge with `gh pr merge <N> --squash`.

## Database migrations

- **Every new table or schema change needs a migration file.** If code references a new Supabase table or column (in `load-state.ts`, a hook, the sim, etc.), a corresponding `supabase/migrations/` file must exist. No exceptions. Forgetting this means the schema only exists in production and breaks every other environment.
- **Adding a value to a TypeScript `as const` enum requires a matching migration.** When you add a new entry to `TASK_TYPES`, `DWARF_STATUSES`, or any other `as const` array that maps to a Postgres enum, you **must** also write a migration with `ALTER TYPE <enum> ADD VALUE IF NOT EXISTS '<value>';`. The TypeScript type system cannot catch this — inserts will silently fail at runtime. This has caused bugs before (e.g. `scout_cave`, `forage`, `build_well`, `build_door`, `deconstruct`, `build_mushroom_garden` were all missing).
- **Never apply changes via Supabase MCP without also writing a migration file.** If you use MCP to apply a policy or column, immediately write and commit the corresponding `supabase/migrations/00NNN_name.sql` file in the same PR.
- **After writing a migration, apply it to production via Supabase MCP** in the same PR. Migration files are not auto-applied — they must be explicitly applied with `mcp__supabase__apply_migration`.
- **Playtests must be run against local Supabase** for any PR that touches DB schema. A playtest against production will silently pass even if the migration is missing.

## Playtesting

**Prefer headless tests over UI playtests.** UI playtests in Chrome are slow and fragile. Use them only when a PR changes visible UI behavior. For sim logic changes, use `runScenario()` instead.

| PR type | Verification |
|---|---|
| Sim logic only (new phase, need tuning, bug fix) | `runScenario()` scenario test + `npm test` |
| New DB table / schema change | `npm test` + quick headless embark to confirm migration works |
| UI change (new component, layout, rendering) | `/playtest` in Chrome with before/after screenshots |
| Full feature (sim + UI together) | Both scenario tests and `/playtest` |

- For UI playtests, run the game against **local Supabase** (not production) so schema issues surface immediately.
- Include a text report in the PR description summarizing what was tested.
- Include **before and after screenshots** for UI changes. Use the `/playtest` skill.
- Use the `github-upload-image-to-pr` skill to attach screenshots to PRs.

### Uploading screenshots to PRs

Use the `github-upload-image-to-pr` skill (installed in `.claude/skills/`) to upload images to PRs. It uses `agent-browser` to upload files through GitHub's comment textarea, then embeds the resulting URLs in the PR description via `gh pr edit`.

**Taking a full-page screenshot (including the log panel and all UI):**

Do NOT use `mainCanvas.toDataURL()` — that only captures the game canvas, not the surrounding HTML panels. Instead, use `html2canvas` to capture the entire page:

```javascript
// Run in mcp__claude-in-chrome__javascript_tool on the game tab
const script = document.createElement('script');
script.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
document.body.appendChild(script);
new Promise(resolve => script.onload = resolve).then(async () => {
  const canvas = await html2canvas(document.body, {useCORS: true, logging: false});
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'pwarf-screenshot.png';
  a.click();
});
```

The file downloads to `~/Downloads/`. Check with `ls -lh ~/Downloads/pwarf-screenshot.png`.

**Workflow:**
1. Capture a full-page screenshot using html2canvas (above) — saves to `~/Downloads/`
2. Use `agent-browser upload "#fc-new_comment_field" /path/to/image.png` to upload via GitHub's file input — note the **double quotes** around the selector; single quotes fail
3. Wait 3–5 seconds, then read the textarea: `agent-browser eval "document.getElementById('new_comment_field')?.value"`
4. Extract the `user-attachments/assets/` URL from the result
5. Update the PR description via `gh pr edit {N} --body "..."` with `<img width="800" alt="desc" src="URL" />` tags
6. Clear the textarea: `agent-browser eval "document.getElementById('new_comment_field').value=''"` — do NOT submit

**Important:** The `mcp__claude-in-chrome__upload_image` tool only accepts screenshot IDs captured in the current session — it cannot upload files from disk. Always use `agent-browser` for image uploads to GitHub.

**Prerequisites:** `agent-browser` must be installed (`npm install -g agent-browser && agent-browser install`) and the `github-upload-image-to-pr` skill installed (`npx skills add tonkotsuboy/github-upload-image-to-pr`). Log into GitHub once: `agent-browser --headed --profile ~/.agent-browser-github open https://github.com/login`.
