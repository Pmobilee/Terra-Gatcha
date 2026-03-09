# AR-02: Spaced Repetition Upgrade (FSRS)
> Phase: Pre-Launch — Learning Engine
> Priority: HIGH
> Depends on: AR-01 (Combat Integrity — for timer/tier changes)
> Estimated scope: L

Replace SM-2 with FSRS (Free Spaced Repetition Scheduler) for better scheduling at scale. SM-2 was adequate for the prototype but FSRS outperforms it on 350M+ review benchmarks and tracks difficulty, stability, and retrievability natively — enabling better tier derivation, canary system inputs, and knowledge library analytics. Also implement question variant rotation to prevent same-format repetition.

## Design Reference

From GAME_DESIGN.md Section 26 (FSRS Integration):

> FSRS replaced SM-2 as Anki default 2023. Tracks Difficulty (1-10), Stability (days), Retrievability (0-1). `ts-fsrs` npm package.
>
> Tier derivation:
> - stability <5d = Tier 1
> - stability 5-15d + 3+ correct = Tier 2a
> - stability 15-30d + 5+ correct = Tier 2b
> - stability 30d+ + 7 consecutive correct + passed mastery trial = Tier 3

From GAME_DESIGN.md Section 26 (PlayerFactState):

> ```typescript
> interface PlayerFactState {
>   factId: string;
>   difficulty: number;           // 1-10
>   stability: number;            // Days of memory stability
>   retrievability: number;       // 0-1, current recall probability
>   consecutiveCorrect: number;
>   nextReviewDate: Date;
>   lastReviewDate: Date;
>   passedMasteryTrial: boolean;
>   lastVariantIndex: number;
>   totalAttempts: number;
>   totalCorrect: number;
>   averageResponseTimeMs: number;
> }
> ```

From GAME_DESIGN.md Section 4 (Question Format Rotation):

> The same fact presents differently each appearance. Each fact needs 2-4 question variants. System tracks `lastVariantIndex` per fact and never repeats the same format consecutively.

From GAME_DESIGN.md Section 5 (Tier Derivation):

> ```typescript
> function getCardTier(state: PlayerFactState): '1' | '2a' | '2b' | '3' {
>   if (state.stability >= 30 && state.consecutiveCorrect >= 7 && state.passedMasteryTrial) return '3';
>   if (state.stability >= 15 && state.consecutiveCorrect >= 5) return '2b';
>   if (state.stability >= 5 && state.consecutiveCorrect >= 3) return '2a';
>   return '1';
> }
> ```

## Implementation

### Data Model

#### New `PlayerFactState` interface (replaces `ReviewState`)

In `src/data/types.ts` or new `src/data/player-fact-state.ts`:

```typescript
import type { Grade, RecordLog } from 'ts-fsrs';

interface PlayerFactState {
  factId: string;

  // FSRS core fields (from ts-fsrs Card object)
  difficulty: number;           // 1-10 (FSRS native)
  stability: number;            // Days of memory stability
  retrievability: number;       // 0-1, current recall probability
  state: 'new' | 'learning' | 'review' | 'relearning';  // FSRS card state
  reps: number;                 // Total successful reviews
  lapses: number;               // Times forgotten after learning
  due: number;                  // Unix timestamp ms for next review
  lastReview: number;           // Unix timestamp ms of last review

  // Game-specific fields
  consecutiveCorrect: number;   // For tier derivation
  passedMasteryTrial: boolean;  // True after passing mastery trial
  graduatedRelicId: string | null;  // Relic ID from tier 3 graduation

  // Variant tracking
  lastVariantIndex: number;     // Index of last question variant used

  // Analytics
  totalAttempts: number;
  totalCorrect: number;
  averageResponseTimeMs: number;
  masteredAt: number;           // Unix timestamp ms when reached Tier 3 (0 if not)
}
```

#### Migration mapping from `ReviewState` → `PlayerFactState`

```typescript
function migrateReviewState(old: ReviewState): PlayerFactState {
  return {
    factId: old.factId,
    difficulty: mapEaseToFSRSDifficulty(old.easeFactor),  // 2.5 ease → ~5 difficulty
    stability: old.interval,  // SM-2 interval ≈ stability in days
    retrievability: old.retrievability ?? 0.9,
    state: mapCardState(old.cardState),
    reps: old.repetitions,
    lapses: old.lapseCount,
    due: old.nextReviewAt,
    lastReview: Date.now(),
    consecutiveCorrect: old.consecutiveCorrect,
    passedMasteryTrial: old.passedMasteryTrial,
    graduatedRelicId: old.graduatedRelicId ?? null,
    lastVariantIndex: 0,
    totalAttempts: 0,
    totalCorrect: 0,
    averageResponseTimeMs: 0,
    masteredAt: old.masteredAt ?? 0,
  };
}

function mapEaseToFSRSDifficulty(ease: number): number {
  // SM-2 ease 1.3-2.5 → FSRS difficulty 1-10 (inverted scale)
  // ease 2.5 (easy) → difficulty 1, ease 1.3 (hard) → difficulty 10
  return Math.round(Math.max(1, Math.min(10, 11 - (ease - 1.3) * (9 / 1.2))));
}

function mapCardState(state: string): 'new' | 'learning' | 'review' | 'relearning' {
  if (state === 'suspended') return 'review';  // Treat suspended as review
  return state as any;
}
```

