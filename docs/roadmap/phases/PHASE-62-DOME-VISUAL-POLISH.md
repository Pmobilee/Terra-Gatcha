# Phase 62: Dome Visual Polish

## Overview

**Goal:** Fix four visual issues in the dome hub: green placeholder rectangles instead of sprites, mid-word label truncation, emoji resource icons in HubView, and truncated floor navigation label.

**Priority:** HIGH

**Dependencies:** All prior phases (0-59) complete. DomeScene, domeManifest, HubView, FloorIndicator already exist.

**Estimated Complexity:** Medium -- touches Phaser sprite loading, Phaser text rendering, Svelte HUD component, and Svelte floor indicator component.

**Findings Reference:** H1 (green placeholder tiles), H2 (label truncation), M1 (emoji resource icons), M2 (floor nav label truncated)

---

## Tech Stack

- **Frontend:** Svelte 5 + TypeScript (strict), Vite 7, Phaser 3
- **Dome Scene:** `src/game/scenes/DomeScene.ts` -- Phaser scene rendering the dome hub
- **Dome Manifest:** `src/game/domeManifest.ts` -- sprite key list, URL map builder
- **Sprite Keys:** `src/data/spriteKeys.ts` -- `DOME_SPRITE_KEYS` constant array
- **Sprite Assets:** `public/assets/sprites/dome/` (32px), `public/assets/sprites-hires/dome/` (256px)
- **Sprite Loading:** `DomeScene.preload()` lines 154-184 loads from `/assets/sprites-hires/dome/{spriteKey}.png`
- **Resource Bar (DomeView):** `src/ui/components/DomeView.svelte` lines 92-120 -- already uses pixel art `<img>` icons
- **Resource Bar (HubView):** `src/ui/components/HubView.svelte` lines 265-271 -- still uses Unicode emoji
- **Floor Indicator:** `src/ui/components/FloorIndicator.svelte` -- floor dots + label
- **Floor Data:** `src/data/hubFloors.ts` -- floor definitions (name: "Starter Hub" at line 46)
- **Hub Layout:** `src/data/hubLayout.ts` -- `HubFloor` type, tile/grid constants
- **Resource Icons:** `public/assets/sprites/icons/icon_crystal.png`, `icon_dust.png`, `icon_essence.png`, `icon_flame.png`, `icon_geode.png`, `icon_oxygen.png`, `icon_shard.png`
- **Typecheck:** `npm run typecheck` -- must remain at 0 errors

---

## Sub-steps

### 62.1 -- Fix dome sprite rendering (green rectangles to actual sprites)

**Problem:** All dome objects render as solid green rectangles with text labels. The fallback path at `DomeScene.ts` lines 582-607 fires because `this.textures.exists(obj.spriteKey)` returns false. Sprites either fail to load in `preload()`, or sprite keys in `hubFloors.ts` do not match the PNG filenames in `public/assets/sprites-hires/dome/`.

**Investigation Steps:**
1. Read `src/data/hubFloors.ts` -- collect every `spriteKey` value assigned to floor objects
2. Read `src/data/spriteKeys.ts` -- check `DOME_SPRITE_KEYS` array
3. List files in `public/assets/sprites-hires/dome/` -- get actual PNG filenames on disk
4. Cross-reference: every `spriteKey` used in hubFloors must (a) exist in `DOME_SPRITE_KEYS`, (b) have a matching `{spriteKey}.png` file on disk, and (c) be collected by the `preload()` loop at lines 157-163
5. Check if `preload()` is actually called -- verify that the Phaser scene lifecycle is wired correctly (scene is started, not just added)

**Common Failure Modes:**
- **Key mismatch:** `hubFloors.ts` uses a spriteKey like `obj_gaia` but the file is named `obj_gaia_terminal.png`
- **Missing from preload set:** `preload()` only collects keys from `floor.objects[].spriteKey`, but some keys may be undefined/null
- **File not on disk:** The PNG file does not exist at the expected path
- **Phaser load error:** The HTTP request for the PNG returns 404 (check browser console for Phaser load warnings)
- **BASE_URL mismatch:** `domeManifest.ts` uses `import.meta.env.BASE_URL` but `preload()` hardcodes `/assets/sprites-hires/dome/`

