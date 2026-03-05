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
- **Alternative**: Use the `mid_dive_active` preset (`?skipOnboarding=true&devpreset=mid_dive_active`) to land directly on the DivePrepScreen without needing to click through the Phaser canvas

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

## All Dev Presets (20 total)

All presets are defined in `src/dev/presets.ts`. Use them via URL parameter: `?skipOnboarding=true&devpreset=<id>`.

### Onboarding / Early Game
| Preset | Description |
|--------|-------------|
| `first_boot` | Absolute first boot -- tests onboarding, age gate, tutorial. **Do NOT use `skipOnboarding=true` with this one.** |
| `new_player` | Fresh save. 50 dust, only command room. Zero progress. |
| `post_tutorial` | Just finished onboarding. 5 facts, 180 dust, 2 shards, 1 dive, 2 rooms. |
| `workshop_unlocked` | 3 dives, 3 rooms (command/lab/workshop), 450 dust, 12 shards, 8 facts. Workshop just accessible. |

### Mid-Game
| Preset | Description |
|--------|-------------|
| `mid_dive` | Mid-game player with active trilobite companion, 15 facts, 800 dust, 3 rooms. |
| `mid_dive_active` | Same as `mid_dive` but targets **DivePrepScreen** directly (`targetScreen: 'divePrepScreen'`). |
| `first_pet` | First fossil (trilobite) revived. 10 facts, 600 dust, 15 shards, companion active. |
| `first_fossil_found` | 1 trilobite fragment found (not yet revived). 8 facts, 350 dust. |
| `mid_game_3_rooms` | 25 facts, 2400 dust, 80 shards, 15 crystals, 4 rooms (incl. museum), 240 KP. |
| `just_crafted` | 15 dives, reinforced_tank crafted, bomb_kit active consumable. Tests crafting state. |

### Late-Game
| Preset | Description |
|--------|-------------|
| `five_rooms` | 20 dives, 40 facts, 6 rooms, trilobite on farm, ammonite partial, streak 12. |
| `endgame_all_rooms` | 80 facts, 18K dust, all rooms unlocked, 2800 KP, titles, premium materials. |
| `full_collection` | All fossils revived, 120 facts, all discs, max resources, cosmetics. |
| `rich_player` | Max resources (99,999 dust, 5K shards, etc.), 10K KP, all rooms, 50 dives. |
| `max_streak` | 100-day streak, all milestones claimed, all rooms unlocked. Last dive yesterday. |

### Edge Cases
| Preset | Description |
|--------|-------------|
| `empty_inventory` | 40 facts but 0 oxygen, 0 minerals. Tests scarcity/stressed UI states. |
| `streak_about_to_break` | 14-day streak, last dive 2 days ago, 0 freezes. Streak about to break. |
| `many_reviews_due` | 50 facts ALL overdue by 2 days. Tests heavy review/quiz load. |
| `quiz_due` | 30 facts with overdue reviews. Tests quiz prompts and study screen. |

### Screen-Specific
| Preset | Target Screen | Description |
|--------|---------------|-------------|
| `dive_results` | `diveResults` | Just finished a dive. Lands on DiveResults screen. |
| `mid_dive_active` | `divePrepScreen` | Mid-game player. Lands on DivePrepScreen. |

Always include `?skipOnboarding=true&` before `devpreset=` for all presets except `first_boot`.

## Creating Custom Presets On-The-Fly

When testing a specific scenario not covered by the 20 built-in presets, you can quickly create a temporary preset in `src/dev/presets.ts`.

### The Pattern

1. Open `src/dev/presets.ts`
2. Add a new entry to the `SCENARIO_PRESETS` array
3. Spread an existing preset's `buildSave` output via `BASE_SAVE(now)`, then override only the fields you need
4. Navigate with `?skipOnboarding=true&devpreset=your_custom_id`
5. **Clean up after testing** -- do not commit throwaway presets

### Example: Testing 0 Oxygen with High Minerals

To test what happens with 0 oxygen and high minerals, copy any existing preset and override just the fields you need:

```typescript
{
  id: 'my_custom_test',
  label: 'Custom Test',
  description: 'Temporary test preset',
  buildSave(now) {
    return {
      ...BASE_SAVE(now),
      tutorialComplete: true,
      diveCount: 5,
      selectedInterests: ['Generalist'],
      ownedPickaxes: ['standard_pick'],
      // Override whatever you need:
      oxygen: 0,
      minerals: { dust: 99999, shard: 0, crystal: 0, geode: 0, essence: 0 },
    }
  },
}
```

### Setting a Target Screen

Any preset can include `targetScreen` to navigate directly to a specific screen after loading:

```typescript
{
  id: 'my_custom_test',
  label: 'Custom Test',
  description: 'Temporary test preset',
  targetScreen: 'divePrepScreen',  // or 'diveResults', 'base', etc.
  buildSave(now) { /* ... */ },
}
```

Valid screen values are defined by the `Screen` type in `src/ui/stores/gameState.ts`.

### Runtime Navigation Without Reload

To change screens at runtime without reloading the page, use the runtime store trick in a Playwright `browser_evaluate` call:

```javascript
globalThis[Symbol.for('terra:currentScreen')].set('divePrepScreen')
```

This sets the Svelte store directly, avoiding a full page reload. Useful for quickly jumping between screens during an interactive debugging session.

### Cleanup Reminder

Temporary presets are throwaway -- always remove them from `src/dev/presets.ts` after testing. Do not commit custom test presets to the repository.