### Logic

#### New `fsrsScheduler.ts` (replaces `sm2.ts`)

```typescript
import { createEmptyCard, fsrs, generatorParameters, type Card as FSRSCard, type Grade, Rating } from 'ts-fsrs';

const params = generatorParameters({ enable_fuzz: true });
const scheduler = fsrs(params);

export function createFactState(factId: string): PlayerFactState {
  const emptyCard = createEmptyCard();
  return {
    factId,
    difficulty: 5,  // Medium default
    stability: 0,
    retrievability: 0,
    state: 'new',
    reps: 0,
    lapses: 0,
    due: Date.now(),
    lastReview: 0,
    consecutiveCorrect: 0,
    passedMasteryTrial: false,
    graduatedRelicId: null,
    lastVariantIndex: -1,
    totalAttempts: 0,
    totalCorrect: 0,
    averageResponseTimeMs: 0,
    masteredAt: 0,
  };
}

export function reviewFact(
  state: PlayerFactState,
  correct: boolean,
  responseTimeMs: number
): PlayerFactState {
  const fsrsCard: FSRSCard = stateToFSRSCard(state);
  const grade: Grade = correct ? Rating.Good : Rating.Again;
  const now = new Date();

  const result = scheduler.repeat(fsrsCard, now);
  const scheduled = result[grade];

  const newState: PlayerFactState = {
    ...state,
    difficulty: scheduled.card.difficulty,
    stability: scheduled.card.stability,
    retrievability: calculateRetrievability(scheduled.card),
    state: mapFSRSState(scheduled.card.state),
    reps: scheduled.card.reps,
    lapses: scheduled.card.lapses,
    due: scheduled.card.due.getTime(),
    lastReview: now.getTime(),
    consecutiveCorrect: correct ? state.consecutiveCorrect + 1 : 0,
    totalAttempts: state.totalAttempts + 1,
    totalCorrect: state.totalCorrect + (correct ? 1 : 0),
    averageResponseTimeMs: updateAvgResponseTime(state, responseTimeMs),
  };

  return newState;
}

export function isDue(state: PlayerFactState): boolean {
  return state.due <= Date.now();
}

export function getCardTier(state: PlayerFactState): '1' | '2a' | '2b' | '3' {
  if (state.stability >= 30 && state.consecutiveCorrect >= 7 && state.passedMasteryTrial) return '3';
  if (state.stability >= 15 && state.consecutiveCorrect >= 5) return '2b';
  if (state.stability >= 5 && state.consecutiveCorrect >= 3) return '2a';
  return '1';
}

export function isDormant(state: PlayerFactState): boolean {
  return state.retrievability < 0.7;
}

export function getDueForReview(states: PlayerFactState[], limit: number): PlayerFactState[] {
  return states
    .filter(s => isDue(s) && s.state !== 'new')
    .sort((a, b) => a.due - b.due)
    .slice(0, limit);
}

export function getNewFacts(states: PlayerFactState[], limit: number): PlayerFactState[] {
  return states
    .filter(s => s.state === 'new')
    .slice(0, limit);
}

function stateToFSRSCard(state: PlayerFactState): FSRSCard {
  // Map PlayerFactState back to ts-fsrs Card object for scheduling
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.lastReview ? Math.floor((Date.now() - state.lastReview) / 86400000) : 0,
    scheduled_days: 0,
    reps: state.reps,
    lapses: state.lapses,
    state: mapToFSRSState(state.state),
    last_review: state.lastReview ? new Date(state.lastReview) : undefined,
  };
}

function updateAvgResponseTime(state: PlayerFactState, newTime: number): number {
  if (state.totalAttempts === 0) return newTime;
  return Math.round((state.averageResponseTimeMs * state.totalAttempts + newTime) / (state.totalAttempts + 1));
}
```

#### Tier derivation update

In `src/services/tierDerivation.ts` (or modify existing):
- Replace SM-2 interval-based derivation with FSRS stability-based
- Use `getCardTier()` from `fsrsScheduler.ts`
- Thresholds: stability <5d → T1, 5-15d+3correct → T2a, 15-30d+5correct → T2b, 30d+7correct+trial → T3

#### Question variant rotation

In `encounterBridge.ts` or `CardCombatOverlay.svelte` (wherever quiz is built):

