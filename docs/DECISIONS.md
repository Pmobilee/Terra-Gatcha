# Architecture Decision Records — Terra Miner

Log of key technical and design decisions with context and rationale. Newest first.

---

## Design Decisions (Game)

### DD-001: Motherload-Style 2D Side-View Mining
- **Date**: 2026-02-27
- **Context**: Need to decide on mining perspective and movement model.
- **Decision**: 2D side-view cross-section (like Motherload/Terraria). No gravity — player moves freely in all directions.
- **Rationale**: Motherload is a proven, beloved format for mining games. No gravity allows strategic pathing in all directions, making exploration more interesting. Free movement means the player's choices determine their path, not physics.

### DD-002: Roguelite Run Structure with Point-of-No-Return Layers
- **Date**: 2026-02-27
- **Context**: How should dive progression work?
- **Decision**: Each dive is a self-contained roguelite run. Mine is divided into layers with point-of-no-return boundaries. Descending is a permanent commitment per run.
- **Rationale**: Creates meaningful risk/reward decisions at every layer boundary. Forces players to weigh "safe loot" vs "better loot deeper." Core to roguelite tension. Inspired by Spelunky/Inscryption commitment mechanics.

### DD-003: Weak Start, Strong In-Run Upgrades
- **Date**: 2026-02-27
- **Context**: How much should permanent upgrades vs. in-run upgrades matter?
- **Decision**: Permanent base upgrades are deliberately limited (slight starting improvements). In-run upgrades are the primary power source. All in-run upgrades lost after each run.
- **Rationale**: This ensures every run feels fresh and exciting regardless of player tenure. The discovery of upgrades during the run IS the fun. Prevents veterans from trivializing content through accumulated power.

### DD-004: Tetris-Style Backpack Inventory
- **Date**: 2026-02-27
- **Context**: How should inventory work during dives?
- **Decision**: Items have physical shapes that must fit into a small grid (Tetris/Resident Evil 4 style). Starting size is very small, expandable via permanent and in-run upgrades. Dropped items are lost forever.
- **Rationale**: Creates constant micro-decisions about what to keep. Physical shapes make rare items (bigger = more valuable) harder to carry, amplifying trade-off tension. Lost-forever drops prevent "I'll come back for it" — every decision is final.

### DD-005: Oxygen as Fuel with Time-Gated Refill
- **Date**: 2026-02-27
- **Context**: How to limit play sessions and create monetization opportunity?
- **Decision**: Oxygen (fuel) is time-gated, refilling from first daily login. Players allocate oxygen to dives (more = longer run). Mastery of quiz system can earn enough bonus oxygen for unlimited play. Subscription offers unlimited oxygen.
- **Rationale**: Time-gating creates daily return habit. Oxygen allocation adds pre-dive strategy. Mastery-based unlimited play rewards the learning goal. Subscription is ethical monetization that doesn't gate knowledge.

### DD-006: Artifacts as the Knowledge Delivery System
- **Date**: 2026-02-27
- **Context**: How do players encounter facts to learn?
- **Decision**: Facts are wrapped in artifacts found during mining. Artifacts show rarity + category hint before opening. They take backpack space, competing with minerals. Most must be carried back to base; some can be scanned mid-dive with upgrades.
- **Rationale**: Wrapping facts in physical loot items ties learning to the gacha/collection dopamine loop. Backpack competition with minerals creates a meaningful "learn vs earn" choice. Category hints let players hunt topics they're interested in.

### DD-007: SM-2 Spaced Repetition, Hidden from Player
- **Date**: 2026-02-27
- **Context**: How to implement the Anki-style learning system?
- **Decision**: Use SM-2 algorithm internally. Player-facing interface is simple (right/wrong, possibly easy/hard modifier). Algorithm complexity is entirely hidden.
- **Rationale**: SM-2 is the gold standard for spaced repetition effectiveness. Exposing the algorithm would feel like homework. Players just see "review these facts" — the system handles optimal scheduling invisibly.

### DD-008: Knowledge Tree as Permanent Visual Progression
- **Date**: 2026-02-27
- **Context**: How to represent learning progress?
- **Decision**: A visual tree at the center of the dome. Leaves = mastered facts, branches = categories. Leaf color reflects mastery level. Leaves wilt when facts are forgotten but regrow easily. Tree is permanent — never reset.
- **Rationale**: Creates a beautiful, personalized, shareable visualization of what the player has learned. Wilting leaves provide gentle review nudges. Permanent progression ensures learning is never lost, unlike run-based gear.

