# Open Design Questions — Terra Miner

Unresolved design questions from brainstorming sessions. Organized by system.

## Status Key
- **OPEN**: Not yet discussed or decided
- **LEANING**: Have a direction but not committed
- **DECIDED**: Resolved — documented here briefly, full detail in DECISIONS.md

---

## Gacha System ("Terra-Gacha")

### Q1: What is the primary gacha moment? [DECIDED]
**All of them.** Multiple gacha moments at different scales:
1. Artifact reveal at base (most frequent)
2. Dive reward chest after completing a run
3. Pet synthesis / fossil revival (biggest spectacle)
Each with escalating visual/audio spectacle by rarity.

### Q2: Rarity on containers vs facts? [DECIDED]
**Artifact containers have rarity, not facts.** Facts are knowledge — not inherently rare. The artifact container determines how interesting the contained fact is. Higher rarity artifact = more fascinating/memorable fact.

### Q3: Duplicate facts? [DECIDED]
Multiple options for the player:
- **Trade** with other players (future)
- **Mix** unwanted/duplicate facts at the Materializer → reroll into a new artifact of potentially higher rarity
- **Auto-convert** to minerals for quick currency
- **Mark as "not interesting"** → feeds back into content quality metrics
Also: players can mark facts as "already known" — system will quiz them periodically, must prove they know it.

### Q4: Gacha reveal ceremony [DECIDED]
Escalating spectacle by rarity. Common = quick shimmer. Mythic = full-screen unique animation. Details in KNOWLEDGE_SYSTEM.md.

---

## Oxygen Mechanics

### Q5: How does oxygen deplete? [DECIDED]
**Per-action only. No real-time pressure.** Each mine tap, movement, quiz attempt, and hazard encounter costs oxygen. Players can sit and think as long as they want. This is a learning game — never rush the player.

### Q6: Does the oxygen timer pause during quizzes? [DECIDED → N/A]
No timer exists. Oxygen is per-action only, so quizzes have zero time pressure by design.

### Q7: What percentage of loot is dropped on oxygen depletion? [OPEN — CRITICAL]
**This is one of the most important balance decisions in the game.** Needs dedicated research and playtesting.

Options still on the table:
- a) Random 50% of inventory
- b) Lose everything except 1-2 items of your choice
- c) Scaling: lose more the deeper you were when you ran out
- d) Random items fall out one by one as you're pulled up (dramatic!)
- e) Keep your best items, lose the chaff

**Research needed**: Look at how Hades, Dead Cells, Spelunky, and other roguelites handle failure penalties. The sweet spot is: painful enough to create tension, forgiving enough to not kill motivation. This MUST be playtested extensively.

### Q7b: Layer oxygen recovery [DECIDED]
When descending to a new layer (point of no return), the player receives a small oxygen bonus. This makes the risk of going deeper more palatable — there's an immediate reward for committing.

---

## Layer Design

### Q8: How many layers per run? [OPEN]
Needs help deciding. Considerations:
- Too few (2-3): Not enough decision points, runs feel samey
- Too many (15+): Runs feel long, layer transitions lose meaning
- **Current leaning**: 5 layers feels right as a starting point (matches the 5 depth zones in ROGUELITE_RUNS.md). Tunable.
- Different fuel amounts should make different layer counts reachable (1 fuel = layers 1-2, 2 fuel = layers 1-3, 3 fuel = layers 1-4, exceptional play = layer 5)

### Q9: How do layer transitions work visually/mechanically? [OPEN]
- a) Find a shaft/cavern entrance, choose to descend
- b) Hit a certain depth and the biome just changes
- c) Clear all blocks in a layer to reveal the entrance to the next
- d) Boss/challenge gate between layers

---

## In-Run Upgrades

### Q10: Should in-run upgrades ever persist? [DECIDED: No]
All in-run upgrades are lost after every run. No exceptions. This is core to the roguelite feel.

### Q11: How are in-run upgrades presented? [LEANING]
**Binding of Isaac-style passive relics** are the primary upgrade type. Found in crates, behind quiz gates, or from special blocks. Auto-apply as passive buffs. May also include tool swaps and consumables. The key is that players build a unique combination each run, and discovering synergies is part of the fun.

---

## Fossilized Animals & Pets

### Q12: Should reviving animals require learning facts first? [DECIDED: Yes]
**Yes!** Reviving an animal requires:
1. Finding the fossil
2. Learning X facts in the related knowledge category
3. Spending minerals at the Materializer

This ties the Knowledge Tree directly to base progression and gives players a reason to keep (not sell) related artifacts.

