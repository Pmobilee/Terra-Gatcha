# Terra-Gacha Progress Tracker & Roadmap

Last updated: 2026-02-28

## Vision

Terra-Gacha is a mobile-first 2D pixel-art mining roguelite where each dive fuels a long-term knowledge journey. The player crash-lands on a far-future Earth, excavates procedural mines for minerals and artifacts, and returns to the dome to ingest discoveries through GIAI (the ship AI), review facts with spaced repetition, and grow a living Knowledge Tree. The core fantasy is rediscovering Earth one artifact at a time while building an emotionally sticky loop of risk, reward, and curiosity.

The full vision extends far beyond the MVP: layered biome progression, in-run relic builds, meaningful economy and crafting, fossilized pet revival, base expansion, social systems, seasonal live ops, and eventually language-learning depth. Every system serves four pillars from `docs/GAME_DESIGN.md`: addictive learning, roguelite replayability, gacha dopamine, and visible permanent progression.

## Current State: Phase 0 Complete ✅

The MVP hypothesis is validated in a playable build: players can prep a dive, mine a procedural map, manage oxygen and inventory pressure, collect artifacts/minerals, return to base, reveal facts, and run SM-2 study reviews. Core UX fixes (camera centering, directional mining movement, pathfinding, and interaction reliability) are integrated, and the game loop is stable enough to shift focus from feature scaffolding to content scale, polish, and progression depth.

---

## PHASE 0: MVP Core Loop ✅ COMPLETE

**Goal**: Test core hypothesis - "mining + artifacts + learning is fun"

### Completed Systems
- [x] Step 1: Rewrite `src/data/types.ts` with full content/run/save interfaces
- [x] Step 2: Create `src/data/balance.ts` with central gameplay constants
- [x] Step 3: Create `src/services/saveService.ts` (save/load/new player)
- [x] Step 4: Create `src/services/sm2.ts` for spaced repetition logic
- [x] Step 5: Create `src/services/quizService.ts` for question/choice/grading flow
- [x] Step 6: Add seed content in `src/data/seed/vocab-n3.json` (~50 entries)
- [x] Step 7: Build `MineGenerator` with seeded procedural generation
- [x] Step 8: Build `OxygenSystem` for dive oxygen state/cost handling
- [x] Step 9: Build `MiningSystem` for hardness/mining/content resolution
- [x] Step 10: Add `Player` entity for grid position/movement state
- [x] Step 11: Create `MineScene` with mining input/render/event emissions
- [x] Step 12: Update `GameManager` to register/start/end mine scenes
- [x] Step 13: Create Svelte stores in `gameState.ts` and `playerData.ts`
- [x] Step 14: Create `HUD.svelte`
- [x] Step 15: Create `QuizOverlay.svelte`
- [x] Step 16: Create `BackpackOverlay.svelte`
- [x] Step 17: Create `FactReveal.svelte`
- [x] Step 18: Create `DivePrepScreen.svelte`
- [x] Step 19: Create `BaseView.svelte`
- [x] Step 20: Update `App.svelte` screen router
- [x] Step 21: Implement event bridge between Phaser and Svelte
- [x] Step 22: Integrate full dive loop (prep -> mine -> surface -> resolve)
- [x] Step 23: Integrate base study loop for due-review quizzes
- [x] Step 24: Update `BootScene` to load/initialize seed content
- [x] Step 25: Complete typecheck/build/playability validation pass
- [x] Recent UX pass: camera centering, random spawn, directional movement, free empty-tile movement, auto-step after mining, click-to-pathfind

### What Works
- Full dive loop: prep -> mine -> collect -> surface -> review
- Spaced repetition (SM-2)
- Quiz system with distractors
- Oxygen management
- Procedural mine generation
- Save/load system

---

## PHASE 1: Content & Polish (Next 2-4 weeks)

**Goal**: Make the MVP feel complete and ready for alpha testing

### 1.1 Visual Polish
- [ ] Mining feedback: cracks/progress bars on multi-hit blocks
- [ ] Block destruction particles (different colors per block type)
- [ ] Loot collection animations ("suck" toward backpack)
- [ ] Artifact rarity colors in backpack
- [ ] Depth transition animations
- [ ] Player visual states (dirty/scuffed as run progresses)