### DD-009: Fossil Pets and Base as Hub
- **Date**: 2026-02-27
- **Context**: What does the player do between dives?
- **Decision**: Dome serves as hub. Players can revive fossilized animals into pets, manage a farm, display a zoo, view their Knowledge Tree, craft at the Materializer, and host visitors.
- **Rationale**: Gives long-term investment outside of runs. Fossil revival ties into the "rediscovering Earth" narrative. Farm provides passive resource income. Social visiting creates community and showing off.

### DD-010: Achievement Paintings
- **Date**: 2026-02-27
- **Context**: How to reward milestone achievements?
- **Decision**: Achievements unlock pixel art versions of famous paintings/posters related to the achievement category. Displayed in a Gallery in the dome.
- **Rationale**: Unique reward that's visually exciting, culturally relevant, and ties back to the knowledge theme. Collectible and shareable. Creates a secondary collection goal beyond the Knowledge Tree.

### DD-012: Per-Action Oxygen (No Real-Time Pressure)
- **Date**: 2026-02-27
- **Context**: How should oxygen (fuel) deplete during dives?
- **Decision**: Oxygen depletes per action only (mining, moving, quiz attempts, hazards). No real-time countdown. Players can think as long as they want.
- **Rationale**: This is a learning game. Time pressure contradicts the goal of thoughtful quiz answers. Per-action depletion creates strategic oxygen management without rushing. Combined with layer oxygen recovery bonuses.

### DD-013: ~25 Distractors Per Fact (Prevent Answer Memorization)
- **Date**: 2026-02-27
- **Context**: Standard quiz games use 3 fixed wrong answers. Players memorize which answers are wrong instead of learning the right one.
- **Decision**: Each fact has a pool of ~25 plausible distractors. Each quiz shows 1 correct + 3 randomly selected from the pool.
- **Rationale**: With 25 distractors, a fact can be quizzed hundreds of times before repeating the same distractor set. This forces players to actually *know* the answer, which is the entire point. Critical for spaced repetition integrity.

### DD-014: Multiple Gacha Moments at Different Scales
- **Date**: 2026-02-27
- **Context**: Where should the gacha dopamine hit happen?
- **Decision**: Three distinct gacha moments: artifact reveal (frequent, moderate spectacle), dive reward chest (per-run, medium spectacle), and pet synthesis (rare, maximum spectacle). Visual/audio escalates with rarity.
- **Rationale**: Multiple gacha moments at different frequencies keeps the dopamine loop active throughout all play modes — not just during specific moments.

### DD-015: Artifact Rarity on Container, Not Fact
- **Date**: 2026-02-27
- **Context**: Should facts be "rare" or should their containers be?
- **Decision**: Rarity belongs to the artifact container. Facts are knowledge and aren't inherently rare. Higher rarity container = more interesting/memorable fact inside.
- **Rationale**: Philosophically, knowledge shouldn't be "rare." The delivery mechanism can be. This also keeps the gacha moment clean: you're excited about the artifact quality, not the fact's "tier."

### DD-016: Binding of Isaac-Style Passive In-Run Upgrades
- **Date**: 2026-02-27
- **Context**: How should in-run upgrades feel?
- **Decision**: Primarily passive relics that auto-apply as buffs. Players accumulate a unique combination each run. Synergies between items are designed from the start.
- **Rationale**: Passive relics are simple to understand, create emergent complexity through synergies, and make every run feel different based on what you find. Incredible players can build powerful combos but nobody becomes invincible.

### DD-017: Knowledge-Gated Pet Revival
- **Date**: 2026-02-27
- **Context**: Should reviving fossilized animals have requirements beyond minerals?
- **Decision**: Yes — reviving an animal requires learning X facts in the related knowledge category, plus minerals. e.g., T-Rex requires 10 Paleontology facts + 500 Crystals.
- **Rationale**: This is the strongest bridge between the knowledge system and base progression. Players are incentivized to keep artifacts, study, and grow their Knowledge Tree to unlock exciting pets. Each pet tells a story of learning.

### DD-018: Fossil Choice in First Run (Onboarding Hook)
- **Date**: 2026-02-27
- **Context**: How to hook the player in the first 5 minutes?
- **Decision**: First run guarantees a fossil find. Player chooses animal type ("feline?", "canine?", etc.). Immediately shown: "Learn 10 facts about [type] to revive!" — clear, exciting, achievable goal.
- **Rationale**: Gives the player an emotional attachment in the first session. The pet goal creates an immediate reason to keep artifacts and engage with the learning system. First artifact is also guaranteed Rare+ for a wow-factor fact.

