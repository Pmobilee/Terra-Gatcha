# Terra Miner — Theme-Agnostic Sprite & Asset Size Specification

## For: ComfyUI Workflow Creation
## Version: 1.1 — March 2026

---

## Rendering Context

**Virtual resolution:** 270×600px (portrait, 9:20 aspect ratio)
**Scale factor:** 4x nearest-neighbor to 1080×2400 device pixels
**File format:** PNG with transparency (RGBA)
**Palette:** Constrained 32-64 color palette recommended
**Animation format:** Horizontal spritesheets (frames side by side)

All dimensions below are in **virtual pixels** (the pixel art grid). Multiply by 4 for device pixel output.

---

## 1. BACKGROUNDS

Static, full-screen, no scrolling.

| Type | Virtual Size | Device Size | Quantity Needed |
|------|-------------|-------------|-----------------|
| Combat background | 270×600 | 1080×2400 | 4-5 themed variants (1 for prototype) |
| Title screen | 270×600 | 1080×2400 | 1 |
| Room/path selection screen | 270×600 | 1080×2400 | 1 |
| Shop screen | 270×600 | 1080×2400 | 1 |
| Rest area screen | 270×600 | 1080×2400 | 1 |
| Post-run summary screen | 270×600 | 1080×2400 | 1 |
| Collection/library screen | 270×600 | 1080×2400 | 1 |

**Design note:** Top ~55% of combat backgrounds is visible during gameplay. Bottom 45% is covered by card hand and UI. Place focal point in upper-center where enemies stand.

**Prototype needs:** 3 backgrounds (1 combat, 1 title, 1 room selection).

---

## 2. PLAYER CHARACTER

Positioned in lower portion of the display zone, above the card hand area. Small relative to enemies.

| Animation State | Frame Size | Frame Count | Spritesheet Size |
|----------------|-----------|-------------|-----------------|
| Idle (breathing loop) | 32×48 | 4 | 128×48 |
| Hit/damage reaction | 32×48 | 3 | 96×48 |
| Attack/action | 32×48 | 4 | 128×48 |
| Heal received | 32×48 | 3 | 96×48 |
| Shield/block | 32×48 | 3 | 96×48 |
| Death/defeat | 32×48 | 5 | 160×48 |
| Victory/celebration | 32×48 | 4 | 128×48 |

**Total: 7 spritesheets. Prototype needs: 3 (idle, hit, attack).**

---

## 3. ENEMIES

### 3.1 Common Enemies (4 types needed)

| Animation State | Frame Size | Frame Count | Spritesheet Size |
|----------------|-----------|-------------|-----------------|
| Idle (loop) | 32×32 to 48×56 | 4 | width×height (4 frames wide) |
| Hit reaction | same as idle | 2 | width×height (2 frames wide) |
| Death | same as idle | 4-5 | width×height (4-5 frames wide) |

**Size range:** Small enemies ~32×32, medium enemies ~48×56. Each enemy needs 3 spritesheets (idle, hit, death).

**Per common enemy type: 3 spritesheets. 4 types = 12 spritesheets total.**
**Prototype needs: 2 types = 6 spritesheets.**

### 3.2 Elite Enemies (2 types needed)

| Animation State | Frame Size | Frame Count | Spritesheet Size |
|----------------|-----------|-------------|-----------------|
| Idle (loop) | 48×48 to 64×64 | 4-6 | width×height (frames wide) |
| Hit reaction | same as idle | 2 | width×height (2 frames wide) |
| Death | same as idle | 5-6 | width×height (frames wide) |

**Per elite type: 3 spritesheets. 2 types = 6 spritesheets total.**
**Prototype needs: 0.**

### 3.3 Bosses (3 needed)

Significantly larger than common enemies. Should feel imposing in upper screen area.

| Animation State | Frame Size | Frame Count | Spritesheet Size |
|----------------|-----------|-------------|-----------------|
| Idle (loop) | 64×72 to 80×88 | 6 | width×height (6 frames wide) |
| Hit reaction | same as idle | 3 | width×height (3 frames wide) |
| Death | same as idle | 8 | width×height (8 frames wide) |

**Per boss: 3 spritesheets. 3 bosses = 9 spritesheets total.**
**Prototype needs: 1 boss = 3 spritesheets.**

---

## 4. CARDS

### 4.1 Card Frames (empty templates — content rendered as text overlay)

| Type | Virtual Size | Device Size | Notes |
|------|-------------|-------------|-------|
| Expanded card frame | 75×100 | 300×400 | Shown when card is tapped/selected. Needs variant per card type AND per tier. |
| In-hand thumbnail | 16×24 | 64×96 | Shown in the 5-card fan at bottom of screen. Simplified. |
| Card back | 75×100 | 300×400 | Shown during draw animation and for deck/discard pile display. |