### 1.2 Content Pipeline
- [ ] Expand from 50 to 500 Japanese N3 vocabulary entries
- [ ] Build automated distractor generation (25 per fact)
- [ ] Fact verification system
- [ ] Category tagging and organization
- [ ] Quality scoring (`fun_score`, `novelty_score`)

### 1.3 Audio
- [ ] Mining sounds (varied by block type)
- [ ] Collection sounds (minerals, artifacts)
- [ ] Quiz feedback (correct ding, wrong buzz)
- [ ] Ambient underground atmosphere
- [ ] UI interaction sounds

### 1.4 Balance Tuning
- [ ] Oxygen costs per block type
- [ ] Block hardness distribution
- [ ] Artifact drop rates by depth
- [ ] Mineral node density
- [ ] Quiz gate frequency

### 1.5 Mobile Optimization
- [ ] Touch controls testing on real devices
- [ ] Button size optimization for thumbs
- [ ] Performance profiling (60fps target)
- [ ] Battery usage optimization
- [ ] Offline mode testing

---

## PHASE 2: Knowledge System Expansion (4-8 weeks)

**Goal**: Transform from vocab quiz to full knowledge game

### 2.1 Real Facts Content
- [ ] Source 500+ high-quality facts across all categories
- [ ] Generate 25 plausible distractors per fact
- [ ] Add `wowFactor` field (mind-blowing framing)
- [ ] Add `explanation` depth pass for each fact
- [ ] Source attribution (`sourceName`)
- [ ] Age rating system validation (kid/teen/adult)

### 2.2 Knowledge Tree Visualization
- [ ] Tree rendering (trunk, branches, leaves)
- [ ] Leaf color progression (greyscale -> color by mastery)
- [ ] Branch thickness grows with category completion
- [ ] Wilting leaves for facts needing review
- [ ] Camera focus on active branch during study
- [ ] Completion percentages per branch

### 2.3 GIAI Personality
- [ ] Name/avatar presentation pass and expression states
- [ ] Pre-generate `giaiComment` for each fact
- [ ] Contextual dialogue system
- [ ] Idle comments in dome
- [ ] Mnemonic suggestions for struggling facts
- [ ] Personality tuning (snarky, enthusiastic, 4-5/10 chattiness)

### 2.4 Pixel Art Per Fact
- [ ] ComfyUI pipeline for fact illustrations
- [ ] Greyscale-to-color progression by mastery
- [ ] Quality checks (image does not reveal answer)
- [ ] Batch processing automation
- [ ] 500+ images generated

---

## PHASE 3: Roguelite Depth (8-12 weeks)

**Goal**: Make every dive unique and replayable

### 3.1 Multiple Biomes
- [ ] Design 7+ biome types (Sedimentary, Volcanic, Crystalline, Fossilized, etc.)
- [ ] Unique generation algorithm per biome
- [ ] Biome shuffling (randomized order per run)
- [ ] Visual identity per biome (colors, particles, ambient)
- [ ] Biome-specific block types and hazards

### 3.2 Layer System
- [ ] Descent Shafts (find to progress)
- [ ] Layer entrance challenges (3 questions or puzzle)
- [ ] Layer oxygen recovery bonus
- [ ] Send-up slots (secure items before descending)
- [ ] Point of no return mechanics

### 3.3 In-Run Upgrades (Binding of Isaac style)
- [ ] Passive relics system (20+ relics)
- [ ] Tool upgrades (pickaxe tiers)
- [ ] Scanner upgrades (range, rarity hints)
- [ ] Backpack expansions (temporary)
- [ ] Oxygen tank pickups
- [ ] Consumables (bombs, flares, shields)
- [ ] Synergy system (combos between relics)

### 3.4 Micro-Structures
- [ ] Ancient Library rooms
- [ ] Crystal Caverns
- [ ] Collapsed Tunnels
- [ ] Rest Alcoves
- [ ] Ruins with lore
- [ ] Quote Stones (readable blocks)
- [ ] Empty caverns for pacing

### 3.5 Hazards
- [ ] Lava blocks (instant oxygen cost)
- [ ] Gas pockets (visibility + oxygen drain)
- [ ] Unstable ground (cave-ins)
- [ ] Environmental events (earthquakes)

---

## PHASE 4: Economy & Base Building (12-16 weeks)

**Goal**: Create meaningful progression and economy loops

