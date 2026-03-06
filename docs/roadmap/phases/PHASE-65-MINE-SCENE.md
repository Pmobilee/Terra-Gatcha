# Phase 65: Mine Scene Improvements

**Status**: Not Started
**Priority**: MEDIUM
**Dependencies**: All prior phases complete (0-59). Core mine rendering, animation, and DevPanel systems are stable.
**Estimated Complexity**: Low-Medium — 3 focused sub-steps, no new systems, minimal refactoring
**Findings**: H3 (~48 missing sprite frame warnings), M11 (blocks hard to distinguish), H8 (DEV button overlaps UI)

---

## Tech Stack

- **Frontend**: Svelte 5 + TypeScript (strict), Vite 7, Phaser 3
- **Mine Scene**: `src/game/scenes/MineScene.ts` — main mine Phaser scene
- **Tile Renderer**: `src/game/scenes/MineTileRenderer.ts` — renders blocks, fog of war, overlays
- **Block Interactor**: `src/game/scenes/MineBlockInteractor.ts` — handles block interactions
- **Animation System**: `src/game/systems/AnimationSystem.ts` — `MinerAnimController` and `ANIM_CONFIGS`
- **DEV Panel**: `src/ui/components/DevPanel.svelte` — developer overlay component
- **Typecheck**: `npm run typecheck` — must remain at 0 errors

---

## Overview

This phase addresses three playtest findings that affect mine usability and developer experience:

1. **H3**: Phaser logs ~48 "Frame not found in texture" warnings because the animation system defines 52 frames (indices 0-51) but the actual miner sprite sheet has fewer frames. The `registerAnims()` method in `AnimationSystem.ts` already clamps frame ranges to the actual texture size, but the clamping emits Phaser-internal warnings when `generateFrameNumbers()` is called with out-of-range frames.

2. **M11**: The mine grid lacks visual contrast — the bottom half appears entirely dark, the top half is uniform beige, and block types (hazards, special blocks, fog edges) are hard to distinguish from regular terrain.

3. **H8**: The DEV button (fixed at `top: 4px; right: 4px`) overlaps functional UI elements on multiple screens (Skip button during backstory, Show All on Knowledge Tree, minimap in mine).

---

## Prerequisites

Before starting Phase 65, verify ALL of the following are true:

1. `npm run typecheck` passes with zero errors
2. `npm run build` produces a successful bundle
3. Mine scene loads and renders blocks (navigate to mine via DevPanel or devpreset)
4. DevPanel toggle button is visible at top-right corner

---

## Sub-Step 65.1: Fix Miner Animation Frame Range Warnings

### What

Eliminate all "Frame not found in texture" Phaser console warnings that appear when the mine scene loads. The root cause is in `src/game/systems/AnimationSystem.ts` where `ANIM_CONFIGS` defines 11 animation strips spanning frames 0-51 (52 total frames), but the actual `miner_sheet` spritesheet typically has only 4 frames (idle only).

### Current Behavior

The `registerAnims()` method (line ~173) already handles this partially:
- If `cfg.startFrame >= totalFrames`, it falls back to a single-frame animation using frame 0
- If the animation partially fits, it clamps `endFrame` to `totalFrames - 1`

However, `scene.anims.generateFrameNumbers()` itself logs warnings for any frame index that doesn't exist in the texture, even when the caller intends to clamp. The warnings come from Phaser's internal frame lookup.

### Where

- **Modify**: `src/game/systems/AnimationSystem.ts` — `MinerAnimController.registerAnims()` method (line ~173)

### How

1. Before calling `scene.anims.generateFrameNumbers()`, validate that `cfg.startFrame < totalFrames` (already done) AND that the generated frame range is valid
2. When `endFrame` would be clamped (i.e., `cfg.startFrame + cfg.frameCount - 1 > totalFrames - 1`), only generate frames in the valid range `[cfg.startFrame, totalFrames - 1]`
3. If only 1 frame is available for an animation that expects multiple, use `{ start: cfg.startFrame, end: cfg.startFrame }` to avoid any out-of-range lookups
4. Add a single `console.info` at the end of `registerAnims()` logging how many animations were registered vs. how many fell back, e.g.: `[MinerAnim] Registered 3/11 animations (8 fallback to frame 0)` — this replaces ~48 individual Phaser warnings with one clean summary line
5. Suppress Phaser's internal frame warnings by only requesting frames that are known to exist. The key fix: build the frames array manually instead of using `generateFrameNumbers()` when the sprite sheet is undersized:

```typescript
// Instead of:
const frames = scene.anims.generateFrameNumbers('miner_sheet', { start: cfg.startFrame, end: endFrame })

// Use manual frame construction when we know the sheet is undersized:
if (totalFrames < 52) {
  // Build frames manually to avoid Phaser's internal "frame not found" warnings
  const validFrames: Phaser.Types.Animations.AnimationFrame[] = []
  for (let i = cfg.startFrame; i <= endFrame; i++) {
    if (i < totalFrames) {
      validFrames.push({ key: 'miner_sheet', frame: i })
    }
  }
  if (validFrames.length === 0) {
    validFrames.push({ key: 'miner_sheet', frame: 0 })
  }
  // use validFrames instead of generateFrameNumbers result
}
```

### Acceptance Criteria

- [ ] Zero "Frame not found in texture" warnings in browser console when mine scene loads
- [ ] All 11 animation states (`idle`, `walk_down`, `walk_up`, `walk_left`, `walk_right`, `mine_down`, `mine_left`, `mine_right`, `hurt`, `fall`) are registered without errors
- [ ] Animations that reference frames beyond the spritesheet gracefully fall back to frame 0
- [ ] One summary `console.info` line replaces the ~48 individual warnings
- [ ] `npm run typecheck` — 0 errors
- [ ] Miner character still renders and moves correctly in-game

### Playwright Verification

```javascript
// Navigate to mine, check console for frame warnings
// 1. Navigate with devpreset
await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=mid_dive_active')
await page.waitForTimeout(3000)

// 2. Check console messages for frame warnings
const messages = await page.evaluate(() => window.__terraLog?.filter(e => e.type === 'console') ?? [])
const frameWarnings = messages.filter(m => m.detail?.includes?.('Frame not found'))
console.assert(frameWarnings.length === 0, `Expected 0 frame warnings, got ${frameWarnings.length}`)

// 3. Check for the summary info line
const consoleMessages = await page.evaluate(() => {
  // Check via browser console capture
  return window.__terraLog?.filter(e => e.detail?.includes?.('MinerAnim')) ?? []
})
console.assert(consoleMessages.length >= 1, 'Expected MinerAnim summary log')
```

---

## Sub-Step 65.2: Improve Mine Block Visual Contrast

### What

Make different block types, hazards, fog edges, and special tiles visually distinguishable in the mine grid. Currently the mine appears as uniform beige (top) and uniform black (bottom) with little differentiation between block types.

### Current Behavior

- `MineTileRenderer.ts` renders blocks via `drawBlockPattern()` (line ~122) which uses sprite-based rendering with biome tile textures
- Fog of war has three states: hidden (solid biome fog color), Ring 1 (dimmed sprite), Ring 2 (heavily dimmed sprite)
- Hazard blocks (LavaBlock, GasPocket) already have scanner-based hints (line ~486) but only when scanner is active
- The `BLOCK_COLORS` fallback map (line ~19) provides per-type colors but these are only used when sprites are missing
- Depth overlay (`drawDepthOverlay`, line ~91) darkens everything uniformly with depth

### Where

- **Modify**: `src/game/scenes/MineTileRenderer.ts` — `renderVisibleTiles()`, `drawBlockPattern()`, fog rendering

### How

Keep changes minimal and targeted. Four improvements:

#### 65.2.1 — Per-block brightness variation

In the main render loop (`renderVisibleTiles`, around line 543 where revealed non-empty blocks are drawn), add subtle per-tile brightness noise:

```typescript
// After drawing the base block color/sprite:
const noise = seededModulo(x, y, 42, 7) - 3  // range: -3 to +3
if (noise !== 0) {
  // Apply brightness variation: dark overlay for negative, light for positive
  if (noise < 0) {
    scene.overlayGraphics.fillStyle(0x000000, Math.abs(noise) * 0.02)
  } else {
    scene.overlayGraphics.fillStyle(0xffffff, noise * 0.015)
  }
  scene.overlayGraphics.fillRect(px, py, TILE_SIZE, TILE_SIZE)
}
```

Use the existing `seededModulo()` helper (line ~60) so variation is deterministic per-tile (no flicker on re-render).

#### 65.2.2 — Fog of war gradient edges

Where a revealed cell is adjacent to an unrevealed cell, draw a semi-transparent dark gradient strip on the revealed cell's edge facing the fog. This creates a soft transition instead of a hard binary edge.

Add a new function `drawFogEdgeGradients()` called after the main render loop:

```typescript
export function drawFogEdgeGradients(scene: MineScene): void {
  // For each revealed cell, check 4 cardinal neighbors
  // If neighbor is unrevealed, draw a semi-transparent dark strip (4px wide) on the edge facing the fog
  // Alpha: 0.15 on the edge pixel, fading to 0 over 4px
  // Use scene.overlayGraphics for the strips
}
```