**Card type variants needed:** 8 types (attack, shield, heal, utility, buff, debuff, regen, wild)
**Tier variants per type:** 3 (Tier 1 plain, Tier 2 silver border, Tier 3 gold border)
**Special variant:** 1 echo/ghost frame (translucent)

| Asset | Size | Count |
|-------|------|-------|
| Expanded frames (8 types × 3 tiers) | 75×100 each | 24 |
| Echo frame | 75×100 | 1 |
| Card back | 75×100 | 1 |
| Thumbnails (8 types) | 16×24 each | 8 |
| **Card total** | | **34** |

**Prototype needs: 3 expanded frames (Tier 1 only: attack, shield, heal) + 3 thumbnails + 1 card back = 7.**

### 4.2 Card Type Icons

Small icons placed on cards indicating their function. Must be readable at thumbnail size.

| Size | Count | Notes |
|------|-------|-------|
| 12×12 | 8 | One per card type (attack, shield, heal, utility, buff, debuff, regen, wild) |

**Prototype needs: 3 (attack, shield, heal).**

---

## 5. UI ELEMENTS

### 5.1 HP / Resource Bars

| Asset | Virtual Size | Count |
|-------|-------------|-------|
| Player HP bar frame | 60×8 | 1 |
| Player HP bar fill | 58×6 | 1 |
| Player shield bar fill | 58×6 | 1 |
| Enemy HP bar frame | 50×6 | 1 |
| Enemy HP bar fill | 48×4 | 1 |
| Enemy HP bar fill (poison preview) | 48×4 | 1 |
| Timer bar frame | 65×4 | 1 |
| Timer bar fill (safe) | 63×2 | 1 |
| Timer bar fill (warning) | 63×2 | 1 |
| Timer bar fill (danger) | 63×2 | 1 |
| **Total** | | **10** |

### 5.2 Enemy Intent Icons

Displayed above enemy to telegraph next action.

| Size | Count | Types |
|------|-------|-------|
| 16×16 | 6 | Attack, defend, buff, debuff, special, unknown |

**Prototype needs: 3 (attack, defend, unknown).**

### 5.3 Buttons

| Asset | Virtual Size | Count |
|-------|-------------|-------|
| Answer button (default state) | 65×14 | 1 |
| Answer button (correct state) | 65×14 | 1 |
| Answer button (wrong state) | 65×14 | 1 |
| Answer button (reveal correct) | 65×14 | 1 |
| Primary action button | 50×14 | 1 |
| Secondary action button | 50×14 | 1 |
| Hint button (small) | 24×10 | 1 |
| Skip button (small) | 24×10 | 1 |
| **Total** | | **8** |

### 5.4 Combo Counter Badges

| Asset | Virtual Size | Count |
|-------|-------------|-------|
| 2x combo | 20×12 | 1 |
| 3x combo | 24×14 | 1 |
| 4x combo | 28×16 | 1 |
| 5x / perfect combo | 36×20 | 1 |
| **Total** | | **4** |

**Prototype needs: 2 (2x and 5x).**

### 5.5 Status Effect Icons

| Size | Count | Types |
|------|-------|-------|
| 10×10 | 5 | Poison, weak, vulnerable, strength, regen |

**Prototype needs: 0.**

### 5.6 Resource / Currency Icons

| Size | Count | Types |
|------|-------|-------|
| 12×12 | 4 | Currency, hint resource, streak flame, mastery star |

**Prototype needs: 1 (currency).**

### 5.7 Difficulty Stars

| Size | Count | Types |
|------|-------|-------|
| 6×6 | 2 | Filled star, empty star |

---

## 6. ROOM / PATH SELECTION DOORS

Shown between encounters. Player picks 1 of 3 paths.

| Asset | Virtual Size | Count |
|-------|-------------|-------|
| Combat door/path | 40×50 | 1 |
| Mystery door/path | 40×50 | 1 |
| Rest door/path | 40×50 | 1 |
| Treasure door/path | 40×50 | 1 |
| Shop door/path | 40×50 | 1 |
| Boss door/path | 40×50 | 1 |
| Floor progress indicator dot | 8×8 | 1 (filled + empty variant) |
| **Total** | | **7** |

**Prototype needs: 3 (combat, mystery, rest).**

---

## 7. PARTICLES

Tiny sprites for Phaser 3 particle emitter. Spawned in quantity.