**Fix Requirements:**
- Ensure every spriteKey in hubFloors objects has a matching PNG file in `public/assets/sprites-hires/dome/`
- Ensure `preload()` collects ALL spriteKeys that will be rendered
- If any PNG files are missing, either generate them or add graceful fallback with visible debug warning
- Add a dev-mode console warning when a sprite fails to load, so future issues are caught immediately

**Files to Modify:**
- `src/game/scenes/DomeScene.ts` -- fix preload() if needed, add load error logging
- `src/data/hubFloors.ts` -- fix spriteKey values if they don't match filenames
- `src/data/spriteKeys.ts` -- add any missing keys

**Acceptance Criteria:**
- All 7+ dome objects (GAIA terminal, workbench, bookshelf, display case, market stall, dive hatch, knowledge tree, etc.) show unique pixel art sprites
- No green/teal placeholder rectangles visible
- Browser console shows no Phaser texture load errors

---

### 62.2 -- Fix tile label text (no mid-word breaks)

**Problem:** Object labels like "Artifact Lab", "Materializer", "Streak Board" render with mid-word breaks ("Artifac t Lab", "Materializ er", "Stre ak Board") due to Phaser's `wordWrap` with `useAdvancedWrap: true` at `DomeScene.ts` line 604.

**Root Cause:** Phaser's `useAdvancedWrap` breaks words at any character boundary when the wrap width is too narrow. With `FLOOR_TILE_SIZE` of 4px and typical object widths of 3-5 tiles (12-20px), the wrap width (`w - 4`) is only 8-16px -- far too narrow for any word.

**Fix Approach:**
1. Use short, pre-defined display labels that fit without wrapping. Define a label map in DomeScene or domeManifest.
2. Alternatively, increase label area or use single-word abbreviations.

**Recommended Short Labels Map:**
```typescript
const SHORT_LABELS: Record<string, string> = {
  'gaia_terminal': 'GAIA',
  'workbench': 'Craft',
  'bookshelf': 'Study',
  'display_case': 'Lab',
  'market_stall': 'Shop',
  'dive_hatch': 'Mine',
  'knowledge_tree': 'Tree',
  'streak_board': 'Streak',
  'fossil_display': 'Fossil',
  'farm_plot': 'Farm',
  'feeding_station': 'Zoo',
  'seed_station': 'Seeds',
  'premium_workbench': 'P.Craft',
  'upgrade_anvil': 'Upgrade',
  'blueprint_board': 'Plans',
  'achievement_wall': 'Awards',
  'cosmetics_vendor': 'Style',
  'wallpaper_kiosk': 'Decor',
  'data_disc_reader': 'Discs',
  'experiment_bench': 'Exper.',
  'gaia_report': 'Report',
  'study_alcove': 'Study',
  'telescope': 'Scope',
  'streak_shrine': 'Shrine',
  'star_map': 'Stars',
  'fossil_tank': 'Tank',
  'gallery_frame': 'Gallery',
}
```

**Note:** Labels only render for the fallback rectangle path (line 594-606). If 62.1 is fixed and all sprites load, these labels will not be visible. Still fix them as a safety net for any future sprite load failures.

**Fix Location:** `DomeScene.ts` lines 595-605

**Changes:**
- Replace `useAdvancedWrap: true` with `wordWrap: { width: w * 2 }` (wider) or remove word wrap entirely for short labels
- Use the short label map instead of `getEffectiveLabel()` for the fallback text
- Reduce font size to 8px if needed for fitting
- Alternatively: disable word wrap, set `maxLines: 1`, and let the truncation ellipsis handle overflow

**Files to Modify:**
- `src/game/scenes/DomeScene.ts` -- label rendering section (lines 594-606)