### Q13: What do pets do? [DECIDED: All of the above]
Pets serve multiple roles (implemented progressively):
- Phase 1: Cosmetic dome companions
- Phase 2: Dive companions (carry items, sniff artifacts, alert hazards)
- Phase 3: Farm producers (passive resources)

### Q14: How many pet species at launch? [OPEN]
Need to balance content creation effort with collection depth. Consider:
- 5-10 species for MVP (one per major knowledge category?)
- First pet is chosen during onboarding (feline/canine/etc.)

---

## Social Features

### Q15: How deep should multiplayer go at launch? [DECIDED: Minimal, grow over time]
Priority order for implementation:
1. View-only dome visits (MVP-adjacent)
2. Leaderboards
3. Gift sending
4. Knowledge duels
5. Co-op dives
6. Guilds/clubs

All are great long-term, but not critical for initial launch.

### Q16: Should achievements/paintings be shareable outside the game? [DECIDED: Yes]
Worth investing in a share feature early. Instagram-worthy screenshots of dome + art + Knowledge Tree = free marketing.

### Q17: Guilds/clubs? [OPEN]
Interesting concept (e.g., "The Historians" group focused on history). Not a priority but worth designing the social layer to accommodate this later.

---

## Onboarding

### Q18: First 5 minutes flow [DECIDED]
See GAME_DESIGN.md for full flow. Key elements:
1. Crash landing → find pickaxe → mine blocks → find artifact + fossil
2. Fossil choice: "feline?", "canine?", etc. — player picks their first pet goal
3. Surface → plant Knowledge Tree seed → first gacha reveal
4. "Learn 10 facts about [animal type] to revive this creature!" = immediate exciting goal
5. Optional quick Anki system intro

### Q19: First artifact quality [DECIDED]
Guaranteed Rare or better. Hook the player with a mind-blowing fact.

### Q20: Tutorial for Anki system [DECIDED]
Quick, optional introduction. The system complexity stays hidden.

---

## Engagement & Notifications

### Q21: Notification style [DECIDED: Duolingo-style]
Intelligent, friendly, not spammy. Push notifications for fuel refills, due reviews, streaks.

### Q22: Season/battle pass system? [OPEN]
Could drive engagement and provide content cadence (e.g., "Age of Dinosaurs" season with special fossils). Worth exploring later.

---

## Economy

### Q23: Mineral naming [DECIDED]
Dust → Shard → Crystal → Core Fragment → Primordial Essence. Evocative, era-themed naming. See ECONOMY.md.

### Q24: Balance learning bonuses across topics [OPEN]
If learning Geology gives mining bonuses, players might only study Geology. Need balanced incentives. Options:
- Bonuses rotate (this week: Biology bonuses active)
- Bonuses are small enough that variety is still worthwhile
- Different branches give different types of bonuses (Geology = mining, Biology = pets, History = base)
- No gameplay bonuses at all — keep knowledge tree purely cosmetic/social

### Q25: Farm balance [DECIDED]
Farm income is supplementary, not dominant. Slower than active mining but accumulates offline. Some players may prefer farming — that's fine, wider audience net. See ECONOMY.md.

---

## MVP Scoping

### Q26: What is the minimum viable product? [OPEN — NEEDS DISCUSSION]
Need to define the smallest set of systems that tests the core hypothesis: "mining + finding artifacts + learning facts + growing a knowledge tree is fun and addictive."

Proposed MVP systems (in priority order):
1. Procedural mine generation (single biome, ~1 layer)
2. Basic mining controls (tap to mine, block hardness)
3. Block types (dirt, stone, mineral node, artifact node)
4. Simple backpack (grid with Tetris shapes — core to the experience)
5. Mineral collection (Dust tier only)
6. Artifact discovery + gacha reveal
7. Basic quiz (multiple choice, 1 correct + 3 from distractor pool)
8. Simple spaced repetition (SM-2, review at base)
9. Basic Knowledge Tree visualization
10. Oxygen system (per-action depletion)
11. Onboarding flow (crash → mine → fossil → tree seed)

**What to cut for MVP**: Multiple layers, pets/farm/zoo, premium materializer, social features, hazards beyond oxygen, multiple mineral tiers, data discs, streaks, notifications, combat, synergies.

### Q27: Fact content sourcing for MVP [OPEN]
How to source and curate 500 high-quality facts with ~25 distractors each efficiently?
- AI-assisted generation with human review seems most practical
- Need a quality scoring rubric
- Need a distractor generation pipeline that ensures plausibility

---

*Last updated: 2026-02-27 — after brainstorming sessions 1 and 2 (Batches 1-17)*
