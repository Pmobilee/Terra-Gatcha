# AR-10: Calibration & Cold Start Resolution (finishes AR-04)
> Phase: Core Gameplay — Player Progression
> Priority: HIGH
> Depends on: AR-02 (FSRS Migration), AR-04 (Onboarding)
> Estimated scope: S-M

AR-04 introduced the Calibration Deep Scan but left a blocker: **"How quickly can a player reach higher tiers and what does 'early run boost' mean?"** This phase resolves that design decision by implementing accelerated FSRS gains during early runs and probe-fact loading to surface learning opportunities at the right pace. Players who perform well early are rewarded with faster progression toward mastery.

## Design Reference

From GAME_DESIGN.md Section 14 (Calibration Deep Scan) — BLOCKED:

> After first run, optional 20-question rapid placement test. Correct → facts start at Tier 2a.
> **BLOCKER: What is "early run boost" and how much faster do facts advance to Tier 2+?**

From GAME_DESIGN.md Section 2 (Tier Progression):

> Tiers: 1, 2a, 2b, 3. Determined by stability (FSRS). Stability increases on correct answers. Tier 2a ≥ 5d. Tier 2b ≥ 10d. Tier 3 ≥ 25d.

From GAME_DESIGN.md Section 28 (Optional: Early Run Boosts):

> **DECISION DD-V2-087:** During runs 1-3 per domain:
> - Correct answer + fast response (< 50% of timer) = 2x stability gain (2 days added instead of 1)
> - Run accuracy ≥ 80% = flat +2d stability bonus to ALL correctly answered facts
> - First correct on new fact starts at 2d stability instead of 1d
>
> This accelerates progression from Tier 1 → Tier 2 in early runs while preserving learning. Expert players are NOT punished; casual players still learn at their own pace.

## Implementation

### Sub-task 1: Early Run Boost in FSRS Scheduler

#### Logic

Modify `src/services/fsrsScheduler.ts`:

```typescript
export interface FSRSUpdateParams {
  factId: string;
  correct: boolean;
  responseTimeMs: number;
  currentStability: number;
  runNumber: number;  // Which run # for this domain (1, 2, 3, ...)
  domain: string;
  earlyBoostActive: boolean;  // Feature flag, true during runs 1-3 per domain
}

export function updateFactStability(
  params: FSRSUpdateParams,
  previousState: PlayerFactState
): PlayerFactState {
  let stabilityGain = 1;  // Base: 1 day per correct answer

  // BOOST 1: Early run bonus (runs 1-3 per domain)
  if (params.earlyBoostActive && params.correct && params.runNumber <= 3) {
    const timerMax = getTimerForDifficulty(params.domain);
    const responseTimeThreshold = timerMax * 0.5;  // 50% of timer

    if (params.responseTimeMs < responseTimeThreshold) {
      // Fast response: 2x stability gain instead of 1
      stabilityGain = 2;
    }
  }

  // BOOST 2: First-time correct starts higher
  if (params.correct && previousState.consecutiveCorrect === 0 && previousState.stability <= 1) {
    // New fact being learned for first time
    stabilityGain = Math.max(stabilityGain, 2);  // Minimum 2 days
  }

  // BOOST 3: High run accuracy (80%+)
  // Applied separately in runCompletion handler (see Sub-task 2)

  const newStability = params.correct
    ? previousState.stability + stabilityGain
    : Math.max(0.5, previousState.stability * 0.5);  // Wrong: halve stability (FSRS standard)

  return {
    ...previousState,
    stability: newStability,
    consecutiveCorrect: params.correct ? previousState.consecutiveCorrect + 1 : 0,
    lastReviewedAt: new Date().toISOString(),
    reviewCount: previousState.reviewCount + 1,
  };
}
```

#### Determine Run Number Per Domain

Track how many times player has played each domain:

```typescript
// In playerProfile
interface PlayerProfile {
  // ... existing fields
  domainRunCounts: Record<string, number>;  // e.g., { 'biology': 3, 'history': 1 }
}

export function getRunNumberForDomain(profile: PlayerProfile, domain: string): number {
  return (profile.domainRunCounts[domain] ?? 0) + 1;  // 1-indexed
}

export function incrementDomainRunCount(profile: PlayerProfile, domain: string): PlayerProfile {
  return {
    ...profile,
    domainRunCounts: {
      ...profile.domainRunCounts,
      [domain]: (profile.domainRunCounts[domain] ?? 0) + 1,
    },
  };
}

export function isEarlyBoostActive(profile: PlayerProfile, domain: string): boolean {
  const runNumber = getRunNumberForDomain(profile, domain);
  return runNumber <= 3;
}
```

