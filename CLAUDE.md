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

### New feature testing checklist

Before merging any new sim system:
- Unit tests for all pure functions
- Headless mode still works (no new browser dependencies)

## Workflow

- **Every change must have a GitHub issue filed first.** Include a description and apply appropriate labels (`bug`, `documentation`, `enhancement`, `phase-0` through `phase-5`, etc.).
- Reference the issue number in commits and PRs (e.g., `closes #123`).
- Close the issue when the PR is merged.

## Build & Typecheck

- Typecheck all: `npm run build` (runs tsc in each workspace)
- Dev app: `npm run dev:app`
- Dev sim: `npm run dev:sim`

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

## Playtesting

- **Every PR must include a playtest.** After implementing a feature or fix, run the game in Chrome and verify it works end-to-end.
- Include a text report in the PR description summarizing what was tested and the results.
- Include screenshots demonstrating the feature working (or bugs found).
- Use the `/playtest` skill to run the game locally in Chrome with browser automation.
