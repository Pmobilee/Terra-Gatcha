# Combat Improvements — Fact-Card Shuffling + Encounter Cooldown + Variant Expansion

**Priority:** HOTFIX — implement immediately
**Applies to:** All existing cards (knowledge AND vocabulary)
**Estimated effort:** Small-Medium (1-2 days)

---

## Overview

Three changes based on playtesting feedback:

1. **Fact-Card Shuffling per Draw** — Decouple facts from card slots each time a hand is drawn. Card TYPE+MECHANIC stays fixed in the deck, but which FACT goes on which card changes every draw.
2. **Encounter Cooldown** — Facts that were just answered cannot reappear for 3 encounters.
3. **Variant Expansion for Knowledge Facts** — Increase minimum question variants from 2 to 4 (target 6-8), add negative/context variant types. Vocab cards are excluded — their forward/reverse/fill-blank system is sufficient.

---

## Change 1: Fact-Card Shuffling per Draw

### Problem
Currently, `buildRunPool()` in `src/services/runPoolBuilder.ts` permanently pairs each fact with a card type+mechanic for the entire run. If a player knows a fact that happened to land on Heavy Strike (14 damage), they have a guaranteed nuke every time that card appears. Conversely, unknown facts on weak cards feel wasted. The mapping is luck-based and reduces strategic depth.

### Solution
Separate the deck into two parallel tracks: **card slots** (type + mechanic + base effect) and **facts** (the questions to answer). Each draw pairs them randomly.

### Files to Modify

**`src/services/deckManager.ts`** — `drawHand()` function (lines 52-91)

Current behavior: draws specific `Card` objects from `drawPile` into `hand`.

New behavior:
1. Draw N card SLOTS from the draw pile (these have type, mechanic, baseEffectValue, effectMultiplier — but factId is temporary)
2. Draw N FACTS from a separate fact queue (shuffled pool of all run facts not on cooldown)
3. Randomly pair each slot with a fact
4. The Card objects in `hand` now have fresh fact assignments each draw

**`src/data/card-types.ts`** — `CardRunState` interface (lines 52-77)

Add a new field to track the fact pool separately:
```typescript
/** Pool of fact IDs available for assignment to card slots this encounter */
factPool: string[];
/** Facts currently on cooldown (recently answered) — see Change 2 */
factCooldown: { factId: string; encountersRemaining: number }[];
```

**`src/services/runPoolBuilder.ts`** — `buildRunPool()` function (lines 91-163)

After building the pool:
1. Still call `assignTypesToCards()` and `applyMechanics()` to create card SLOTS
2. Store the fact IDs separately in `CardRunState.factPool`
3. The initial `drawPile` contains card slots with placeholder factIds
4. Actual fact assignment happens in `drawHand()` at draw time

### Implementation Detail

In `drawHand()`, after drawing card slots from the draw pile:

```typescript
// 1. Get available facts (not on cooldown)
const availableFacts = deck.factPool.filter(
  fId => !deck.factCooldown.some(c => c.factId === fId)
);

// 2. Shuffle available facts
const shuffledFacts = shuffle(availableFacts);

// 3. Pair each drawn card slot with a random fact
for (let i = 0; i < hand.length; i++) {
  const factId = shuffledFacts[i % shuffledFacts.length];
  hand[i].factId = factId;
  // Recalculate tier-based multiplier for this fact
  hand[i].tier = getCardTier(getReviewState(factId));
  hand[i].effectMultiplier = getTierMultiplier(hand[i].tier);
}
```

### Important: Tier follows the FACT, not the slot

The tier multiplier (1.0x / 1.3x / 1.6x) is derived from FSRS state of the FACT, not the card slot. So when a Tier 2b fact lands on a Strike (base 8), the final damage is 8 × 1.6 = 12.8. When the same fact lands on a Shield (base 6) next draw, it's 6 × 1.6 = 9.6. The tier follows the fact because it represents how well the player KNOWS that fact.

### What this preserves
- Deck building strategy (you chose Attack types → you get Attack cards)
- Archetype weighting (Aggressive deck has more Attacks)
- Type distribution ratios
- Tier power scaling (mastered facts are still stronger)
- FSRS tracking (same facts keep appearing, just on different card types)

### What this changes
- No more "France = my Heavy Strike" memorization
- Every hand is unpredictable (which facts will you face?)
- Can't cherry-pick known facts for your best cards
- All facts in your deck get equal engagement across all card types

---

## Change 2: Encounter Cooldown

### Problem
The same fact can appear in multiple consecutive encounters, leading to one-shotting enemies repeatedly with the same memorized answer. A player reported getting the same oil formation card 4 encounters in a row.

### Solution
Track recently-answered facts and exclude them from the fact pool for 3 encounters.

### Files to Modify

**`src/services/deckManager.ts`** or wherever encounter-end logic lives

After each encounter ends:
```typescript
// Add all facts answered this encounter to cooldown
for (const answeredFactId of encounterAnsweredFacts) {
  deck.factCooldown.push({ factId: answeredFactId, encountersRemaining: 3 });
}

// Decrement cooldown for all existing entries
deck.factCooldown = deck.factCooldown
  .map(c => ({ ...c, encountersRemaining: c.encountersRemaining - 1 }))
  .filter(c => c.encountersRemaining > 0);
```

**`src/services/turnManager.ts`** — Track which facts were answered each encounter

Add tracking:
```typescript
// At encounter start
const encounterAnsweredFacts: string[] = [];

// After each card is played (correct or incorrect)
encounterAnsweredFacts.push(card.factId);
```