### Sub-task 2: Run Accuracy Bonus

After run completes, check accuracy and apply flat bonus:

```typescript
// In src/services/gameFlowController.ts or turnManager.ts

export function applyRunCompletionBonuses(
  runState: CardRunState,
  playerFactStates: Map<string, PlayerFactState>
): {
  updatedFactStates: Map<string, PlayerFactState>;
  bonusApplied: boolean;
  accuracyPercent: number;
} {
  const totalAnswers = runState.correctAnswers + runState.incorrectAnswers;
  if (totalAnswers === 0) return { updatedFactStates: playerFactStates, bonusApplied: false, accuracyPercent: 0 };

  const accuracyPercent = (runState.correctAnswers / totalAnswers) * 100;
  const bonusApplied = accuracyPercent >= 80;

  if (!bonusApplied) {
    return { updatedFactStates: playerFactStates, bonusApplied: false, accuracyPercent };
  }

  // Apply +2d stability to all facts answered correctly in this run
  const correctedFactIds = runState.factsAnsweredCorrectly;  // Set of fact IDs
  const updated = new Map(playerFactStates);

  for (const factId of correctedFactIds) {
    const state = updated.get(factId);
    if (state) {
      updated.set(factId, {
        ...state,
        stability: state.stability + 2,  // Flat +2 days bonus
      });
    }
  }

  return { updatedFactStates: updated, bonusApplied: true, accuracyPercent };
}
```

Track correctly answered facts in run:

```typescript
// In CardRunState
interface CardRunState {
  // ... existing fields
  factsAnsweredCorrectly: Set<string>;  // Fact IDs answered correctly this run
  factsAnsweredIncorrectly: Set<string>;  // Fact IDs answered incorrectly
}

// In turnManager, when answering a question:
function recordAnswer(fact: Fact, isCorrect: boolean, runState: CardRunState): CardRunState {
  if (isCorrect) {
    runState.factsAnsweredCorrectly.add(fact.id);
  } else {
    runState.factsAnsweredIncorrectly.add(fact.id);
  }
  return runState;
}
```

### Sub-task 3: Probe Fact Loading (Optional)

#### Problem

Early runs should expose diverse-difficulty facts to calibrate player skill. Currently, facts are drawn uniformly random. With 10K+ facts, a random draw may hit easy facts 5 times in a row, not surfacing challenge until later.

#### Solution: Probe Deck

During first run per domain, front-load a "probe" pool:

```typescript
// In src/services/runPoolBuilder.ts

export function buildProbePool(
  facts: Fact[],
  domain: string,
  playerFactStates: Map<string, PlayerFactState>
): Fact[] {
  // Curate a pool of 10 facts spanning difficulties: 3 easy, 3 medium, 3 hard, 1 wildcard
  const difficulties = ['1', '2', '3'];
  const probe: Fact[] = [];

  for (const diff of difficulties) {
    const matchingFacts = facts.filter(
      f => f.domain === domain && f.difficulty === diff
    );
    // Pick 3 random from difficulty band
    const selected = shuffleArray(matchingFacts).slice(0, 3);
    probe.push(...selected);
  }

  // Add 1 wildcard (interesting fact player might not know)
  const wildcard = facts.filter(f => f.domain === domain)
    .sort(() => Math.random() - 0.5)[0];
  probe.push(wildcard);

  return probe.slice(0, 10);  // Return 10 total
}

export function buildInitialPool(
  allFacts: Fact[],
  runNumber: number,
  domain: string,
  playerFactStates: Map<string, PlayerFactState>
): Fact[] {
  if (runNumber === 1) {
    // First run: use probe pool, then fall back to random
    const probe = buildProbePool(allFacts, domain, playerFactStates);
    const remaining = allFacts.filter(f => !probe.includes(f));
    return [...probe, ...shuffleArray(remaining)];
  } else {
    // Subsequent runs: standard random shuffle
    return shuffleArray(allFacts.filter(f => f.domain === domain));
  }
}
```

This is OPTIONAL in AR-10. Can be deferred if time is tight.

### Sub-task 4: Update Save/Resume

Ensure `domainRunCounts` persists:

```typescript
// In src/services/saveService.ts

export async function savePlayerProfile(profile: PlayerProfile): Promise<void> {
  const data = {
    // ... existing fields
    domainRunCounts: profile.domainRunCounts,
  };
  await preferences.set({ key: 'playerProfile', value: JSON.stringify(data) });
}

export async function loadPlayerProfile(): Promise<PlayerProfile> {
  const stored = await preferences.get({ key: 'playerProfile' });
  const data = stored?.value ? JSON.parse(stored.value) : {};
  return {
    // ... defaults
    domainRunCounts: data.domainRunCounts ?? {},
  };
}
```

