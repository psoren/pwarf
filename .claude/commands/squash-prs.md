Squash all open PRs down to a single commit each (per branch policy).

Steps:

```bash
# List all open PRs
gh pr list --state open --json number,title,headRefName
```

For each PR branch, check how many commits it has ahead of main:
```bash
git log --oneline origin/<branch> ^origin/main
```

Skip any branch that already has exactly one commit.

For each branch with more than one commit:
1. Check out the branch: `git checkout <branch>`
2. Soft-reset to main: `git reset --soft origin/main`
3. Commit with the PR title as the message (keep the `closes #N` reference): `git commit -m "..."`
4. Force push: `git push --force-with-lease`

After squashing all branches, confirm with a summary:

---
## Squash complete

- #N — <title>: squashed <X> commits → 1 ✓
- #N — <title>: already 1 commit, skipped ✓
---