### 4.1 Mineral Tiers
- [ ] 5-tier system (Dust -> Primordial Essence)
- [ ] Conversion system (100:1 with tax)
- [ ] Visual distinction in mine
- [ ] Depth-based distribution

### 4.2 Materializer
- [ ] Crafting recipes (gear, consumables, base structures)
- [ ] Permanent upgrade caps (limited power creep)
- [ ] Cosmetics shop
- [ ] Daily rotating deals
- [ ] Recipe unlocks via progression

### 4.3 Premium Materializer
- [ ] Premium material drops (rare, limited)
- [ ] Exclusive cosmetics
- [ ] Special pet variants
- [ ] Convenience items (never pay-to-win)

### 4.4 Dome Expansion
- [ ] Multiple rooms (Materializer, GIAI, Tree, Farm, Zoo, Shop, Gallery, Quarters)
- [ ] Progressive unlocks (spread across first 10 dives)
- [ ] Decorations and customization
- [ ] Dome visiting (view-only)

### 4.5 Economy Sinks
- [ ] Scaling crafting costs
- [ ] Consumable purchases
- [ ] Mineral compression tax
- [ ] Rescue beacon crafting
- [ ] Base expansion costs

---

## PHASE 5: Pets & Fossilized Animals (16-20 weeks)

**Goal**: Bring extinct creatures back to life

### 5.1 Fossil System
- [ ] Fossil drops during dives (rare, depth-scaled)
- [ ] 10-20 species at launch
- [ ] Knowledge-gated revival (learn 10 related facts)
- [ ] Revival gacha moment (dramatic reveal)

### 5.2 Pet Roles
- [ ] Cosmetic companions in dome
- [ ] Dive companions (carry items, sniff artifacts, alert hazards)
- [ ] Farm producers (passive resource generation)
- [ ] Zoo display system

### 5.3 The Farm
- [ ] Animal placement grid
- [ ] Passive resource production (time-gated)
- [ ] Collection on login
- [ ] Farm expansion (costs minerals)
- [ ] Plant growing (future)

### 5.4 The Zoo
- [ ] Display area for collection
- [ ] Visitor viewing
- [ ] Rarity prestige

---

## PHASE 6: Advanced Learning Features (20-24 weeks)

**Goal**: Deepen the learning experience

### 6.1 Enhanced Quiz System
- [ ] Artifact quiz flow (2-3 questions for rarity boost)
- [ ] Random mining quizzes (small rewards)
- [ ] Morning/evening review rituals
- [ ] Pop-up reviews (couple per day)
- [ ] In-run consistency penalty (wrong in dive after correct at base)

### 6.2 Study Session UX
- [ ] Calm setting (miner relaxed, tree visible)
- [ ] Card flip interface
- [ ] Self-rating (Got it / Did not get it)
- [ ] Tree growth animation during study
- [ ] Session size choice (5 or 10 facts)

### 6.3 Data Discs
- [ ] Deep dive content packs (10-20 facts per topic)
- [ ] Rare dive drops
- [ ] Shop purchases for specific categories

### 6.4 Knowledge Store
- [ ] Learning milestone currency
- [ ] Small powerups tied to categories
- [ ] Cosmetics unlocks
- [ ] Branch completion bonuses

---

## PHASE 7: Social & Multiplayer (24-30 weeks)

**Goal**: Create community and social engagement

### 7.1 Dome Visiting
- [ ] View others' Knowledge Trees
- [ ] See their zoo/farm
- [ ] Gallery viewing
- [ ] Guestbook messages
- [ ] Gift sending (facts, minerals)

### 7.2 Leaderboards
- [ ] Deepest dive
- [ ] Most facts mastered
- [ ] Longest streak
- [ ] Biggest tree
- [ ] Best quiz accuracy
- [ ] Global + friends-only

### 7.3 Knowledge Duels
- [ ] Turn-based quiz battles
- [ ] Wager system (oxygen or minerals)
- [ ] Duel history and stats

### 7.4 Fact Trading
- [ ] Marketplace system
- [ ] Direct trades
- [ ] Duplicate mixing (reroll for higher rarity)
- [ ] Anti-exploitation measures

### 7.5 Guilds/Clubs
- [ ] Knowledge-focused groups ("The Historians")
- [ ] Guild challenges
- [ ] Shared progress tracking

---

## PHASE 8: Live Ops & Seasons (Ongoing)

