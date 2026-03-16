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

## Build & Typecheck

- Typecheck all: `npm run build` (runs tsc in each workspace)
- Dev app: `npm run dev:app`
- Dev sim: `npm run dev:sim`

## Code Style

- TypeScript throughout
- ESM modules (`"type": "module"`)
- No default exports — use named exports
