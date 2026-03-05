# Playtest Session

Run an interactive playtest of Terra Miner using Playwright MCP tools. Walk through the core gameplay loop (base -> dive prep -> mine -> surface) and report on visual state and errors.

## Prerequisites

1. Check if the dev server is running:
   ```bash
   curl -s http://localhost:5173 | head -1
   ```
   If it is not running, start it:
   ```bash
   npm run dev &
   ```
   Wait a few seconds for it to be ready.

## Playtest Steps

Use MCP Playwright tools throughout (`browser_navigate`, `browser_click`, `browser_take_screenshot`, `browser_snapshot`, `browser_console_messages`, `browser_press_key`).

**If any step fails, immediately capture a screenshot + snapshot + console messages for debugging before continuing.**

### Step 1: Load the App
- Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
- Wait for the app to load
- Take a screenshot and review it

### Step 2: Start a Dive
- Click `[data-testid="btn-dive"]` (use `force: true` since Phaser canvas may intercept clicks)
- Wait for the dive prep screen to appear
- Take a screenshot of the dive prep screen

### Step 3: Enter the Mine
- Click `[data-testid="btn-enter-mine"]` (use `force: true`)
- Wait 3 seconds for the mine to fully load and render
- Take a screenshot of the mine

### Step 4: Mine Some Blocks
- Press `ArrowDown` 3 times (with 500ms waits between presses)
- Press `ArrowRight` 2 times (with 500ms waits between presses)
- Take a screenshot of the mining state

### Step 5: Surface
- Click `[data-testid="btn-surface"]` (use `force: true`)
- Wait 2 seconds for the results screen
- Take a screenshot of the results screen

### Step 6: Check Console
- Call `browser_console_messages` to capture all JS errors from the session
- Review for any warnings or errors

## Report

After completing all steps, provide a summary:
- **Screenshots reviewed**: Note any visual issues (broken layouts, missing sprites, overlapping elements)
- **Console errors**: List any JS errors or concerning warnings
- **Overall health**: Pass/fail assessment of the core gameplay loop

## Alternative Presets

You can also test with these presets by changing the URL parameter:
- `?devpreset=endgame_all_rooms` — Late-game state with all dome rooms unlocked
- `?devpreset=empty_inventory` — Zero resources, tests scarcity UI states
- `?devpreset=mid_dive` — Mid-game player with active companion
- `?devpreset=quiz_due` — 30 facts with overdue reviews, tests quiz prompts
- `?devpreset=rich_player` — Max resources for testing crafting and store UI
- `?devpreset=first_boot` — Fresh boot, tests onboarding and tutorial flow (note: does NOT skip onboarding)

Always include `?skipOnboarding=true&` before `devpreset=` for all presets except `first_boot`.
