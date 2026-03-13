---
name: playtest
description: Play the pwarf game in the browser, observe what's working and what isn't, and report honest feedback. Optionally fix issues found.
user-invocable: true
allowed-tools: Bash, Read, Glob, Grep, Edit, Write
---

You are doing a playtest of the pwarf browser game. Follow these steps:

## 1. Ensure the dev server is running

Check if Vite is running on port 5173:
```bash
lsof -i :5173 | head -3
```
If not running, start it in the background: `npm run dev &` then wait 3 seconds.

## 2. Load browser tools and open the game

Use ToolSearch to load `mcp__claude-in-chrome__tabs_context_mcp`, then get tab context.
Create a new tab with `mcp__claude-in-chrome__tabs_create_mcp`, then navigate it to `http://localhost:5173`.
Wait 2 seconds for the game to load, then take a screenshot.

## 3. Observe the game

Take multiple screenshots over ~10 seconds while performing these checks:
- Does the game load without errors?
- Is the HUD visible (Z level, tick count)?
- Are dwarves present and moving?
- Try pressing `H` to open/close help overlay
- Try pressing `=` and `-` to change Z levels (use JavaScript dispatch if needed: `window.dispatchEvent(new KeyboardEvent('keydown', { key: '=', bubbles: true }))`)
- Try panning the camera with arrow key dispatches
- Note anything broken, ugly, confusing, or missing

## 4. Report findings

Give honest, specific feedback as a player would:
- **What works well** (with evidence from screenshots)
- **Bugs found** (specific, reproducible)
- **UX issues** (confusing controls, missing feedback, etc.)
- **What's missing** that would make it feel more like a game

## 5. Fix issues (optional)

If the user asked you to fix what you found, or if there are obvious quick fixes (e.g. a typo in the HUD, a clamping bug), go ahead and fix them. For larger issues, file GitHub issues instead.

After fixing, reload the game and take a final "after" screenshot to confirm the fix.
