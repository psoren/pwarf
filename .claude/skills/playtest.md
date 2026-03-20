---
name: playtest
description: Run the game locally and playtest it in Chrome, documenting findings
user_invocable: true
---

# Playtest Skill

Run the pWarf game locally and playtest it in Chrome using browser automation tools. Document bugs, UX issues, and observations.

## Instructions

1. **Start the dev server**
   - Run `npm run dev:app` in the background
   - Wait for Vite to report the local URL (e.g., `http://localhost:5173/`)

2. **Open in Chrome**
   - Use `mcp__claude-in-chrome__tabs_context_mcp` to get current tabs
   - Create a new tab with `mcp__claude-in-chrome__tabs_create_mcp`
   - Navigate to the dev server URL

3. **Login**
   - Use test credentials: `claudeplaytest@pwarf.dev` / `password`
   - Fill in the login form and submit

4. **Test the following flows, taking screenshots at each step:**

   **World Generation**
   - Click "Generate World" if no world exists
   - Verify progress bar works
   - Time how long generation takes
   - Check for console errors during generation

   **World Map**
   - Verify terrain renders correctly (no repeating fallback pattern of T/=/,/.)
   - Hover over tiles and check Tile Info panel updates (terrain, elevation, biome, explored)
   - Test WASD panning — verify new tiles load
   - Test panel collapse buttons `[` and `]`
   - Check Log and Legends tabs in right panel
   - Look for blank/missing tile areas

   **Embark**
   - Hover over a non-ocean tile
   - Click "Embark Here"
   - Verify no RLS or other errors in console
   - Verify mode switches to Fortress

   **Fortress View**
   - Verify fortress renders (walls, floors, etc.)
   - Check left panel shows dwarf roster
   - Test switching back to World view and back

   **General**
   - Check for console errors/warnings throughout
   - Verify Sign Out works
   - Test page refresh — does session restore?
   - Note any UI/UX friction

5. **Report findings**
   - Use the `github-upload-image-to-pr` skill to attach screenshots to the PR description
   - Include a text report in the PR description summarizing:
     - Screenshots of any bugs found
     - List of working features
     - List of bugs/issues with descriptions
     - Suggestions for improvement
   - File new GitHub issues for any bugs found (with `bug` label)

## Tips

- Use `mcp__claude-in-chrome__read_console_messages` with `pattern: "error|Error"` to check for errors
- Use `mcp__claude-in-chrome__computer` with `action: "screenshot"` liberally
- Use `mcp__claude-in-chrome__computer` with `action: "zoom"` to inspect small UI details
- The canvas-based map requires mouse hover events; use `mcp__claude-in-chrome__computer` with `action: "hover"` to trigger tile info
- If the Chrome extension blocks interactions, try creating a new tab or using keyboard shortcuts