### Edge case: Small fact pools
If the cooldown removes too many facts (e.g., player only has 15 facts and answered 5 per encounter × 3 cooldown = 15 on cooldown), fall back gracefully:
- If available facts < hand size (5), reduce cooldown to 1 encounter
- If available facts < 3, disable cooldown entirely for that draw
- Log a warning for analytics: "fact pool exhaustion"

This will naturally resolve as content scales from 122 facts to 10K+.

---

## Change 3: Variant Expansion for Knowledge Facts

### Problem
Knowledge facts currently have 2-3 question variants. When the same fact appears multiple times (even across different encounters), the player quickly memorizes the question format AND the answer. Distractors for knowledge facts can also be obviously wrong (the correct answer is often the longest/most specific option).

### Solution (knowledge facts ONLY — NOT vocabulary)
This is primarily a content/data change, not a code change. But the code needs to support it.

### Files to Modify

**`src/ui/components/CardCombatOverlay.svelte`** — `getQuizForCard()` (lines 239-287)

Current variant system (lines 275-279) only supports 3 variants:
- Variant 0: Standard MCQ (quizQuestion)
- Variant 1: Same as variant 0
- Variant 2: Fill-in-blank

Expand to support up to 8 variants. The variant data should come from the fact itself (fact.variants array), not be hardcoded:

```typescript
function getQuizForCard(card: Card, fact: Fact): QuizData {
  const variants = fact.variants ?? [{ question: fact.quizQuestion, type: 'forward' }];
  const variantCount = variants.length;

  // Pick a variant, avoiding the last one used
  const lastUsed = getReviewState(fact.id)?.lastVariantIndex ?? -1;
  let variantIndex: number;

  if (variantCount <= 1) {
    variantIndex = 0;
  } else {
    // Random, but never repeat the last variant
    do {
      variantIndex = Math.floor(Math.random() * variantCount);
    } while (variantIndex === lastUsed && variantCount > 1);
  }

  const variant = variants[variantIndex];
  // Use variant-specific distractors if available, else fall back to fact.distractors
  const distractors = variant.distractors ?? fact.distractors;
  // ... rest of quiz building
}
```

**`src/data/types.ts`** — Ensure the `Fact` interface supports a `variants` array

Check if `variants` field exists on the Fact type. It should be:
```typescript
interface QuestionVariant {
  question: string;
  type: 'forward' | 'reverse' | 'negative' | 'context' | 'fill_blank' | 'true_false';
  correctAnswer: string;  // May differ from fact.correctAnswer for reverse questions
  distractors?: string[]; // Variant-specific distractors (optional, falls back to fact.distractors)
}
```

### Variant types to support (for content pipeline AR-17):
1. **Forward**: "What causes oil formation?" → [correct answer]
2. **Reverse**: "Heat and pressure on organic matter over millions of years produces..." → [oil / coal / diamonds]
3. **Negative**: "Which is NOT a factor in oil formation?" → [sunlight / pressure / time]
4. **Context**: "Petroleum geologists study the transformation of ancient organic material. This process requires..." → [millions of years / volcanic activity]
5. **Fill-blank**: "Oil is formed from ___ under heat and pressure over millions of years" → [organic matter / volcanic rock]
6. **True/false**: "Oil is formed from volcanic activity under the ocean" → [False]

### Distractor quality requirements (for AR-17 Haiku prompts):
- All answer options MUST be similar length (within 20% character count)
- All options must be similarly specific (no "obviously detailed correct answer" pattern)
- Distractors must be plausible to someone who doesn't know the answer
- For negative variants, the distractors ARE correct facts (the wrong answer is the one that IS true)

### Vocab card exemption
Vocabulary cards (where `fact.type === 'vocabulary'`) are EXCLUDED from variant expansion. Their existing system is sufficient:
- Forward: Show target word → select English meaning
- Reverse: Show English meaning → select target word
- Fill-blank: Sentence with word blanked
These are inherently constrained and don't suffer from the "obviously correct" problem because all options are similar-length words.

---

## Testing Checklist

After implementation:

1. **Fact-card shuffling**:
   - [ ] Start a run, note which facts appear in hand
   - [ ] End turn, draw again — same card TYPES but different FACTS on each
   - [ ] Verify tier multiplier follows the fact (Tier 2b fact on any card type = 1.6x)
   - [ ] Verify deck building still works (Attack-heavy archetype = mostly Attack cards)

2. **Encounter cooldown**:
   - [ ] Answer a fact in encounter 1
   - [ ] Verify that fact does NOT appear in encounters 2, 3, or 4
   - [ ] Verify it CAN appear in encounter 5+
   - [ ] Test with small fact pool (15 facts) — cooldown should reduce gracefully

3. **Variant rotation** (knowledge facts):
   - [ ] Play the same knowledge fact multiple times
   - [ ] Verify different question formats appear (not the same variant twice in a row)
   - [ ] Verify vocab cards still use their existing forward/reverse/fill-blank system

4. **Run all tests**:
   - [ ] `npx vitest run` — all unit tests pass
   - [ ] `npm run typecheck` — no type errors
   - [ ] `npm run build` — builds cleanly

---

## Files Summary

| File | Change |
|------|--------|
| `src/services/deckManager.ts` | Fact-card shuffling in `drawHand()`, cooldown tracking |
| `src/services/runPoolBuilder.ts` | Separate fact pool from card slots |
| `src/data/card-types.ts` | Add `factPool` and `factCooldown` to `CardRunState` |
| `src/services/turnManager.ts` | Track answered facts per encounter |
| `src/ui/components/CardCombatOverlay.svelte` | Support N variants from fact.variants array |
| `src/data/types.ts` | Verify/add `QuestionVariant` interface, `variants` field on Fact |

**Update `docs/GAME_DESIGN.md` and `docs/ARCHITECTURE.md` if your changes affect gameplay, balance, systems, or file structure. Stale docs = bugs.**
