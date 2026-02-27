# Game Design Document — Terra Miner (a.k.a. Terra-Gacha)

Mining roguelite meets knowledge game. Dig deep, discover artifacts, learn real facts, grow your Knowledge Tree.

## Core Fantasy

A lone miner crash-lands on a far-future Earth. The surface is barren — unrecognizable. Underground lies everything that once was: minerals formed over millennia, and **artifacts** — compressed fragments of humanity's lost knowledge. The miner must dig to survive, rebuild a dome habitat, bring fossilized creatures back to life, and piece together what Earth once was — one fact at a time.

## Design Pillars

1. **Addictive learning** — The primary goal. Every system must make acquiring knowledge feel rewarding, never tedious. Players should *want* to learn more, not feel forced.
2. **Roguelite replayability** — Every dive is unique. Procedural generation, random loot, in-run upgrades, and risk/reward depth layers ensure no two runs are alike.
3. **Gacha dopamine** — Artifact reveals, rarity tiers, fossil pet synthesis, and loot moments create anticipation and payoff ("terra-gacha").
4. **Meaningful progression** — Knowledge Tree grows permanently. Base expands. Pets come alive. The player's world reflects what they've learned.

## High-Level Game Loop

```
[Daily Login]
    → Receive time-gated oxygen (fuel)
    → Optional: morning quiz for bonus oxygen
    → Optional: review due facts for bonus oxygen

[Dive Preparation]
    → Choose oxygen allocation (short/medium/long dive)
    → Equip starting gear (limited permanent upgrades)
    → Enter the mine

[The Dive — Roguelite Run]
    → Mine blocks in any direction (Motherload-style 2D cross-section)
    → Find mineral nodes → loot fills Tetris-style backpack
    → Find artifact nodes → unknown rarity, takes backpack space
    → Find in-run upgrades (pickaxes, scanners, backpack expansions, oxygen tanks)
    → Hit quiz gates → correct answers = proceed, wrong = oxygen cost
    → Decision points: go deeper (no return) for better loot, or surface safely
    → If oxygen runs out → pulled to surface, DROP RANDOM LOOT

[Back at Base — The Dome]
    → Deposit minerals → spend at Materializer (crafting station)
    → Ingest artifacts into Miner's Computer → reveal facts
    → Choose: keep facts for study rotation OR sell for minerals
    → Review due facts (Anki-style spaced repetition)
    → Manage Knowledge Tree (watch it grow, see categories fill)
    → Tend to farm/zoo (fossilized animals brought to life)
    → Visit shop, buy cosmetics, plan next dive
```

## Platform & Controls

- **Primary**: Mobile (Android first, iOS second) via Capacitor
- **Secondary**: Web browser (desktop & mobile)
- **Orientation**: Portrait preferred
- **Controls**:
  - Tap blocks to mine (multiple taps for harder blocks)
  - Swipe in four directions for movement/mining
  - Touch-optimized UI for all menus and quiz overlays

## Visual Style

- 2D pixel art (power-of-2 dimensions: 16x16, 32x32, 64x64)
- Dark underground palette with glowing minerals and artifacts
- Retro RPG-inspired UI
- Particle effects for mining, discovery, and gacha reveals
- Achievement paintings: pixel art versions of real paintings/posters related to knowledge categories

## Audio (Future)

- Chiptune/lo-fi soundtrack
- Satisfying mining sound effects (varied by block type)
- Gacha reveal fanfares (escalating by rarity)
- Quiz feedback sounds (correct/wrong)
- Ambient underground atmosphere

## Monetization

- **Free to play, free to learn** — no knowledge is paywalled
- **Oxygen refills over time** — play for free with patience
- **Subscription**: Unlimited oxygen for unlimited play
- **Premium Materializer**: Special crafting station; limited free materials can be found during play, but not enough for everything. Cosmetics, special pets, decorations
- **Top players who ace quizzes can earn enough bonus oxygen to play indefinitely** — skill and knowledge mastery = free unlimited play
- **Philosophy**: The goal is to make learning addictive, not to maximize revenue

## Target Audience

- Anyone who is curious
- No specific age range — content scales from "fun facts" to deep knowledge
- Casual players (daily 5-minute dives), dedicated players (long study sessions)
- Trivia enthusiasts, lifelong learners, students

## Onboarding — The First 5 Minutes

The crash-landing is the perfect tutorial. Here's the flow:

1. **Crash cutscene** (pixel art, ~30 seconds) — ship plummets, screen shakes, dust settles
2. **Crawl out of wreckage** — find basic pickaxe in the debris
3. **Mine first few blocks** — teach tap/swipe controls naturally (soft blocks, instant break)
4. **Find first artifact** — teach the backpack system, see the artifact glow and category hint
5. **Find a fossil** — the hook moment. Player sees: "Looks like some sort of feline type?" / "Seems canine..." / etc. Player chooses which animal type interests them.
6. **Surface with loot** — see the empty dome, plant the Knowledge Tree seed
7. **Ingest the artifact** — first gacha reveal, first fact learned (guaranteed to be a fascinating one)
8. **See the fossil unlock path** — "Learn 10 facts about [chosen animal type] to revive this creature!" — immediately gives the player a clear, exciting goal
9. **Optional**: Quick, friendly introduction to the review system ("Facts you learn will be quizzed to help you remember them. Want a quick tour?")

**Key design rules for onboarding:**
- First artifact should be guaranteed **Rare or better** — hook them with a mind-blowing fact
- First fossil gives the player an immediate emotional goal (bring this animal to life!)
- The Knowledge Tree seed being planted is a powerful "this will grow with me" moment
- Tutorial should take < 5 minutes and feel like gameplay, not instructions

## System References

Detailed design for each system lives in its own doc:

| System | Document |
|---|---|
| Dive mechanics, layers, oxygen, roguelite systems | `docs/ROGUELITE_RUNS.md` |
| Artifacts, facts, Anki algorithm, Knowledge Tree | `docs/KNOWLEDGE_SYSTEM.md` |
| Minerals, currency, crafting, economy sinks | `docs/ECONOMY.md` |
| Architecture and data flow | `docs/ARCHITECTURE.md` |
| Technical decisions | `docs/DECISIONS.md` |
| Security | `docs/SECURITY.md` |
| Sprite pipeline | `docs/SPRITE_PIPELINE.md` |
| Open design questions | `docs/OPEN_QUESTIONS.md` |
