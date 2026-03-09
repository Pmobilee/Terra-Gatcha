# AR-01: Combat Integrity
> Phase: Pre-Launch — Combat Fixes
> Priority: BLOCKER
> Depends on: None (all P0/P1 phases complete)
> Estimated scope: L

Make combat mechanically correct and educationally sound. Currently the card play flow allows preview-cancel (tap card → see question → deselect without answering), which undermines retrieval practice — the core educational mechanic. Domain is hardcoded to card type, preventing balanced decks. Timer doesn't adapt to question length. End Turn button UX is incomplete.

## Design Reference

From GAME_DESIGN.md Section 2 (Card Combat — Commit-Before-Reveal):

> **Stage 1 — In hand:** Card name, mechanic name + description, effect value, difficulty stars, domain tint. NO question.
> **Stage 2 — Selected (tap to rise):** Enlarged front. "Cast" button below. Non-selected cards dim and slide down. Player sees what the card DOES and how hard the question is. Can freely deselect. Strategic decision point.
> **Stage 3 — Committed (tap Cast):** Question + answers appear. Dynamic timer starts. No cancel. Must answer or auto-fizzle.

From GAME_DESIGN.md Section 2 (Dynamic Timer System):

> Base timer by floor: 1-3=12s, 4-6=9s, 7-9=7s, 10-12=5s, 13+=4s
> Question length modifier: +1 second per 15 words in question text beyond 10 words
> Slow Reader mode: +3 seconds flat to all timers. Timer bar amber instead of red.
> Speed bonus: Answer in first 25% of EFFECTIVE timer → +50% effect.

From GAME_DESIGN.md Section 3 (Domain/Type Decoupling):

> Domain = what you learn. Card type = what it does in combat. Independent axes.
> Game builds 120-fact pool → assigns each fact a type from balanced distribution:
> Attack ~30%, Shield ~25%, Heal ~15%, Buff ~10%, Debuff ~8%, Utility ~7%, Regen ~3%, Wild ~2%

From GAME_DESIGN.md Section 2 (Action Points):

> 3 AP per turn. Each commit costs 1 AP (or more for Heavy Strike). Skip is free.
> End Turn always visible during player turn. Disabled during commit/answer and enemy turn. Auto-ends at 0 AP.

From GAME_DESIGN.md Section 8 (Encounter Termination):

> Turn 15+ → Enemy +3 dmg/turn (soft enrage)
> Enemy HP ≤ 0 → Victory + rewards
> Player HP ≤ 0 → Defeat, run ends with retreat penalties

## Implementation

### Sub-task 1: Commit-Before-Reveal Flow (3-Stage Card Play)

#### Data Model

Add to `CardCombatOverlay.svelte` state:

```typescript
// New card play stage tracking
type CardPlayStage = 'hand' | 'selected' | 'committed';

let cardPlayStage: CardPlayStage = $state('hand');
let committedCardIndex: number | null = $state(null);
```

No new interfaces needed. The `Card` interface already has all required fields (mechanicName, baseEffectValue, tier, domain).

#### Logic

In `CardCombatOverlay.svelte`:

**`handleSelect(index)`** — Stage 1 → Stage 2:
- Set `selectedIndex = index`, `cardPlayStage = 'selected'`
- Card rises to enlarged front view
- Show "Cast" button below the selected card
- Non-selected cards dim (opacity 0.4) and slide down 20px
- NO question, NO answers, NO timer visible
- Player CAN deselect (tap card again or tap empty area) → returns to Stage 1

**New `handleCast()`** — Stage 2 → Stage 3:
- Set `cardPlayStage = 'committed'`, `committedCardIndex = selectedIndex`
- Card locked — cannot deselect
- Question text + answer options appear
- Dynamic timer starts (see Sub-task 2)
- Cast button disappears
- Skip button appears (costs 0 AP but wastes the commit)
- Haptic: `ImpactStyle.Light`