### Sub-task 5: Integrate into Turn Resolution

When player answers a question correctly:

1. Get run number for domain: `runNum = getRunNumberForDomain(profile, domain)`
2. Check early boost: `boostActive = isEarlyBoostActive(profile, domain)`  [Boolean]
3. Call updateFactStability with `runNumber` and `earlyBoostActive`
4. Log: "Fact stability: 1d → 3d (early boost +2)" when boost applies
5. On run end, call applyRunCompletionBonuses

### Sub-task 6: UI Feedback (Optional)

Show visual feedback when early boost triggers:

```
[Correct!] ✓

Fact Stability: 1d → 3d (Early Run Boost +1)
```

Or in profile screen:
```
Runs per Domain:
  • Biology: 2 runs (early boost active)
  • History: 4 runs (early boost ended)
  • General: 1 run (early boost active)
```

## System Interactions

- **FSRS (AR-02):** Early boost modifies stability gain in FSRS scheduler. Tier derivation unchanged.
- **Difficulty Modes (AR-04):** Boost applies across all modes (Explorer, Standard, Scholar).
- **Domains (AR-03):** Run count tracked per domain. Boost activates independently for each domain.
- **Combos (AR-03):** Early boost does not interact with combo system.
- **Relics (AR-06):** Early boost independent of relics.
- **Card Rewards (AR-09):** No interaction. Type selection unaffected.
- **Calibration Scan (AR-04):** This phase completes the calibration blocker.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Player plays biology domain 3 times, then returns to it | Early boost deactivated for biology. boost stays active for other domains. |
| Player answers quickly (< 50% timer) but incorrectly | No stability gain (wrong answer). Speed bonus is only for correct + fast. |
| Player plays 3 runs of biology, never learns any facts (all wrong) | Boost ends after run 3. Subsequent biology runs show no boost (valid). |
| Player achieves 80% accuracy but early boost was not active (run 4+) | Run bonus applies (80% → +2d). Early boost separate from run bonus. |
| Player in Scholar mode (harder timer) plays fast | Timer difficulty accounted in responseTime threshold calculation. Valid. |
| Echo card answered correctly in run 4 (no early boost) | Standard 1-day stability gain. No boost. |
| New game+ (restart) | domainRunCounts reset. Early boost reactivates for all domains. |
| Player answers fact for 2nd time ever in run 3 of domain | If first-time correct: 2d stability minimum. If repeat: standard gain. |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Modify | `src/services/fsrsScheduler.ts` | Add FSRSUpdateParams.earlyBoostActive, updateFactStability applies 2x gain |
| Modify | `src/services/gameFlowController.ts` | applyRunCompletionBonuses, track factsAnsweredCorrectly |
| Modify | `src/data/types.ts` | Add domainRunCounts to PlayerProfile, factsAnsweredCorrectly to CardRunState |
| Create | `src/services/runEarlyBoostController.ts` | getRunNumberForDomain, incrementDomainRunCount, isEarlyBoostActive |
| Create | `src/services/runPoolBuilder.ts` | buildProbePool (optional), buildInitialPool |
| Modify | `src/services/turnManager.ts` | Record correct/incorrect facts during turn resolution, pass earlyBoostActive to FSRS |
| Modify | `src/services/saveService.ts` | Persist domainRunCounts in player profile |
| Modify | `src/ui/components/CardCombatOverlay.svelte` | Optional: show "Early Boost +1" when boost triggers |
| Modify | `src/ui/screens/Profile.svelte` | Optional: show "Runs per Domain" with boost status |

## Done When

- [ ] domainRunCounts tracked in playerProfile (1-indexed, persists)
- [ ] isEarlyBoostActive returns true for runs 1-3 per domain
- [ ] Correct + fast (< 50% timer) during early boost = 2x stability gain (2d instead of 1d)
- [ ] Run accuracy ≥ 80% applies flat +2d bonus to all correctly-answered facts
- [ ] First-time correct fact starts at minimum 2d stability (not 1d)
- [ ] Probe pool (optional) loads 10 diverse-difficulty facts in run 1 per domain
- [ ] domainRunCounts persists across app close/reopen
- [ ] incrementDomainRunCount called at run start
- [ ] Early boost ends after 3 runs per domain (run 4+ shows no boost)
- [ ] All three boosts stack: early run +2, first-time +2, accuracy bonus +2 can all apply
- [ ] FSRS integration: updateFactStability receives early boost flag and applies correctly
- [ ] Optional UI feedback shows when boost triggers (can be added in AR-13 or later)
- [ ] `npx vitest run` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
