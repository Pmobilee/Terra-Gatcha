# AR-03: Visual Polish + Asset Integration
> Phase: Pre-Launch — Art Pass
> Priority: HIGH
> Depends on: AR-01 (Combat Integrity — for commit-before-reveal card states)
> Estimated scope: L

Wire the generated art assets into the game. Replace all placeholder rectangles and text-only elements with proper pixel art sprites. This phase covers player sprites, enemy sprites, boss sprites, card frames, backgrounds, door sprites, and domain icons.

## Design Reference

From GAME_DESIGN.md Section 16 (Portrait UX):

> Top 55% (Display): Enemy, HP bars, intent, floor counter, relics, AP. No interactives.
> Bottom 45% (Interaction): Card hand, Cast button, answer buttons, hint, End Turn.

From GAME_DESIGN.md Section 2 (Card Anatomy):

> Front: Card name, mechanic name + effect description, effect value, difficulty stars, domain color tint
> Back: Question text, answer options (3/4/5 by tier), timer bar, hint button
> Card states: In hand (~65×95dp), Selected (~200×280dp), Committed (~300×350dp)

From GAME_DESIGN.md Section 5 (Card Tiers):

> Tier 1: Standard frame
> Tier 2a: Silver tint
> Tier 2b: Silver + glow
> Tier 3: Gold frame, relic tray

From GAME_DESIGN.md Section 8 (Enemies):

> Common: Dungeon Bat (20 HP), Crystal Golem (40 HP), Toxic Spore (18 HP), Shadow Mimic (30 HP)
> Elite: Dungeon Wyrm (60 HP), Tome Guardian (50 HP)
> Boss: Gate Guardian (80 HP), Magma Wyrm (100 HP), The Archivist (90 HP)

## Implementation

### Sub-task 1: Audit Available Assets

Before any integration, catalog what exists in `src/assets/`:

```bash
find src/assets/ -name "*.png" -o -name "*.jpg" -o -name "*.webp" | sort
```

Cross-reference against `src/assets/fact-sprite-manifest.json` for the asset manifest.

For each required asset category, determine:
- Which sprites exist and are ready to use
- Which need generation (via ComfyUI pipeline from CR-14)
- Which can use placeholder art temporarily

### Sub-task 2: Phaser CombatScene Sprites

#### Player Sprites

In `src/game/scenes/CombatScene.ts`:

Replace the player placeholder (colored rectangle at ~48% from top) with sprite:
- Load player sprite sheet in `BootScene.ts` preload: `this.load.spritesheet('player', 'assets/sprites/player-sheet.png', { frameWidth: 64, frameHeight: 64 })`
- Create animations in CombatScene:
  - `player-idle`: frames 0-3, 4fps, loop
  - `player-attack`: frames 4-7, 8fps, no loop, callback to idle
  - `player-hit`: frames 8-9, 6fps, no loop, callback to idle
  - `player-cast`: frames 10-13, 8fps, no loop, callback to idle
  - `player-victory`: frames 14-17, 4fps, loop
  - `player-defeat`: frames 18-19, 2fps, no loop
  - `player-block`: frame 20, static

Player sprite position: x = 25% viewport width, y = 40% viewport height (left side of display zone).
Scale: 2x (128×128 rendered from 64×64 source).

Trigger animations:
- On card correct (attack type): `player.play('player-attack')`
- On card correct (shield type): `player.play('player-block')`
- On card correct (heal/buff): `player.play('player-cast')`
- On enemy attack: `player.play('player-hit')`
- On victory: `player.play('player-victory')`
- On defeat: `player.play('player-defeat')`
- Default: `player.play('player-idle')`

#### Enemy Sprites

Replace enemy placeholder rectangle with sprites per enemy type:

In `BootScene.ts`, preload all enemy sprite sheets:
```typescript
const enemies = ['dungeon-bat', 'crystal-golem', 'toxic-spore', 'shadow-mimic', 'dungeon-wyrm', 'tome-guardian', 'gate-guardian', 'magma-wyrm', 'archivist'];
enemies.forEach(e => {
  this.load.spritesheet(e, `assets/sprites/enemies/${e}.png`, { frameWidth: 64, frameHeight: 64 });
});
```