**`handleDeselect()`** — Only allowed in Stage 2:
- If `cardPlayStage === 'committed'`, ignore (no cancel after commit)
- If `cardPlayStage === 'selected'`, return to Stage 1: reset `selectedIndex`, `cardPlayStage = 'hand'`
- Non-selected cards un-dim and slide back up

**`handleAnswer(answerIndex, isCorrect, speedBonus)`** — Stage 3 only:
- Existing logic (fire `onplaycard` callback)
- After resolution: reset `cardPlayStage = 'hand'`, `committedCardIndex = null`

**`handleSkip()`** — Available in Stage 2 (free, no AP) and Stage 3 (still costs 0 AP):
- Fire `onskipcard` callback
- Reset to Stage 1

**Timer expiration** — Stage 3 auto-fizzle:
- When timer reaches 0 in committed stage: treat as wrong answer (fizzle)
- Fire `onplaycard` with `isCorrect = false`
- Reset to Stage 1

#### UI

**Stage 1 (hand):**
- 5 cards in fan layout, each showing: mechanic name, effect value, difficulty stars (1-3), domain color tint
- NO question text visible on any card
- Tap any card → transition to Stage 2

**Stage 2 (selected):**
- Selected card enlarges to ~200×280dp
- Shows: card name (thematic), mechanic name + effect description (e.g. "Multi-Hit: 3×3 dmg"), effect value, difficulty stars, domain color tint, tier indicator
- "Cast" button below card: 80×48dp, amber/gold color, text "CAST"
- "Skip" small text link below Cast button
- Non-selected cards: opacity 0.4, slide down 20px
- Tap selected card again OR tap empty area → deselect back to Stage 1

**Stage 3 (committed):**
- Card expands to ~300×350dp
- Question text appears
- Answer options appear (3/4/5 depending on tier): full-width buttons, 56dp height, 8dp spacing
- Timer bar appears at bottom of card area
- Cast button gone
- Skip button remains (but now labeled "Forfeit" — costs 0 AP, card fizzles)
- Non-selected cards remain dimmed

### Sub-task 2: Dynamic Timer

#### Logic

In `CardCombatOverlay.svelte`, modify timer calculation:

```typescript
function calculateEffectiveTimer(baseFloorTimer: number, questionText: string, isSlowReader: boolean): number {
  const wordCount = questionText.split(/\s+/).length;
  const extraWords = Math.max(0, wordCount - 10);
  const wordBonus = Math.floor(extraWords / 15);
  const slowReaderBonus = isSlowReader ? 3 : 0;
  return baseFloorTimer + wordBonus + slowReaderBonus;
}
```

In `balance.ts`, `FLOOR_TIMER` already has the correct values: `[{maxFloor:3, seconds:12}, {maxFloor:6, seconds:9}, {maxFloor:9, seconds:7}, {maxFloor:12, seconds:5}, {maxFloor:Infinity, seconds:4}]`. No changes needed.

**Speed bonus calculation:** Answer in first 25% of effective timer → `speedBonusEarned = true`. Already exists but needs to use effective timer (with word bonus + slow reader) as denominator.

#### Data Model

Add `isSlowReader` to player profile/save state:

```typescript
// In saveService.ts or playerProfile
interface PlayerProfile {
  // ... existing fields
  isSlowReader: boolean;  // Set during onboarding, default false
}
```

For now (before AR-04 onboarding), default `isSlowReader = false`. The setting will be wired during AR-04.

#### UI

Timer bar visual changes:
- Normal: red gradient bar depleting left-to-right
- Slow Reader: amber gradient bar (same behavior, less stressful color)
- Speed bonus zone: first 25% of bar has subtle gold tint
- Timer text shows seconds remaining (e.g. "7s")

### Sub-task 3: Domain/Type Decoupling

#### Logic

In `src/data/card-types.ts`:
- **DELETE** the `DOMAIN_CARD_TYPE` mapping object entirely
- Remove any imports/usages of `DOMAIN_CARD_TYPE` across the codebase

In `src/services/runPoolBuilder.ts`, modify `buildRunPool()`:

```typescript
const TYPE_DISTRIBUTION: Record<CardType, number> = {
  attack: 0.30,
  shield: 0.25,
  heal: 0.15,
  buff: 0.10,
  debuff: 0.08,
  utility: 0.07,
  regen: 0.03,
  wild: 0.02,
};

function assignCardTypes(cards: Card[]): void {
  // Build target counts from distribution
  const targets = Object.entries(TYPE_DISTRIBUTION).map(([type, pct]) => ({
    type: type as CardType,
    count: Math.round(cards.length * pct),
  }));

  // Adjust to exactly match cards.length (rounding errors)
  // Add/remove from 'attack' (largest pool) to balance

  // Shuffle cards, assign types round-robin from targets
  // Each card gets a type independent of its domain
}
```

In `createCard()` (in runPoolBuilder.ts):
- Remove the line that does `cardType = DOMAIN_CARD_TYPE[fact.category]`
- Card type now comes from `assignCardTypes()` after pool is built

#### Files to Search & Replace

Search for all references to `DOMAIN_CARD_TYPE` in the codebase and remove/replace:
- `src/data/card-types.ts` — delete the mapping
- `src/services/runPoolBuilder.ts` — use `assignCardTypes()` instead
- Any test files referencing `DOMAIN_CARD_TYPE`
- Any UI components that assume domain determines type

### Sub-task 4: End Turn Button Polish

#### Logic

In `CardCombatOverlay.svelte`:
- End Turn button is ALWAYS rendered during player turn (not conditionally)
- Disabled states:
  - `cardPlayStage === 'committed'` → disabled (must answer first)
  - `turnPhase !== 'player_action'` → disabled (enemy turn, etc.)
- Enabled states:
  - `cardPlayStage === 'hand'` or `cardPlayStage === 'selected'` AND `turnPhase === 'player_action'` → enabled
- Auto-end: when AP reaches 0, automatically trigger end turn after 500ms delay (let card resolution animation complete)
- Shows AP remaining: "End Turn (2 AP left)" or "End Turn (0 AP)"

#### UI

```
┌─────────────────────────────┐
│  END TURN  •  2 AP remaining │
└─────────────────────────────┘
```

- Full width, 48dp height
- Position: below answer buttons / below hand area
- Colors: enabled = dark background with white text, disabled = gray background with gray text
- 16dp bottom safe area below button

### Sub-task 5: Encounter Edge Cases

#### Logic

In `turnManager.ts`, verify/fix:

1. **Turn 15+ Enrage:** At end of each enemy turn, if `turnState.turnNumber >= 15`, add +3 to enemy damage. Check `endPlayerTurn()` for this logic. If missing, add:
   ```typescript
   if (turnState.turnNumber >= 15) {
     const enrageBonus = (turnState.turnNumber - 14) * 3;
     enemyDamage += enrageBonus;
   }
   ```

2. **Victory transition:** When `enemy.currentHP <= 0` after `playCardAction()`, immediately stop allowing further card plays. Set phase to `'encounter_end'`. Fire victory callback. Verify no additional cards can be played after enemy death.

3. **Defeat transition:** When `player.currentHP <= 0` after enemy turn in `endPlayerTurn()`, set phase to `'encounter_end'`. Fire defeat callback. Apply retreat penalty from `DEATH_PENALTY` based on current segment.

4. **Draw/Discard/Reshuffle cycle:** When draw pile is empty and player needs to draw, shuffle discard pile into draw pile. Verify this works when both are empty (no cards to draw — skip draw phase, go straight to end turn).