```typescript
function selectVariantIndex(fact: Fact, playerState: PlayerFactState): number {
  const variantCount = fact.variants.length;
  if (variantCount <= 1) return 0;

  // Never repeat same variant consecutively
  let index: number;
  do {
    index = Math.floor(Math.random() * variantCount);
  } while (index === playerState.lastVariantIndex && variantCount > 1);

  return index;
}
```

After answering, update `playerState.lastVariantIndex = usedVariantIndex`.

#### Save state migration

In `saveService.ts`:
- On load, detect old `ReviewState[]` format (has `easeFactor` field)
- Run `migrateReviewState()` on each entry
- Save in new `PlayerFactState[]` format
- Version the save format: add `saveVersion: number` field (current = 1, new = 2)

### System Interactions

- **Tier derivation:** Now uses FSRS stability instead of SM-2 interval. Same thresholds but more accurate.
- **Run pool building:** `runPoolBuilder.ts` must accept `PlayerFactState[]` instead of `ReviewState[]`. The `isDue()` and `getCardTier()` calls change to new FSRS versions.
- **Echo mechanic:** `encounterBridge.ts` echo generation uses FSRS `reviewFact()` instead of SM-2 `reviewCard()`. On echo correct: `FSRS_STABILITY_BONUS` of 1.5 applied.
- **Mastery trial:** `isMasteryTrialEligible()` checks FSRS stability ≥ 30 + consecutiveCorrect ≥ 7.
- **Passive relics:** Dormancy check uses `isDormant()` (retrievability < 0.7) from FSRS.
- **Combo system:** No interaction. Combo is turn-level, FSRS is fact-level.
- **Card reward screen:** Tier display on reward cards uses `getCardTier()` from FSRS.
- **Timer system:** No interaction with FSRS.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| First-time player, no save data | All facts start as `state: 'new'`, difficulty 5, stability 0 |
| Player with old SM-2 save data | Auto-migrate on load. ease 2.5 → difficulty ~1, interval → stability |
| Fact with only 1 variant | Always use index 0. No rotation. |
| Fact with 2 variants | Alternate between 0 and 1. Never same twice in a row. |
| FSRS stability exactly 5.0 days | Tier 2a (threshold is ≥5). |
| FSRS stability 29.9 days, 7 correct | Tier 2b (need ≥30 for Tier 3 eligibility). |
| Player answers in 50ms (impossible speed) | Record 50ms. No filtering. Analytics will show outliers. |
| Retrievability drops to 0.69 on mastered fact | Relic goes dormant. Fact re-enters pool as Tier 2a. |
| Retrievability recovers to 0.71 after review | Relic reactivates. |
| ts-fsrs returns unexpected state | Clamp difficulty to 1-10, stability to ≥0. Log warning. |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Create | `src/services/fsrsScheduler.ts` | New FSRS wrapper: createFactState, reviewFact, isDue, getCardTier, isDormant, getDueForReview |
| Modify | `src/data/types.ts` | Add PlayerFactState interface, remove/deprecate ReviewState |
| Modify | `src/services/runPoolBuilder.ts` | Accept PlayerFactState[], use getCardTier() for tier |
| Modify | `src/services/encounterBridge.ts` | Use fsrsScheduler instead of sm2, variant rotation |
| Modify | `src/services/saveService.ts` | Save format v2 migration, PlayerFactState serialization |
| Modify | `src/services/tierDerivation.ts` | Use FSRS stability instead of SM-2 interval |
| Modify | `src/ui/components/CardCombatOverlay.svelte` | Use variant rotation when building quiz |
| Deprecate | `src/services/sm2.ts` | Keep file but add deprecation notice. Remove all imports. |
| Modify | `src/data/balance.ts` | Remove SM2_* constants, add FSRS_* constants if needed |
| Modify | Tests | New tests for FSRS scheduler, tier derivation, variant rotation, migration |

## Done When

- [ ] `ts-fsrs` package installed and imported
- [ ] `PlayerFactState` interface defined with all FSRS fields + game fields + analytics
- [ ] `fsrsScheduler.ts` exports: `createFactState`, `reviewFact`, `isDue`, `getCardTier`, `isDormant`, `getDueForReview`, `getNewFacts`
- [ ] Tier derivation uses FSRS stability: <5d=T1, 5-15d+3correct=T2a, 15-30d+5correct=T2b, 30d+7correct+trial=T3
- [ ] All SM-2 imports replaced with FSRS imports across codebase
- [ ] Save migration: old SM-2 ReviewState auto-converts to PlayerFactState on load
- [ ] Question variant rotation: never same variant index consecutively for facts with 2+ variants
- [ ] `lastVariantIndex` persisted in PlayerFactState and updated after each answer
- [ ] `averageResponseTimeMs` tracked and updated with running average
- [ ] Dormancy: retrievability < 0.7 → relic dormant, fact re-enters active pool
- [ ] `npx vitest run` passes (update/add tests)
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