Each enemy has 3 animations:
- `{enemy}-idle`: frames 0-3, 3fps, loop
- `{enemy}-hit`: frames 4-5, 8fps, no loop, callback to idle
- `{enemy}-death`: frames 6-9, 6fps, no loop (plays on HP ≤ 0)

Enemy sprite position: x = 75% viewport width, y = 20% viewport height (right side, upper display zone).
Scale: 2.5x for bosses (160×160), 2x for common/elite (128×128).

In `CombatScene.setEnemy()`:
- Destroy previous enemy sprite if exists
- Create new sprite with correct texture key matching `enemyId` from `enemies.ts`
- Play idle animation
- Store reference for hit/death animations

In `CombatScene.playEnemyHitAnimation()`:
- Play `{enemy}-hit` animation
- 5px knockback tween (x += 5, duration 50ms, yoyo true)
- Red tint flash (0xff0000, 100ms)

In `CombatScene.playEnemyDeathAnimation()`:
- Play `{enemy}-death` animation
- Fade out tween (alpha 0, duration 500ms)
- Destroy sprite after animation complete

### Sub-task 3: Card Frame Sprites

Card frames are Svelte-rendered (bottom 45%), not Phaser. Implement as CSS background images or `<img>` elements.

10 card frame types needed:
1. `card-frame-attack.png` — Red/orange theme
2. `card-frame-shield.png` — Blue/steel theme
3. `card-frame-heal.png` — Green/nature theme
4. `card-frame-buff.png` — Yellow/gold theme
5. `card-frame-debuff.png` — Purple/dark theme
6. `card-frame-utility.png` — Teal/cyan theme
7. `card-frame-regen.png` — Light green theme
8. `card-frame-wild.png` — Rainbow/prismatic theme
9. `card-frame-echo.png` — Translucent/ghostly overlay
10. `card-back.png` — Universal card back

Tier overlays (applied on top of base frame):
- Tier 1: No overlay (standard frame)
- Tier 2a: Silver tint CSS filter: `filter: brightness(1.1) saturate(0.8)` + subtle silver border
- Tier 2b: Silver tint + animated glow: CSS `box-shadow: 0 0 8px rgba(192,192,192,0.6)` with pulse animation
- Tier 3: Gold frame variant (separate image) + `box-shadow: 0 0 12px rgba(255,215,0,0.8)`

In card Svelte components (hand cards, selected card, committed card):
- Replace solid color backgrounds with frame images
- Card frame image as positioned background: `background-image: url('/assets/cards/card-frame-{type}.png')`
- Tier overlay applied via CSS class: `.tier-2a`, `.tier-2b`, `.tier-3`
- Echo cards: additional overlay with `opacity: 0.7` and shimmer CSS animation

### Sub-task 4: Background Integration

Backgrounds render in Phaser (full viewport behind everything else).

Load backgrounds in `BootScene.ts`:
```typescript
this.load.image('bg-combat', 'assets/backgrounds/combat-dungeon.png');
this.load.image('bg-title', 'assets/backgrounds/title-screen.png');
this.load.image('bg-room-select', 'assets/backgrounds/room-selection.png');
this.load.image('bg-rest', 'assets/backgrounds/rest-campfire.png');
this.load.image('bg-shop', 'assets/backgrounds/shop-merchant.png');
this.load.image('bg-treasure', 'assets/backgrounds/treasure-room.png');
```

In `CombatScene.create()`:
- Add background as first element (depth 0): `this.add.image(centerX, centerY, 'bg-combat').setDisplaySize(width, height)`
- Background covers full viewport (stretches to fill)
- All other elements render on top (depth > 0)

For non-combat screens (room selection, rest, shop, treasure):
- These are Svelte components, not Phaser scenes
- Use CSS `background-image` on the component wrapper div
- Fallback: solid dark color if image not loaded

### Sub-task 5: Door Sprites for Room Selection

In `RoomSelection.svelte`:
- Replace text-based room cards with door sprite buttons
- 5 door variants: `door-combat.png`, `door-mystery.png`, `door-rest.png`, `door-treasure.png`, `door-shop.png`
- Each door: 80×120dp rendered size
- Door sprite as `<img>` element inside the room option button
- Room type label below door (text, not part of sprite)
- Enemy type shown below combat doors (e.g., "Dungeon Bat")
- Mystery door: `?` icon overlaid on door sprite
- Tap animation: scale 1.05 on press (existing behavior, keep)

