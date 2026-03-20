---
name: review-pr
description: Self-review an open PR — check diff, tests, types, code quality, and embed Claude cost
user_invocable: true
---

# Review PR Skill

Run this **after creating the PR** and before merging. It reviews the diff, runs tests, and embeds the Claude cost in the PR description.

## Workflow

1. Push branch and create PR (`gh pr create ...`)
2. Run `/review-pr`
3. Fix any blocking issues, then merge

## Instructions

1. **Get the diff**
   - `git diff main...HEAD` — all changes on the branch
   - `git log main...HEAD --oneline` — confirm commit list

2. **Run tests and typecheck**
   - `npm run build` — must pass with no type errors
   - `npm test --workspace=sim` — all sim tests must pass
   - Stop and fix if either fails

3. **Review the diff line by line**

   **Correctness**
   - Does the implementation match the issue description?
   - Edge cases handled? Off-by-one errors? Broken logic?

   **Code quality**
   - Dead code, console.logs, commented-out blocks, unused imports?
   - Magic numbers or duplicated constants that should be extracted?
   - Files over ~300 LOC that should be split?
   - Any default exports (project uses named exports only)?

   **Tests**
   - Do new modules/features have tests?
   - Any obvious missing test cases?

   **Security**
   - User input going into SQL, shell commands, or HTML without sanitization?
   - Secrets or credentials hardcoded?

4. **Check the PR description**
   - `gh pr view` — confirm it references the correct issue (`closes #NNN`)
   - Confirm a playtest report is included with screenshots

5. **Embed Claude cost**
   - `node scripts/session-cost.mjs` — for a normal single-ticket session (total cost = ticket cost)
   - `node scripts/session-cost.mjs --delta $COST_BEFORE` — for Ralph overnight runs (see ralph-wiggum.md)
   - Append to the PR body: `gh pr edit <N> --body "$(gh pr view <N> --json body -q .body)\n\n## Claude Cost\n<output>"`

6. **Report**
   - **Blocking** issues: must fix before merge
   - **Suggestions**: nice to have
   - If clean: "PR looks good — no blocking issues found"