| Asset | Virtual Size | Count | Usage |
|-------|-------------|-------|-------|
| Spark/glow | 3×3 | 1 | Correct answer burst |
| Dust/debris | 3×3 | 1 | Enemy death |
| Heal mote | 3×3 | 1 | Healing effects |
| Fire/energy | 4×4 | 1 | Damage-over-time effects |
| Shadow/ghost | 3×3 | 1 | Echo card effects |
| Gold/reward | 3×3 | 1 | Currency/reward pickup |
| Star | 5×5 | 1 | Combo/celebration |
| Crystal/shard | 4×4 | 1 | General shatter effects |
| **Total** | | **8** |

**Prototype needs: 3 (spark, dust, gold).**

---

## 8. EFFECT ANIMATIONS

Short animated overlays for combat feedback. Horizontal spritesheets.

| Asset | Frame Size | Frame Count | Spritesheet Size | Usage |
|-------|-----------|-------------|-----------------|-------|
| Attack hit | 24×24 | 3 | 72×24 | Plays on enemy when attack card activates |
| Shield activate | 28×28 | 3 | 84×28 | Plays on player when shield activates |
| Heal glow | 24×24 | 3 | 72×24 | Plays on player when healing |
| Card fizzle | 20×20 | 3 | 60×20 | Plays on card position on wrong answer |
| Correct answer burst | 32×32 | 4 | 128×32 | Centered radial burst on correct answer |
| Combo ring | 40×40 | 4 | 160×40 | Expanding ring at combo milestones |
| Speed bonus text | 20×8 | 1 | 20×8 | Static "FAST!" banner |
| **Total** | | | **7 spritesheets** | |

**Prototype needs: 3 (attack hit, fizzle, correct burst).**

---

## 9. DOMAIN / CATEGORY ICONS

Used at run-start domain selection screen and on card UI.

| Size | Count | Notes |
|------|-------|-------|
| 32×32 | 8 active + 1 locked | One per knowledge domain plus a generic locked/unavailable icon |

**Prototype needs: 4 (whichever 4 domains ship first).**

---

## 10. SHOP / REST / REWARD SCREEN ELEMENTS

| Asset | Virtual Size | Animation | Notes |
|-------|-------------|-----------|-------|
| Merchant NPC | 32×48 | 4-frame idle (128×48 sheet) | Shop screen character |
| Campfire / rest object | 24×24 | 4-frame loop (96×24 sheet) | Rest screen focal point |
| Chest (closed) | 24×20 | Static | Treasure room |
| Chest (open) | 24×20 | Static | Treasure room post-open |
| Upgrade icon | 20×18 | Static | Card upgrade option at rest |
| Remove card icon | 16×16 | Static | Shop remove-a-card option |
| **Total** | | | **6 assets** |

**Prototype needs: 0 (use simple UI placeholders).**

---

## 11. CELEBRATION / MILESTONE

| Asset | Virtual Size | Animation | Notes |
|-------|-------------|-----------|-------|
| Full-screen overlay frame | 200×280 | Static | Fossil/lore discovery frame. Ornate border. |
| Decorative domain icons (large) | 48×48 | Static | One per domain, for milestone screens. 8 total. |
| Tier-up animation | 40×40 | 6 frames (240×40 sheet) | Card evolution visual. |
| **Total** | | | **10 assets** |

**Prototype needs: 0.**

---

## 12. CASH-OUT / CONTINUE SCREEN

| Asset | Virtual Size | Notes |
|-------|-------------|-------|
| "Go up / cash out" visual | 48×60 | Elevator, ladder, portal — theme-dependent |
| "Go deeper / continue" visual | 48×60 | Shaft, stairs, gate — theme-dependent |
| Risk preview bar | 60×8 | Green = safe portion, red = at risk |
| **Total** | | **3** |

**Prototype needs: 0 (use text buttons initially).**

---

## 13. ONBOARDING / TUTORIAL

| Asset | Virtual Size | Animation | Notes |
|-------|-------------|-----------|-------|
| Tap indicator (finger) | 20×24 | 3 frames (60×24 sheet) | "Tap here" hand animation |
| Pointer arrow | 12×16 | Static (bounced via code) | Points at UI elements |
| Tooltip background | 16×16 | Static, 9-slice | Scales to any size. Semi-transparent dark panel. |
| **Total** | | | **3** |

**Prototype needs: 2 (tap indicator, tooltip bg).**

---

## 14. STREAK / DAILY

| Asset | Virtual Size | Animation | Notes |
|-------|-------------|-----------|-------|
| Streak flame (small) | 10×14 | 3 frames (30×14 sheet) | Home screen display |
| Streak flame (large) | 20×28 | 4 frames (80×28 sheet) | Milestone celebration |
| Streak freeze icon | 14×14 | Static | Streak protection item |
| Daily challenge badge | 24×24 | Static | Daily mode icon |
| Rank badge (3 tiers) | 20×20 | Static | Gold/silver/bronze. 3 PNGs. |
| **Total** | | | **7 assets** |

