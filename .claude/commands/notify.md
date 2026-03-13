When you get stuck, encounter a failing test you can't fix after 2 attempts,
need a design decision, or hit an ambiguous requirement, file a GitHub issue
and stop working on the current task:

```bash
gh issue create \
  --title "Agent stuck: <brief description of the problem>" \
  --label "needs-human-review" \
  --body "## What I was working on
Issue #N — <issue title>

## What went wrong
<describe the problem, error messages, or ambiguity>

## What I tried
<list attempts>

## What I need
<specific question or decision needed>"
```

This will trigger a Slack notification automatically via GitHub Actions.
Then stop working on the issue and move on to the next agent-ready issue.