**Goal**: Keep the game fresh with regular content

### 8.1 Seasonal Events
- [ ] "Age of Dinosaurs" (boosted fossils, paleo facts)
- [ ] "Space Month" (astronomy, special biome)
- [ ] "Language Festival" (first language content)
- [ ] Exclusive seasonal rewards

### 8.2 Content Cadence
- [ ] Weekly fact batches
- [ ] Monthly biome additions
- [ ] Quarterly major features
- [ ] Version milestones (`v1.5`, `v2.0`, etc.)

### 8.3 User-Generated Content
- [ ] Community fact submissions (moderated)
- [ ] Fact verification pipeline
- [ ] Submitter credit system

### 8.4 Streak System
- [ ] Daily review streaks
- [ ] Milestone rewards
- [ ] Streak protection
- [ ] Duolingo-style notifications

---

## PHASE 9: Language Learning Expansion (30+ weeks)

**Goal**: Extend to full language learning platform

### 9.1 Vocabulary System
- [ ] Multi-language support (Spanish, Japanese, French, etc.)
- [ ] Pronunciation guides (IPA, audio)
- [ ] Example sentences
- [ ] Audio clips
- [ ] Auto-generated distractors (semantic similarity)

### 9.2 Grammar & Phrases
- [ ] Grammar rule facts
- [ ] Common phrases
- [ ] Contextual usage
- [ ] Language-specific Knowledge Tree branches

### 9.3 Language-Specific Features
- [ ] Speaking practice (future)
- [ ] Listening comprehension
- [ ] Writing exercises
- [ ] Conversation scenarios

---

## PHASE 10: Mobile Launch & Monetization (32+ weeks)

**Goal**: Ship to app stores and establish revenue

### 10.1 Capacitor Build
- [ ] Android build and testing
- [ ] iOS build and testing
- [ ] App store assets (screenshots, videos)
- [ ] Store listings
- [ ] Beta testing (TestFlight, Play Console)

### 10.2 Monetization
- [ ] Subscription system (unlimited oxygen)
- [ ] Premium Materializer integration
- [ ] IAP implementation
- [ ] Analytics and conversion tracking
- [ ] Fair-play balance (top players can play free via mastery)

### 10.3 Backend Infrastructure
- [ ] Fastify + TypeScript API
- [ ] PostgreSQL + Drizzle ORM
- [ ] JWT auth with refresh tokens
- [ ] Save sync (cloud + local)
- [ ] Docker deployment (Railway/Fly.io)

### 10.4 Launch Prep
- [ ] Privacy policy
- [ ] Terms of service
- [ ] COPPA compliance (kid mode)
- [ ] Marketing materials
- [ ] Press kit
- [ ] Community Discord/Reddit

---

## PHASE 11: Advanced Features (Post-Launch)

### 11.1 Combat System
- [ ] Underground creatures
- [ ] Boss encounters at layer boundaries
- [ ] Combat mechanics (turn-based or real-time)
- [ ] Loot from creatures

### 11.2 Cooperative Dives
- [ ] 2-player shared mines
- [ ] Split up to cover ground
- [ ] Shared oxygen pool
- [ ] One mines, one answers quizzes

### 11.3 Achievement Paintings
- [ ] Pixel-art versions of famous paintings
- [ ] Unlock via milestones
- [ ] Gallery display
- [ ] Shareable capture flow

### 11.4 Ambient Storytelling
- [ ] Environmental flavor text
- [ ] Biome-specific lore
- [ ] Readable blocks
- [ ] Ruins with history

---

## Open Questions & Decisions Needed

Unresolved design and scope decisions are tracked in `docs/OPEN_QUESTIONS.md`.

---

## Testing Access

- Dev server: `npm run dev` -> `http://0.0.0.0:5173`
- Tailscale: `http://100.74.153.81:5173`
- LAN: `http://192.168.122.96:5173`
- DevPanel: Click "DEV" button (top-right) for god-mode testing

## Architecture Reference

- Full vision: `docs/GAME_DESIGN.md`
- MVP spec: `docs/MVP_PLAN.md`
- Roguelite systems: `docs/ROGUELITE_RUNS.md`
- Knowledge system: `docs/KNOWLEDGE_SYSTEM.md`
- Economy: `docs/ECONOMY.md`
- Agent workflow: `CLAUDE.md`