**Prototype needs: 0.**

---

## MASTER SIZE REFERENCE

Quick lookup for ComfyUI workflow templates:

| Category | Dimensions (virtual px) | Aspect Ratio | Workflow Template |
|----------|------------------------|--------------|-------------------|
| Background | 270×600 | 9:20 (portrait) | `workflow_bg_270x600` |
| Player character frame | 32×48 | 2:3 | `workflow_char_32x48` |
| Small enemy frame | 32×32 | 1:1 | `workflow_enemy_sm_32x32` |
| Medium enemy frame | 48×56 | 6:7 | `workflow_enemy_md_48x56` |
| Large enemy / elite frame | 64×64 | 1:1 | `workflow_enemy_lg_64x64` |
| Boss frame | 80×80 | 1:1 (varies up to 80×88) | `workflow_boss_80x80` |
| Card expanded | 75×100 | 3:4 | `workflow_card_75x100` |
| Card thumbnail | 16×24 | 2:3 | `workflow_card_thumb_16x24` |
| Room/path door | 40×50 | 4:5 | `workflow_door_40x50` |
| Domain icon | 32×32 | 1:1 | `workflow_icon_32x32` |
| Small icon | 12×12 | 1:1 | `workflow_icon_sm_12x12` |
| Status icon | 10×10 | 1:1 | `workflow_icon_xs_10x10` |
| UI button (answer) | 65×14 | ~4.6:1 | `workflow_btn_65x14` |
| UI button (action) | 50×14 | ~3.6:1 | `workflow_btn_50x14` |
| Particle | 3×3 to 5×5 | 1:1 | `workflow_particle_4x4` |
| Effect frame | 24×24 to 40×40 | 1:1 | `workflow_fx_32x32` |
| NPC / secondary character | 32×48 | 2:3 | `workflow_npc_32x48` |
| Prop / object | 24×20 to 24×24 | ~1:1 | `workflow_prop_24x24` |
| Celebration frame (large) | 200×280 | 5:7 | `workflow_frame_200x280` |
| Milestone icon (large) | 48×48 | 1:1 | `workflow_icon_lg_48x48` |

---

## COMFYUI WORKFLOW NOTES

**For pixel art generation at these sizes:**

- Generate at the virtual pixel size (NOT at 4x). Upscale with nearest-neighbor after.
- If the model struggles at very small sizes (e.g., 32×32), generate at 2x (64×64) and downscale with nearest-neighbor to get the pixel grid, then upscale 4x for final output.
- Use img2img with a pixel art LoRA/checkpoint for consistency.
- Spritesheet generation: generate individual frames, then stitch horizontally using PIL/ImageMagick.
- Transparency: generate on a solid color background (magenta #FF00FF works well), then batch-remove background to get RGBA PNGs.
- Consistency pass: after generating all assets for a category, do a color palette reduction pass (quantize to your 32-64 color palette) to ensure visual coherence.

**Batch generation order (by workflow template):**

1. `workflow_bg_270x600` — backgrounds (low count, high impact)
2. `workflow_char_32x48` — player character frames
3. `workflow_enemy_sm_32x32` + `workflow_enemy_md_48x56` — common enemies
4. `workflow_boss_80x80` — boss enemies
5. `workflow_card_75x100` — card frames
6. `workflow_icon_32x32` + `workflow_icon_sm_12x12` — icons
7. `workflow_door_40x50` — room selection doors
8. `workflow_fx_32x32` — effect animations
9. Everything else

---

## TOTAL COUNTS

| Category | Full Game | Prototype Only |
|----------|----------|----------------|
| Backgrounds | 11 | 3 |
| Player spritesheets | 7 | 3 |
| Enemy spritesheets | 27 | 9 |
| Card PNGs | 34 | 7 |
| Card type icons | 8 | 3 |
| UI bars/frames | 10 | 6 |
| Intent icons | 6 | 3 |
| Buttons | 8 | 5 |
| Combo badges | 4 | 2 |
| Status icons | 5 | 0 |
| Resource icons | 4 | 1 |
| Difficulty stars | 2 | 2 |
| Room doors | 7 | 3 |
| Particles | 8 | 3 |
| Effect spritesheets | 7 | 3 |
| Domain icons | 9 | 4 |
| Shop/rest/reward | 6 | 0 |
| Celebration/milestone | 10 | 0 |
| Cash-out screen | 3 | 0 |
| Onboarding | 3 | 2 |
| Streak/daily | 7 | 0 |
| **TOTAL** | **~186** | **~51** |