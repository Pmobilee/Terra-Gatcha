# Arcane Recall — Implementation Roadmap

> Design source of truth: `docs/GAME_DESIGN.md`
> Card roguelite spec: `docs/RESEARCH/terra-miner-card-roguelite-spec.md`

---

## Current Status

**Playable pre-launch build.** AR-01 through AR-06 implementation work is now in place (combat integrity, FSRS migration, visual integration, onboarding/difficulty, sound+bounties+canary, and library/lore).

**Next up:** close remaining launch gates in AR-07 (native build verification, full E2E coverage, performance audit, dead code cleanup) and ship Calibration Deep Scan from AR-04.

---

## Pre-Launch Phases

### AR-01: Combat Integrity (BLOCKER)
Make combat mechanically correct and educationally sound.

- [x] **Commit-before-reveal flow** — 3-stage: tap card (front only + Cast button) → tap Cast (locked in, question + answers + timer) → answer or auto-fizzle. Prevents preview-cancel exploit that undermines retrieval practice.
- [x] **Dynamic timer** — Base by floor (12s/9s/7s/5s/4s) + 1s per 15 words beyond 10. Slow Reader mode (+3s flat, amber timer bar) set during onboarding.
- [x] **Domain/type decoupling** — Remove `DOMAIN_CARD_TYPE` mapping. RunPoolBuilder assigns types from balanced distribution (~30% attack, ~25% shield, etc.). Domain becomes cosmetic only.
- [x] **End Turn button polish** — Always visible during player turn, shows AP remaining, disabled during commit/answer and enemy turn, auto-end at 0 AP.
- [x] **Encounter edge cases** — Verify/fix: turn 15+ enrage, victory/defeat transitions, run termination on death, draw/discard/reshuffle cycle.

Key files: `CardCombatOverlay.svelte`, `card-types.ts`, `balance.ts`, `turnManager.ts`, `encounterBridge.ts`

---

### AR-02: Spaced Repetition Upgrade
Replace SM-2 with FSRS for better scheduling at scale.

- [x] **FSRS migration** — Install `ts-fsrs`. Build wrapper replacing SM-2. Map: easeFactor → difficulty (1-10), interval → stability (days), add retrievability.
- [x] **Tier derivation from FSRS** — stability <5d = Tier 1, 5-15d = 2a, 15-30d = 2b, 30d+ with 7 consecutive + trial = 3.
- [x] **PlayerFactState** — Full stats: totalAttempts, totalCorrect, averageResponseTimeMs, lastVariantIndex.
- [x] **Question variant rotation** — Track lastVariantIndex per fact. Never repeat same format consecutively.

Key files: `sm2.ts` → new `fsrsScheduler.ts`, `tierDerivation.ts`, `types.ts`, `saveService.ts`
Can partially parallelize with AR-03.

---

### AR-03: Visual Polish + Asset Integration
Wire the 47 generated art assets into the game. Replace all placeholders.

- [x] **Phaser CombatScene sprites** — Player sprites (7 poses), enemy sprites (idle/hit/death per type), boss sprites. Replace colored rectangles.
- [x] **Card frame sprites** — 10 type-specific frames (attack, shield, heal, buff, debuff, utility, regen, wild, echo, back) in hand and expanded views.
- [x] **Background integration** — Combat, title, room selection, rest, shop, treasure backgrounds.
- [x] **Door sprites** — Replace text-based room selection with door sprite buttons.
- [x] **Domain icons** — Wire 9 domain icons into DomainSelection and card display.

Key files: `CombatScene.ts`, `BootScene.ts`, card Svelte components, room overlay components
Can run in parallel with AR-02.

---

### AR-04: Onboarding + Difficulty Modes
New players learn in 60 seconds. All skill levels served.

- [x] **60-second onboarding** — Dungeon entrance, Slow Reader question, first encounter with 2 AP (tutorial), contextual tooltips on first tap/cast/answer/end-turn. Domain selection unlocks on Run 2.
- [x] **Difficulty modes** — Explorer (no timer, wrong=50% effect, enemies -30%), Standard (current), Scholar (-2s/tier, wrong=fizzle+3 self-damage, enemies +20%).
- [ ] **Calibration Deep Scan** — After first run, optional 20-question rapid placement test. Correct answers bump facts to Tier 2a.
- [x] **Hint system** — 1 Scholar's Insight per encounter: remove 1 wrong answer, +5s timer, or reveal first letter.

Depends on: AR-01 + AR-02

---

### AR-05: Sound + Engagement Loops
Audio feedback and daily return reasons.

- [x] **Core sound effects** — Correct/wrong impact, card draw swoosh, enemy hit/death, turn chime, combo escalation sounds. Volume + category toggles.
- [x] **Adventurer's Journal** — Post-run summary: depth, facts answered, accuracy, best combo, mastered count. Share button generates Wordle-style card image.
- [x] **Bounty quests** — 1-2 per run from template pool (5 Science correct, 3 flawless encounters, reach Floor 6, etc.). Bonus rewards.
- [x] **Daily login streak** — 7d/30d/100d/365d milestones with rewards. 1 freeze per week.
- [x] **Canary system** — Invisible adaptive difficulty: 3+ wrong/floor = easier facts + -15% enemy dmg, 5+ correct streak = harder facts + elite variants. Never reduces educational rigor.

---

### AR-06: Knowledge Library + Lore
Make learning progress visible and rewarding.

- [x] **Knowledge Library** — All facts cataloged by domain, filterable by tier/mastery status. Mastery progress bars per domain. Domain completion percentage.
- [x] **Lore Discovery** — At 10/25/50/100 mastered facts, unlock Lore Fragment connecting learned facts. Full-screen presentation with pixel art, sound, share button.
- [x] **Fact detail view** — Tap any fact in Library: all question variants, stats (attempts, accuracy, response time), FSRS state, tier history.