The gradient should be 4 pixels wide (for 32px tiles, that's ~12% of the tile). Use 3 overlapping rectangles with decreasing alpha (0.12, 0.08, 0.04) to simulate a gradient without requiring actual gradient fills (Phaser Graphics API doesn't support linear gradients natively).

#### 65.2.3 — Hazard block tinting (always visible, not just with scanner)

Currently hazard coloring only appears when the scanner upgrade is active. Add always-visible tinting for revealed hazard blocks:

In `drawBlockPattern()` or immediately after it in the render loop, for revealed cells:
- `BlockType.LavaBlock`: apply `scene.overlayGraphics.fillStyle(0xff4400, 0.15)` over the tile
- `BlockType.GasPocket`: apply `scene.overlayGraphics.fillStyle(0x44ff44, 0.12)` over the tile
- `BlockType.UnstableGround`: apply `scene.overlayGraphics.fillStyle(0xffaa00, 0.10)` over the tile

This is a subtle tint on top of the existing block sprite, making hazards recognizable at a glance even without a scanner.

#### 65.2.4 — Special block shimmer/glow (revealed blocks only)

For revealed special blocks, add a pulsing colored border to make them stand out:

```typescript
// After drawBlockPattern() for revealed cells:
const shimmerPhase = 0.5 + 0.5 * Math.sin(scene.time.now / 800 + x * 0.3 + y * 0.7)

switch (cell.type) {
  case BlockType.ArtifactNode:
    scene.overlayGraphics.lineStyle(2, 0xe94560, 0.4 + 0.3 * shimmerPhase)
    scene.overlayGraphics.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2)
    break
  case BlockType.RelicShrine:
    scene.overlayGraphics.lineStyle(2, 0xd4af37, 0.4 + 0.3 * shimmerPhase)
    scene.overlayGraphics.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2)
    break
  case BlockType.DescentShaft:
    scene.overlayGraphics.lineStyle(2, 0x6633cc, 0.5 + 0.3 * shimmerPhase)
    scene.overlayGraphics.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2)
    break
  case BlockType.DataDisc:
    scene.overlayGraphics.lineStyle(1, 0x22aacc, 0.3 + 0.2 * shimmerPhase)
    scene.overlayGraphics.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2)
    break
}
```

### Performance Notes

- Brightness noise uses existing `seededModulo()` — zero allocation, deterministic
- Fog edge gradients: only iterate revealed cells adjacent to fog edges (not all cells)
- Hazard tints: simple fillRect overlay, negligible cost
- Shimmer: only for special blocks (~5-10 per viewport), pulsing via `Math.sin(scene.time.now)` is cheap
- All overlays use `scene.overlayGraphics` which is already cleared and redrawn each frame

### Acceptance Criteria

- [ ] Adjacent blocks have subtle brightness variation (not uniform color)
- [ ] Fog of war edges show a soft gradient (not a hard binary cut)
- [ ] Lava blocks have visible orange/red tint when revealed
- [ ] Gas pockets have visible green tint when revealed
- [ ] Artifact nodes, relic shrines, and descent shafts have pulsing colored borders when revealed
- [ ] No performance regression: FPS stays above 55 in DevPanel perf overlay
- [ ] `npm run typecheck` — 0 errors
- [ ] Existing scanner-based hints (Ring 1 visibility) still work correctly

### Playwright Verification

```javascript
// Navigate to mine, take screenshot to verify visual contrast
await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=mid_dive_active')
await page.waitForTimeout(3000)

// Take screenshot for visual inspection
await page.screenshot({ path: 'mine-visual-contrast.png', fullPage: false })

// Verify no JS errors
const errors = await page.evaluate(() => window.__terraLog?.filter(e => e.type === 'error') ?? [])
console.assert(errors.length === 0, `Expected 0 errors, got ${errors.length}`)

// Verify FPS is acceptable via debug bridge
const debug = await page.evaluate(() => (window as any).__terraDebug?.())
if (debug?.phaser?.fps) {
  console.assert(debug.phaser.fps >= 30, `FPS too low: ${debug.phaser.fps}`)
}
```

---

## Sub-Step 65.3: Fix DEV Button Positioning

### What

Reposition the DEV button so it never overlaps functional UI elements (Skip button, Show All, minimap, etc.) on any screen. Make it smaller, semi-transparent, and hidden in production builds.

### Current Behavior

