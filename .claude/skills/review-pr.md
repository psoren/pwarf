---
name: review-pr
description: Self-review the current PR before it is pushed — check diff, tests, types, and code quality
user_invocable: true
---

# Review PR Skill

Self-review the open PR (or staged changes) before pushing, catching issues before a human reviewer sees them.

## Instructions

1. **Get the diff**
   - Run `git diff main...HEAD` to see all changes on the branch
   - Run `git log main...HEAD --oneline` to confirm the commit list

2. **Run tests and typecheck**
   - `npm run build` — must pass with no type errors
   - `npm test` — all tests must pass
   - If either fails, stop and fix before continuing

3. **Review the diff line by line, checking for:**

   **Correctness**
   - Does the implementation match the issue/feature description?
   - Are edge cases handled?
   - Any off-by-one errors, wrong conditions, or broken logic?

   **Code quality**
   - Dead code left in (console.logs, commented-out blocks, unused imports)?
   - Magic numbers or duplicated constants that should be extracted?
   - Files over ~300 LOC that should be split?
   - Any default exports (project uses named exports only)?

   **Tests**
   - Do new modules/features have tests?
   - Are test files named after what they test?
   - Any obvious missing test cases for the new logic?

   **Security**
   - Any user input going into SQL, shell commands, or HTML without sanitization?
   - Any secrets or credentials hardcoded?

4. **Check the PR description**
   - Run `gh pr view` to read the current PR description
   - Confirm it references the correct issue number (`closes #NNN`)
   - Confirm a playtest report is included with screenshots

5. **Embed Claude cost in the PR description**
   - Run `node scripts/session-cost.mjs` from the repo root to get the cost for this conversation
   - Append a `## Claude Cost` section to the PR description via `gh pr edit <N> --body "$(gh pr view <N> --json body -q .body)\n\n## Claude Cost\n<output from script>"`
   - This ensures cost data flows into the hourly digest blog posts automatically

6. **Report**
   - List any issues found, grouped by severity: **Blocking** (must fix) vs **Suggestions** (nice to have)
   - If blocking issues exist, fix them and re-run this skill
   - If clean, state clearly: "PR looks good — no blocking issues found"