---

### AR-07: Launch Readiness
Everything needed to submit to app stores.

- [ ] **Capacitor build verification** — Android and iOS builds compile and run. Fix safe areas, status bar, keyboard, permissions.
- [x] **Accessibility baseline** — Colorblind support (shapes not just colors), 3 text sizes, high contrast mode, reduce motion option, 48dp+ touch targets verified.
- [ ] **Playwright E2E test suite** — Full run flow, AP system, commit-before-reveal, dynamic timers, card mechanics, FSRS, encounter termination, combo, passive relics, run persistence.
- [ ] **Performance audit** — 60fps combat on mid-range devices, <50KB run state, <3s cold start.
- [ ] **Dead code cleanup** — Remove `src/_archived-mining/`, unused mining-era components, stale data files.
- [x] **App store metadata** — Screenshots, description, privacy policy, age rating (4+ educational).

Current AR-07 status note: initial Playwright smoke specs were added under `tests/e2e/playwright/`, but full launch-coverage suite and native build verification are still open.

### Completed AR Specs Moved
- [x] AR-01 Combat Integrity → `completed/AR-01-COMBAT-INTEGRITY.md`
- [x] AR-02 FSRS Migration → `completed/AR-02-FSRS-MIGRATION.md`
- [x] AR-03 Visual Polish → `completed/AR-03-VISUAL-POLISH.md`
- [x] AR-05 Sound + Engagement → `completed/AR-05-SOUND-ENGAGEMENT.md`
- [x] AR-06 Knowledge Library + Lore → `completed/AR-06-KNOWLEDGE-LIBRARY.md`
- [ ] AR-04 + AR-07 remain active in `phases/` until fully closed.

---

## Post-Launch Phases

### AR-08: Content Expansion + Language Packs
- [ ] Scale facts from 723 to 2000+ with ingestion pipeline
- [ ] Language pack framework (audio, furigana, production cards at Tier 2+)
- [ ] Age gating filter at query level
- [ ] Domain pack IAP ($2.99) and language pack IAP ($4.99)

### AR-09: Competitive + Social
- [ ] Daily Expedition (fixed seed, one attempt/day, leaderboard)
- [ ] Endless Depths (infinite scaling after Floor 9, separate leaderboard)
- [ ] Mastery Challenges (rare Mystery room, 3s timer, 5 distractors, fail = Tier 2b)
- [ ] Relic Sanctum (between-run relic management for >12 mastered)

### AR-10: Monetization + Polish
- [ ] Ad removal IAP ($4.99)
- [ ] Arcane Pass subscription ($4.99/mo — all packs, cosmetics, analytics)
- [ ] Cosmetic store (card backs, frames, dungeon skins, avatars)
- [ ] Sound design pass 2 (per-mechanic sounds, floor themes, boss music)
- [ ] Scholar Challenges (weekly curated runs + leaderboards)

---

## Dependency Graph

```
AR-01 ──┬── AR-02 ──┬── AR-04 → AR-05 → AR-06 → AR-07
        └── AR-03 ──┘                              ↓
                                            AR-08 / AR-09 / AR-10
```

AR-02 and AR-03 can run in parallel after AR-01.

---

## Completed Phases (Historical)

### P0 — Core Prototype
- [x] CR-01 Card Foundation → `completed/CR-01-CARD-FOUNDATION.md`
- [x] CR-02 Encounter Engine → `completed/CR-02-ENCOUNTER-ENGINE.md`
- [x] CR-03 Combat Scene → `completed/CR-03-COMBAT-SCENE.md`
- [x] CR-04 Card Hand UI → `completed/CR-04-CARD-HAND-UI.md`
- [x] CR-05 Game Juice → `completed/CR-05-GAME-JUICE.md`
- [x] CR-06 Knowledge Combo → `completed/CR-06-KNOWLEDGE-COMBO.md`
- [x] CR-07 Room Selection → `completed/CR-07-ROOM-SELECTION.md`

### P1 — First Update
- [x] CR-08 Mastery Tiers → `completed/CR-08-MASTERY-TIERS.md`
- [x] CR-09 Passive Relics → `completed/CR-09-PASSIVE-RELICS.md`
- [x] CR-10 Retreat-or-Delve → `completed/CR-10-RETREAT-OR-DELVE.md`
- [x] CR-11 Remaining Mechanics → `completed/CR-11-REMAINING-MECHANICS.md`
- [x] CR-12 Echo Mechanic → `completed/CR-12-ECHO-MECHANIC.md`
- [x] CR-13 Card Reward Screen → `completed/CR-13-CARD-REWARD-SCREEN.md`

### P1.5 — Art Pipeline + First Asset Pass
- [x] CR-14 NB1 Art Pipeline → `completed/CR-14-NB1-ART-PIPELINE.md`
- [x] CR-15 Background Generation → `completed/CR-15-BACKGROUND-GENERATION.md`
- [x] CR-16 Player Sprites → `completed/CR-16-PLAYER-SPRITES.md`
- [x] CR-17 Enemy Sprites Pass 1 → `completed/CR-17-ENEMY-SPRITES-PASS1.md`
- [x] CR-18 Boss Sprite → `completed/CR-18-BOSS-SPRITE.md`
- [x] CR-19 Card Frames + UI Assets → `completed/CR-19-CARD-FRAMES-UI-ASSETS.md`

### Misc
- [x] CR-FIX-01 Fantasy Theme Rename → `completed/CR-FIX-01-FANTASY-RENAME.md`