**Acceptance Criteria:**
- No mid-word breaks in any dome object label
- All labels are fully readable (either abbreviated or properly wrapped at word boundaries)
- Labels fit within their object bounds

---

### 62.3 -- Replace emoji resource icons with pixel art PNGs in HubView

**Problem:** `src/ui/components/HubView.svelte` lines 265-271 uses Unicode emoji for resource display:
```svelte
<span class="res">diamond-emoji {$playerSave.minerals.dust}</span>
<span class="res">blue-diamond-emoji {$playerSave.minerals.shard}</span>
<span class="res">diamond-with-dot-emoji {$playerSave.minerals.crystal}</span>
<span class="res">bubble-emoji {$playerSave.oxygen} O2</span>
```

Meanwhile, `DomeView.svelte` already correctly uses `<img>` tags with pixel art icon PNGs (lines 10-16, 97-99).

**Fix:** Replace the emoji spans in HubView with the same `<img>` + `<span>` pattern used in DomeView.

**Steps:**
1. In `HubView.svelte`, add icon path constants at the top of the `<script>` block (same as DomeView lines 10-16):
   ```typescript
   const iconOxygen = '/assets/sprites/icons/icon_oxygen.png'
   const iconDust = '/assets/sprites/icons/icon_dust.png'
   const iconShard = '/assets/sprites/icons/icon_shard.png'
   const iconCrystal = '/assets/sprites/icons/icon_crystal.png'
   ```
2. Replace the emoji spans (lines 267-270) with:
   ```svelte
   <span class="res">
     <img class="res-icon" src={iconDust} alt="Dust" />
     {$playerSave.minerals.dust}
   </span>
   <span class="res">
     <img class="res-icon" src={iconShard} alt="Shard" />
     {$playerSave.minerals.shard}
   </span>
   <span class="res">
     <img class="res-icon" src={iconCrystal} alt="Crystal" />
     {$playerSave.minerals.crystal}
   </span>
   <span class="res">
     <img class="res-icon" src={iconOxygen} alt="O2" />
     {$playerSave.oxygen}
   </span>
   ```
3. Add CSS for `.res-icon` (inline icon sizing):
   ```css
   .res-icon {
     width: 16px;
     height: 16px;
     vertical-align: middle;
     image-rendering: pixelated;
     margin-right: 2px;
   }
   ```
4. Also search for any OTHER emoji-based resource displays across the codebase (`FloorUpgradePanel.svelte`, `UnlockConfirmModal.svelte`, `LockedFloorPreview.svelte`, etc.) and replace them with the same pattern.

**Files to Modify:**
- `src/ui/components/HubView.svelte` -- primary fix
- Any other Svelte files using emoji for dust/shard/crystal/O2 display (search results from grep)

**Acceptance Criteria:**
- HubView resource bar shows pixel art icons (not emoji) for all resource types
- Icons render at consistent size (16px), pixelated style, vertically aligned with text
- No emoji characters remain for resource display in any component

---

### 62.4 -- Fix floor navigation label truncation

**Problem:** In `FloorIndicator.svelte`, the floor label "Starter Hub" is truncated to "Starter H..." because of `max-width: 80px` with `overflow: hidden; text-overflow: ellipsis` (line 61-63). The 8px "Press Start 2P" font is wide, so "Starter Hub" exceeds 80px.

**Fix Options (choose one):**
1. **Increase max-width** to 120px to accommodate longer floor names
2. **Use shorter display names** in `hubFloors.ts` (e.g., "Starter" instead of "Starter Hub", "Lab" instead of "Research Lab")
3. **Remove the max-width constraint** and let the label size naturally, since it's positioned at `right: 8px` with limited content

**Recommended:** Option 1 (increase max-width to 120px). This is the simplest fix and accommodates all current floor names.

**Additional Fix:** The floor dots (pips) should be positioned clearly below the label, not overlapping. Check if the `gap: 4px` in `.floor-indicator` is sufficient. If dots overlap the label on small screens, increase gap to 8px.