### DD-019: Dust → Shard → Crystal → Core Fragment → Primordial Essence
- **Date**: 2026-02-27
- **Context**: What to name mineral currency tiers?
- **Decision**: Evocative era-themed names: Dust (common), Shard, Crystal, Core Fragment, Primordial Essence (legendary). 100:1 conversion between tiers.
- **Rationale**: Names are evocative and thematic ("the deeper you go, the more primordial the material"). Avoids boring real mineral names while maintaining the geological theme.

### DD-020: Duplicate Fact Mixing at Materializer
- **Date**: 2026-02-27
- **Context**: What to do with duplicate or unwanted facts?
- **Decision**: Multiple options: trade with players (future), mix at Materializer to reroll into a new potentially-higher-rarity artifact, or auto-convert to minerals. Players can also flag facts as "not interesting" for quality feedback.
- **Rationale**: Mixing duplicates into new artifacts is itself a gacha moment, keeping the loop engaging even with unwanted finds. The quality feedback loop helps improve the fact database over time.

### DD-011: Free-to-Play with Learning Never Paywalled
- **Date**: 2026-02-27
- **Context**: Monetization model.
- **Decision**: Free to play. Knowledge and learning are never paywalled. Revenue via subscription (unlimited oxygen) and premium cosmetic Materializer. Skilled learners can play for free indefinitely through quiz mastery bonuses.
- **Rationale**: The core mission is making learning addictive. Paywalling knowledge would contradict this. The mastery → free play loop means the best learners are rewarded with the most playtime, which is the ideal outcome.

---

## Technical Decisions

### ADR-001: Vite + Svelte + TypeScript for UI Layer
- **Date**: 2026-02-27
- **Context**: Need a frontend framework for menus, HUD, and quiz overlays around the Phaser game canvas.
- **Decision**: Svelte 5 with TypeScript, built with Vite 7.
- **Rationale**: Svelte compiles away at build time (tiny runtime), excellent Vite integration, minimal attack surface from fewer runtime dependencies, strong TypeScript support. Game rendering is 100% Phaser — Svelte only handles DOM UI.
- **Alternatives Considered**: React (heavier runtime, more deps), Vue (similar but less compile-time optimization), Vanilla TS (more boilerplate for quiz UI).

### ADR-002: Phaser 3 for Game Engine
- **Date**: 2026-02-27
- **Context**: Need a 2D game engine that runs in the browser and supports mobile.
- **Decision**: Phaser 3.
- **Rationale**: Most mature 2D web game framework, large community, excellent documentation, built-in tilemap support, mobile-optimized input handling, active development.
- **Alternatives Considered**: PixiJS (lower-level, more boilerplate), Kaboom.js (less mature), raw Canvas API (too much effort).

### ADR-003: Capacitor for Mobile Packaging
- **Date**: 2026-02-27
- **Context**: Need to package the web game as a native Android app (iOS later).
- **Decision**: Capacitor (Ionic).
- **Rationale**: Best ecosystem for wrapping web apps in native shells, access to native APIs (storage, haptics, push notifications), official Vite plugin, well-documented migration path.
- **Alternatives Considered**: Tauri Mobile (newer, less stable for mobile), TWA (limited native access).

### ADR-004: ComfyUI for Sprite Generation
- **Date**: 2026-02-27
- **Context**: Need agent-orchestratable pixel art sprite generation with transparent backgrounds.
- **Decision**: ComfyUI running locally in API mode with SDXL + pixel-art-xl LoRA.
- **Rationale**: REST API enables automation, node-based workflows are reproducible, runs on available RTX 3060 12GB, supports background removal nodes. SD 1.5 also available as fallback for faster generation.
- **Hardware**: RTX 3060 12GB VRAM, CUDA 13.1.

### ADR-005: Backend API with Fastify + TypeScript
- **Date**: 2026-02-27
- **Context**: Quiz data needs a backend for community contributions, progress tracking, and future multiplayer.
- **Decision**: Fastify + TypeScript, containerized with Docker.
- **Rationale**: Same language as frontend (TypeScript everywhere), Fastify has excellent performance and schema-based validation (security), Docker ensures portable deployment to any hosting provider.
- **Status**: Planned, not yet implemented. Starting with local JSON seed data.

### ADR-006: Online with Caching for Offline Support
- **Date**: 2026-02-27
- **Context**: Mobile game needs to work with intermittent connectivity.
- **Decision**: Online-first with aggressive caching via Service Worker.
- **Rationale**: Allows community quiz content and progress sync while remaining playable offline. Pre-fetch quiz batches, cache all assets, sync on reconnect.
