Review all open pull requests and report anything that needs attention. For each open PR, check:

1. **Merge conflicts** — if `mergeable` is `CONFLICTING`, the branch needs to be rebased onto main
2. **CI failures** — if the latest check run has `conclusion: FAILURE`, fetch the failed log and summarize the error
3. **Needs squash** — if the branch has more than one commit ahead of main, it must be squashed before merging
4. **Stale / no CI** — if there are no check runs yet or the last run is very old, flag it

Steps:

```bash
# Get all open PRs with merge status and CI checks
gh pr list --state open --json number,title,headRefName,mergeable,statusCheckRollup
```

For each PR, check commit count ahead of main:
```bash
git log --oneline origin/<branch> ^origin/main
```

For each PR with a CI failure, fetch the failed log:
```bash
gh run view <run-id> --log-failed
```

Then produce a concise report in this format:

---
## PR Health Report

### Needs rebase
- #N — <title> (`feat/branch-name` conflicts with main)

### CI failing
- #N — <title>: <one-line summary of the error>

### Needs squash
- #N — <title>: X commits, must be squashed to 1

### All clear
- #N — <title> ✓

---

After the report, ask the user which items they'd like to address. If they say "fix them all" or similar, work through each one:
- For a **rebase**: check out the branch, `git fetch origin main`, `git rebase origin/main`, resolve any conflicts, then `git push --force-with-lease`
- For a **CI failure**: read the relevant source files, fix the error, commit, and push
- For a **squash**: check out the branch, `git reset --soft origin/main`, recommit with a clean message, then `git push --force-with-lease`