The DEV toggle button in `src/ui/components/DevPanel.svelte` (line ~497, styles at line ~921) is positioned at:
```css
.dev-toggle {
  position: fixed;
  top: 4px;
  right: 4px;
  z-index: 9999;
  /* ... */
  padding: 4px 8px;
  opacity: 0.6;
}
```

This overlaps with:
- **Backstory screen**: Skip button (top-right)
- **Knowledge Tree**: "Show All" button (top-right area)
- **Mine scene**: Minimap overlay (top-right)

### Where

- **Modify**: `src/ui/components/DevPanel.svelte` — CSS for `.dev-toggle` class (line ~921) and template (line ~497)

### How

1. **Move to bottom-left**: Change position from `top: 4px; right: 4px` to `bottom: 4px; left: 4px`. Bottom-left is the least-used UI corner across all screens.

2. **Reduce size**: Make the button smaller — `padding: 2px 6px`, `font-size: 8px`, dimensions approximately 24px x 16px.

3. **Increase transparency**: Set `opacity: 0.35` (default), `opacity: 0.9` on hover. This makes it nearly invisible until needed.

4. **Hide in production**: Add a production guard in the template. Wrap the entire component output in a dev-only check:

```svelte
{#if !import.meta.env.PROD}
  <button class="dev-toggle" ...>DEV</button>
  {#if open}
    <!-- backdrop + panel -->
  {/if}
{/if}
```

Alternatively, if the component is already conditionally rendered by its parent, add the `PROD` check at the import site in `src/App.svelte` or wherever `<DevPanel />` is mounted.

5. **Keep z-index**: Maintain `z-index: 9999` so it stays on top of all game content when hovered/clicked.

### Acceptance Criteria

- [ ] DEV button is positioned at bottom-left corner (`bottom: 4px; left: 4px`)
- [ ] DEV button is smaller (approx 24px wide, 16px tall)
- [ ] DEV button is semi-transparent (35% opacity default, 90% on hover)
- [ ] DEV button does NOT overlap Skip button on backstory screen
- [ ] DEV button does NOT overlap Show All on Knowledge Tree
- [ ] DEV button does NOT overlap minimap in mine
- [ ] In production builds (`import.meta.env.PROD === true`), DEV button is not rendered at all
- [ ] DEV panel still opens/closes correctly when button is clicked
- [ ] All DevPanel functionality (presets, snapshots, resources, navigation) still works
- [ ] `npm run typecheck` — 0 errors

### Playwright Verification

```javascript
// Test 1: DEV button position
await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial')
await page.waitForTimeout(2000)

const devBtn = page.locator('.dev-toggle')
const box = await devBtn.boundingBox()
console.assert(box.y > 500, `DEV button should be at bottom, y=${box.y}`)
console.assert(box.x < 100, `DEV button should be at left, x=${box.x}`)

// Test 2: No overlap with minimap in mine
await page.goto('http://localhost:5173?skipOnboarding=true&devpreset=mid_dive_active')
await page.waitForTimeout(3000)
await page.screenshot({ path: 'dev-button-mine.png' })

// Test 3: Panel still works
await devBtn.click()
await page.waitForTimeout(500)
const panel = page.locator('.dev-panel')
await expect(panel).toBeVisible()
```

---

## Files Affected

| File | Change Type | Description |
|------|-------------|-------------|
| `src/game/systems/AnimationSystem.ts` | Modify | Fix `registerAnims()` to avoid frame warnings |
| `src/game/scenes/MineTileRenderer.ts` | Modify | Add brightness noise, fog gradients, hazard tints, special block shimmer |
| `src/ui/components/DevPanel.svelte` | Modify | Reposition button to bottom-left, reduce size, add prod guard |

---

## Verification Gate

All of the following MUST pass before this phase is marked complete:

1. [ ] `npm run typecheck` — 0 errors
2. [ ] `npm run build` — succeeds without errors
3. [ ] `npx vitest run` — all existing tests pass
4. [ ] Enter mine scene via devpreset `mid_dive_active` — 0 "Frame not found" warnings in console
5. [ ] Mine blocks are visually distinguishable: brightness variation visible, hazard tints visible, special block borders pulsing
6. [ ] Fog of war edges have gradient transition (not hard binary cut)
7. [ ] DEV button positioned at bottom-left, does not overlap any functional UI on base, mine, or knowledge tree screens
8. [ ] DEV button is not visible in production build (`npm run build && npx serve dist`)
9. [ ] DEV panel opens and all sections function correctly after repositioning
10. [ ] FPS remains above 55 in mine scene (check via DevPanel debug section)
11. [ ] Screenshot verification of mine scene shows clear visual improvement over current state