**Steps:**
1. In `FloorIndicator.svelte`, change `.floor-label` `max-width` from `80px` to `120px`
2. Verify all floor names from `hubFloors.ts` fit within the new width
3. If any names still truncate, either shorten the name in `hubFloors.ts` or increase max-width further
4. Confirm dots do not overlap the label -- adjust gap if needed

**Files to Modify:**
- `src/ui/components/FloorIndicator.svelte` -- CSS adjustment
- `src/data/hubFloors.ts` -- only if names need shortening (optional)

**Acceptance Criteria:**
- "Starter Hub" (and all other floor names) is fully visible without truncation
- Floor dots are positioned below the label with clear separation
- Layout does not overflow or break on mobile viewport widths (360px minimum)

---

## Verification Gate

All of the following MUST pass before Phase 62 is marked complete:

1. **Typecheck:** `npm run typecheck` -- 0 errors
2. **Build:** `npm run build` -- succeeds without errors
3. **Unit Tests:** `npx vitest run` -- all tests pass
4. **Visual Verification (Playwright):**
   - Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
   - Take screenshot of dome/base screen
   - Verify: all dome objects show pixel art sprites (no green rectangles)
   - Verify: all fallback labels (if any) are readable without mid-word breaks
   - Verify: resource bar shows pixel art icons (no emoji)
   - Verify: floor label "Starter Hub" is fully visible
   - Verify: floor dots are below the label, not overlapping
5. **Console Check:** `browser_console_messages` -- no Phaser texture load errors, no new JS errors

**Playwright Test Script:**
```javascript
// tests/e2e/04-dome-visual-polish.cjs
const { chromium } = require('playwright')

async function run() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

  // Navigate to dome
  await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial')
  await page.waitForTimeout(3000)

  // Screenshot dome state
  await page.screenshot({ path: 'dome-visual-polish.png', fullPage: false })

  // Check for Phaser load errors in console
  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('Failed to load')) {
      errors.push(msg.text())
    }
  })

  // Verify no emoji in resource bar
  const resourceBar = await page.locator('.hub-resource-bar, .resource-bar').first()
  if (resourceBar) {
    const html = await resourceBar.innerHTML()
    const hasEmoji = /[\u{1F300}-\u{1FAD6}]/u.test(html)
    console.log(`Resource bar emoji check: ${hasEmoji ? 'FAIL - emoji found' : 'PASS'}`)
  }

  // Verify floor label not truncated
  const floorLabel = await page.locator('.floor-label').first()
  if (floorLabel) {
    const text = await floorLabel.textContent()
    console.log(`Floor label: "${text}" -- ${text?.includes('...') ? 'FAIL - truncated' : 'PASS'}`)
  }

  // Verify resource icon images load
  const iconImgs = await page.locator('.res-icon, .res-icon-img').all()
  console.log(`Resource icon images found: ${iconImgs.length}`)

  if (errors.length > 0) {
    console.log('Console errors:', errors)
  }

  await browser.close()
  console.log('Dome visual polish verification complete.')
}

run().catch(console.error)
```

---

## Files Affected

| File | Change Type | Description |
|------|------------|-------------|
| `src/game/scenes/DomeScene.ts` | Modify | Fix preload() sprite loading, add load error logging, fix label word wrap |
| `src/data/hubFloors.ts` | Modify (if needed) | Fix spriteKey values to match actual PNG filenames |
| `src/data/spriteKeys.ts` | Modify (if needed) | Add any missing sprite keys |
| `src/ui/components/HubView.svelte` | Modify | Replace emoji with `<img>` pixel art icons |
| `src/ui/components/FloorIndicator.svelte` | Modify | Increase max-width for floor label |
| `src/game/domeManifest.ts` | Modify (if needed) | Fix URL map if BASE_URL mismatch found |
| Other Svelte files with emoji resources | Modify (if needed) | Replace emoji with icon PNGs |