5. **Hand overflow prevention:** Never draw more than `HAND_SIZE` (5) cards. If draw pile + discard combined < HAND_SIZE, draw what's available.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Player taps card, sees front, deselects | Returns to hand. No question shown. No AP cost. |
| Player taps Cast, timer expires | Auto-fizzle. Wrong answer. Costs 1 AP. Card discarded. |
| Player in Stage 3 taps another card | Ignored. Must answer or forfeit current committed card first. |
| 40-word question on Floor 1 | Timer = 12 + floor(30/15) = 14 seconds |
| 8-word question on Floor 7 | Timer = 7 + 0 = 7 seconds (no word bonus below 10 words) |
| Slow Reader + 40-word question on Floor 1 | Timer = 12 + 2 + 3 = 17 seconds |
| Science fact assigned Shield type | Valid. Domain is cosmetic. Type from balanced distribution. |
| All 120 cards need type assignment | Exactly 36 attack, 30 shield, 18 heal, 12 buff, ~10 debuff, ~8 utility, ~4 regen, ~2 wild |
| Player has 0 AP, presses End Turn | End Turn fires immediately. Enemy turn begins. |
| Player has 1 AP, plays card, now 0 AP | 500ms delay for animation, then auto-end turn. |
| Turn 15, enemy attacks | Enemy base damage + 3 bonus. Turn 16: +6 bonus. Turn 17: +9. |
| Enemy dies mid-card-play | Phase set to encounter_end. Remaining cards cannot be played. Victory screen. |
| Draw pile empty, discard has 3 cards | Shuffle discard → draw pile. Draw 3 (less than HAND_SIZE). |
| Both draw and discard empty | Draw 0 cards. Player can only End Turn. |
| End Turn button during enemy turn | Button visible but disabled (grayed out). |
| End Turn button during committed stage | Button visible but disabled. Must answer first. |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Modify | `src/ui/components/CardCombatOverlay.svelte` | 3-stage commit-before-reveal flow, dynamic timer, End Turn always visible |
| Modify | `src/data/card-types.ts` | Delete `DOMAIN_CARD_TYPE` mapping |
| Modify | `src/services/runPoolBuilder.ts` | `assignCardTypes()` with balanced distribution, remove domain→type |
| Modify | `src/data/balance.ts` | Add `SLOW_READER_BONUS = 3`, `WORD_BONUS_THRESHOLD = 10`, `WORD_BONUS_PER_WORDS = 15`, `SPEED_BONUS_THRESHOLD = 0.25`, `TYPE_DISTRIBUTION` |
| Modify | `src/services/turnManager.ts` | Turn 15+ enrage, victory/defeat edge cases, draw pile exhaustion |
| Modify | `src/services/encounterBridge.ts` | Pass question text for dynamic timer calculation |
| Create | `src/services/timerCalculator.ts` | `calculateEffectiveTimer()` pure function |
| Modify | `src/data/types.ts` or `src/services/saveService.ts` | Add `isSlowReader` to player profile (default false) |
| Modify | Tests | Update unit tests for new card play flow, timer calc, type distribution |

## Done When

- [ ] Tapping a card in hand shows ONLY the front (mechanic, value, stars, domain tint) — NO question visible
- [ ] Cast button appears below selected card; tapping Cast locks the card and reveals question + answers + timer
- [ ] Cannot deselect/cancel after tapping Cast — must answer or auto-fizzle on timer expiry
- [ ] Dynamic timer = floor base + word bonus + slow reader bonus (verified with 8-word, 25-word, 40-word questions)
- [ ] Speed bonus triggers at 25% of effective timer (not base timer)
- [ ] `DOMAIN_CARD_TYPE` mapping deleted; no references remain in codebase
- [ ] Run pool assigns types from balanced distribution: ~30% attack, ~25% shield, ~15% heal, ~10% buff, ~8% debuff, ~7% utility, ~3% regen, ~2% wild
- [ ] Same domain's facts can have different card types (e.g., 2 Science facts: one Attack, one Shield)
- [ ] End Turn button always visible during player turn, shows AP remaining, disabled during commit/answer
- [ ] Auto-end-turn triggers 500ms after AP reaches 0
- [ ] Turn 15+ enrage: enemy damage increases by +3 per turn past 14
- [ ] Draw pile exhaustion: discard reshuffles into draw pile; empty draw+discard = draw 0 cards
- [ ] `npx vitest run` passes (update/add tests for new flow)
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
