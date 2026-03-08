# CR-08: Mastery Tiers

> Cards evolve Tier 1→2→3 via SM-2 mastery. Tier 3 cards become passive buffs. Visual upgrades per tier.

## Overview

**Goal:** Wire SM-2 updates into card combat so facts progress through tiers across runs, implement Tier 3 passive effects, and add visual tier distinction.

**Dependencies:** CR-01 (card foundation), CR-02 (encounter engine), CR-04 (card hand UI)
**Complexity:** Medium (touches 6-8 files, mostly wiring + UI changes)

## Sub-steps

### 1. Wire SM-2 Updates into Card Combat

**Files:** `src/services/encounterBridge.ts`, `src/ui/stores/playerData.ts`

In `handlePlayCard()` in encounterBridge.ts, after processing the card play result, call `updateReviewState()` from playerData store:

```typescript
// In handlePlayCard, after recordCardPlay:
import { updateReviewState } from '../../ui/stores/playerData'

// Map combat result to SM-2 quality: correct+speedBonus='good', correct='okay', wrong='again'
const sm2Button = !correct ? 'again' : speedBonus ? 'good' : 'okay'
updateReviewState(cardId_factId, sm2Button)
```

The card's `factId` must be resolved from the card ID. The turnState holds the card data.

**Acceptance:** After playing cards in combat, `playerSave.reviewStates` shows updated intervals/repetitions for those facts. Verify via `window.__terraDebug()` or browser_evaluate.

### 2. Tier 3 Passive Effect System

**Files:** `src/services/turnManager.ts`, `src/data/card-types.ts`, `src/data/balance.ts`

Add a passive effect tracking system:

a) Add `PassiveEffect` type to card-types.ts:
```typescript
export interface PassiveEffect {
  source: string  // factId of the mastered card
  type: CardType  // determines the passive bonus
  value: number   // bonus amount
}
```

b) Add `activePassives: PassiveEffect[]` to TurnState in turnManager.ts.

c) Add balance constants for passive values:
```typescript
export const TIER3_PASSIVE: Record<string, number> = {
  attack: 1,    // +1 damage to all attacks
  shield: 1,    // +1 block to all shields
  heal: 1,      // +1 HP regen per turn
  utility: 5,   // +5% draw chance (integer %)
  buff: 2,      // +2% to next card buff
  debuff: 1,    // +1 to debuff potency
  regen: 1,     // +1 regen per turn
  wild: 1,      // +1 to wild copy effect
}
```

d) When building the deck in encounterBridge.startEncounterForRoom(), separate Tier 3 cards from the deck and register them as passive effects instead. They should NOT appear in the draw pile.

e) Apply passive bonuses in cardEffectResolver or turnManager when resolving card effects:
- attack passives: add flat bonus to all attack damage
- shield passives: add flat bonus to all shield values
- heal passives: apply at start of each player turn
- regen passives: apply at start of each player turn

**Acceptance:** A Tier 3 attack card adds +1 damage to every attack card played. Tier 3 heal/regen cards heal 1 HP at turn start. Passives are visible in CombatScene.

### 3. Visual Tier Distinction

**Files:** `src/ui/components/CardHand.svelte`, `src/ui/components/CardExpanded.svelte`

a) CardHand.svelte — Update card visuals by tier:
- Tier 1: Standard frame (current default)
- Tier 2: Silver border + subtle glow (`box-shadow: 0 0 8px rgba(192, 192, 192, 0.6)`)
- Tier 3: Gold border + strong glow (`box-shadow: 0 0 12px rgba(255, 215, 0, 0.8)`)
  - But Tier 3 cards won't appear in hand (they're passives) — this applies only if we ever show them

b) Update the tier badge colors:
- T1: no badge
- T2: silver badge with "T2"
- T3: gold badge with "T3"

c) CardExpanded.svelte — Show tier indicator in the expanded card view:
- Add a small tier badge in the header next to domain name
- Tier 2: "★★" silver stars
- Tier 3: "★★★" gold stars (if ever shown as active)

### 4. Passive Effect Display in CombatScene

**Files:** `src/game/scenes/CombatScene.ts`, `src/services/encounterBridge.ts`

a) Add a `setPassiveEffects(passives: Array<{type: string, value: number}>)` method to CombatScene that renders small icons in the passive relic tray (below the floor info, above the interaction zone).

b) Each passive shows: domain icon + "+N" (e.g., "⚔+1" for attack passive)

c) When a passive triggers (heal/regen at turn start), show a brief flash on the passive icon.

d) In encounterBridge.startEncounterForRoom(), after extracting Tier 3 passives, call `scene.setPassiveEffects(...)`.

### 5. Passive Trigger at Turn Start

**Files:** `src/services/turnManager.ts`, `src/services/encounterBridge.ts`

a) In `startNewTurn()` or equivalent in turnManager, apply heal/regen passives before drawing cards.

b) In encounterBridge.handleEndTurn(), after enemy turn resolves, apply any passive heal/regen effects and update the display.

c) Track passive triggers for juice: small green "+1" floating numbers when heal passives fire.

### 6. Run Pool Builder — Tier 3 Separation

**Files:** `src/services/runPoolBuilder.ts`, `src/services/encounterBridge.ts`

a) In encounterBridge.startEncounterForRoom(), after building the deck:
- Filter out Tier 3 cards from drawPile
- Register them as passive effects on the TurnState
- This means the hand only ever contains Tier 1 and Tier 2 cards

b) Show a brief "Passive Activated" notification when a Tier 3 card is first registered in a run.

## Acceptance Criteria

1. Playing cards correct/wrong updates SM-2 states in playerData store
2. Across multiple runs, facts that are consistently answered correctly progress from T1→T2→T3
3. Tier 3 cards do not appear in hand — they provide passive bonuses
4. Passive bonuses visibly affect combat (e.g., +1 damage on attacks)
5. Passive effect icons display in CombatScene
6. Heal/regen passives trigger at turn start with visual feedback
7. Tier 2 cards show silver visual distinction in hand
8. `npm run typecheck` passes, `npx vitest run` passes, build succeeds

## Verification

1. `npm run typecheck` — 0 errors
2. `npm run build` — succeeds
3. `npx vitest run` — all tests pass
4. Playwright: Start run → play cards → verify SM-2 updates via browser_evaluate
5. Playwright: With a pre-seeded high-mastery save, verify Tier 3 passives appear

## Files Affected

- `src/services/encounterBridge.ts` — SM-2 update calls, passive extraction
- `src/services/turnManager.ts` — passive effect tracking, turn-start triggers
- `src/data/card-types.ts` — PassiveEffect type
- `src/data/balance.ts` — TIER3_PASSIVE constants
- `src/ui/components/CardHand.svelte` — tier visuals
- `src/ui/components/CardExpanded.svelte` — tier indicator
- `src/game/scenes/CombatScene.ts` — passive display
- `src/ui/stores/playerData.ts` — (verify updateReviewState is accessible)
- `docs/ARCHITECTURE.md` — update with passive effect system
- `docs/GAME_DESIGN.md` — confirm tier details match implementation
- `docs/roadmap/PROGRESS.md` — mark CR-08 complete when done
