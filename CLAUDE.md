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

- **Every change must have a GitHub issue filed first.** Include a description and apply appropriate labels (`bug`, `documentation`, `enhancement`, `phase-0` through `phase-5`, etc.).
- Reference the issue number in commits and PRs (e.g., `closes #123`).
- Close the issue when the PR is merged.
- **One conversation per ticket.** Start a new Claude Code conversation for each ticket/PR. This keeps cost tracking accurate — the session cost reported in the PR description reflects exactly that ticket's work.

## Cost Tracking

Every PR description includes a `## Claude Cost` section showing the token count and USD cost for the conversation that produced it. This data flows automatically into the hourly digest blog posts.

To generate the cost line for the current session, run from the repo root:

```sh
node scripts/session-cost.mjs
```

This is done as part of the `/review-pr` skill — no need to run it manually.

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

## PR Self-Review

- **Every PR must be self-reviewed before it is created.** Run `/review-pr` to check the diff, tests, types, and code quality before pushing.
- Fix any blocking issues found before opening the PR.

## Playtesting

- **Every PR must include a playtest.** After implementing a feature or fix, run the game in Chrome and verify it works end-to-end.
- Include a text report in the PR description summarizing what was tested and the results.
- Include **before and after screenshots** — one showing the state before your change (bug or missing feature), one after (fix working). To get the "before" shot, stash your changes or check out main, run the game, capture, then restore your branch.
- Use the `/playtest` skill to run the game locally in Chrome with browser automation.

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