### Sub-task 6: Domain Icons

9 domain icons needed: `science.png`, `history.png`, `geography.png`, `language.png`, `math.png`, `arts.png`, `medicine.png`, `technology.png`, `general.png`

Each icon: 32×32px source, rendered at 24×24dp in card views and 40×40dp in domain selection.

Wire into:
1. `DomainSelection.svelte` — Large icons (40×40dp) next to domain name
2. Card hand — Small icon (24×24dp) in corner of card showing fact's domain
3. Card selected/committed — Medium icon (32×32dp) next to domain name

### System Interactions

- **Commit-before-reveal (AR-01):** Card frames must work in all 3 stages — hand (small frame), selected (enlarged frame), committed (full frame with question overlay)
- **Echo mechanic:** Echo card frame uses `card-frame-echo.png` with shimmer animation. Must be visually distinct from all other frames.
- **Tier system:** Tier overlays stack on top of type frames. Tier 3 gold frame is a separate asset, not a filter.
- **Passive relics:** Relic icons in relic tray (Phaser, display zone). Need small relic icons (16×16dp). Dormant relics get grayscale filter.
- **Combo system:** No interaction with sprites. Combo counter is a separate text element.
- **Room selection:** Door sprites replace text cards. Must maintain `data-testid` attributes for E2E tests.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Sprite file missing (failed to load) | Fall back to colored rectangle placeholder. Log warning. Game still playable. |
| Enemy type not in sprite manifest | Use generic enemy placeholder sprite. Log warning. |
| Card type has no frame sprite | Use default gray frame. Card is still playable. |
| Screen resize / orientation change | Sprites scale proportionally. Background stretches to fill. |
| Echo card with Tier 2b | Echo overlay + silver glow. Echo shimmer takes visual priority. |
| Tier 3 card (passive relic) | Gold frame shown in relic tray only. Not in hand (passives don't appear in hand). |
| Boss with 2.5x scale | Fits within display zone (top 55%). Does not overlap interaction zone. |
| Player defeat animation | Plays once, holds last frame. Does not loop. |
| Multiple rapid enemy hits (poison ticks) | Queue hit animations, play sequentially with 200ms gap. |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Modify | `src/game/scenes/BootScene.ts` | Preload all sprite sheets, backgrounds, card frames, door sprites, domain icons |
| Modify | `src/game/scenes/CombatScene.ts` | Player sprite + animations, enemy sprites + animations, background image, sprite pool |
| Modify | `src/ui/components/CardCombatOverlay.svelte` | Card frame images by type, tier overlay CSS, echo shimmer, domain icon |
| Modify | `src/ui/components/RoomSelection.svelte` | Door sprite images replace text cards |
| Modify | `src/ui/components/DomainSelection.svelte` | Domain icons next to names |
| Create | `src/assets/sprites/` | Player sheet, enemy sheets (9), card frames (10), doors (5), domain icons (9), backgrounds (6) |
| Create | `src/game/animations/spriteAnimations.ts` | Animation definitions for player + all enemies (centralized) |
| Modify | `src/ui/components/CardRewardScreen.svelte` | Card frame images on reward cards |
| Modify | `src/ui/components/PassiveEffectBar.svelte` | Relic icons, dormancy grayscale |

## Done When

- [ ] Player sprite renders at 25% x, 40% y with idle animation (4 frames, 4fps loop)
- [ ] Player sprite plays attack/hit/cast/victory/defeat animations triggered by game events
- [ ] All 9 enemy types render with correct sprite (idle animation) when encounter starts
- [ ] Enemy hit animation plays on damage (knockback + red flash)
- [ ] Enemy death animation plays on HP ≤ 0 (fade out)
- [ ] 10 card frame types render on cards in hand, selected, and committed states
- [ ] Tier 2a cards have silver tint, Tier 2b have silver + glow, Tier 3 have gold frame
- [ ] Echo cards have translucent overlay with shimmer animation
- [ ] Combat background renders behind all elements in CombatScene
- [ ] Room selection shows door sprites instead of text cards
- [ ] Domain icons show on domain selection screen and on cards
- [ ] Missing assets fall back to colored rectangles (no crash)
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Visual verification via Playwright screenshot (sprites visible, no overlapping)
