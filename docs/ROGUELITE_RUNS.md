# Roguelite Runs — Terra Miner

Detailed design for the dive system: the core gameplay loop where the player mines underground.

## Run Philosophy

Every dive is a **self-contained roguelite run**. The player starts weak and gets stronger through discoveries during the run. Permanent upgrades exist but are deliberately limited — the in-run power curve is the main experience. This ensures every dive feels fresh and meaningful, regardless of how long someone has played.

## Oxygen (Fuel System)

### Earning Oxygen
- **Time-gated refill**: Oxygen regenerates over time, starting from first daily login
- **Morning quiz bonus**: Answer review questions on login for extra oxygen
- **Evening quiz bonus**: Second daily boost available
- **Pop-up reviews**: A couple per day, answering due facts earns small oxygen top-ups
- **In-run finds**: Rare oxygen tank pickups extend the current dive
- **Mastery bonus**: Top players who consistently ace quiz gates can earn enough bonus oxygen to play indefinitely — knowledge mastery = free unlimited play
- **Subscription**: Unlimited oxygen for subscribers

### Oxygen Consumption
- **Pre-dive allocation**: Player chooses how much oxygen to bring (e.g., 1, 2, or 3 units)
- More oxygen = longer runs, ability to reach deeper layers
- **However**: A skilled player with 1 oxygen should be *able* to reach the same depth as a 3-oxygen player, if they play exceptionally well (efficient pathing, acing quiz gates for bonuses, finding oxygen tanks)
- **Oxygen depletes PER ACTION, not in real-time** — no time pressure. This is a thinking game, not a speed game. Players should never feel rushed.
  - Each block mined costs oxygen (amount varies by block hardness)
  - Moving through empty space costs a small amount
  - Quiz gate attempts cost oxygen (win or lose)
  - Hazard encounters cost oxygen
- **No real-time drain**: Players can sit and think about their next move, plan their path, read quiz questions carefully
- **Quiz gate failures cost oxygen** — wrong answers are punished mechanically, but players aren't rushed while answering
- **Layer oxygen recovery**: When descending to a new layer, the player receives a small oxygen bonus. This makes the "go deeper" risk more palatable — you get a reward for committing.
- **Running out**: Player is automatically pulled to surface, **dropping random loot** on the way up
- **IMPORTANT DESIGN NOTE**: The exact formula for loot loss on oxygen depletion needs careful research and testing. This is one of the most sensitive balance points in the game — too punishing kills motivation, too lenient removes tension. See `docs/OPEN_QUESTIONS.md` for details.

## Mine Structure

### Layout
- **Motherload-style 2D side-view cross-section**
- Procedurally generated grid of blocks
- Player starts at the surface and digs downward (and sideways, and upward — **no gravity**)
- Each run generates a completely new mine layout

### Procedural Generation
- Random distribution of mineral nodes, artifact nodes, and empty/rock blocks
- **Biome layers** at different depths with different loot tables, visuals, and hazards
- Environmental hazards vary per run (lava pockets, gas vents, cave-ins — future: creatures)
- Density and quality of loot increases with depth
- Special structures: caverns, veins, ruins (future)

### Depth Layers & Point of No Return
- The mine is divided into discrete **layers** (depth zones)
- Each layer boundary is a **point of no return** — once you descend, you cannot go back up to the previous layer
- This creates a core risk/reward decision at every boundary:
  - **Surface now** with what you have (safe, guaranteed loot)
  - **Go deeper** for rarer minerals, better artifacts, more upgrades (risk losing loot if oxygen runs out)
- Deeper layers have:
  - Harder blocks (require better tools)
  - Rarer minerals and higher-tier artifacts
  - More dangerous hazards
  - Better in-run upgrade drops
  - Tougher quiz gates

### Layer Progression (Tentative)
| Layer | Depth | Theme | Difficulty |
|---|---|---|---|
| Surface | 0-50 | Topsoil, loose rock | Easy — tutorial zone |
| Shallow | 50-150 | Sedimentary, clay | Moderate |
| Deep | 150-300 | Granite, ore veins | Hard |
| Ancient | 300-500 | Fossilized layers, ruins | Very Hard |
| Core | 500+ | Crystalline, primordial | Extreme |

*Layer count, depth values, and themes are all tunable. More layers can be added over time.*

## Block Types

### By Hardness
- **Dirt/Soil**: 1 tap — tutorial blocks, no loot
- **Soft Rock**: 1-2 taps — occasional common minerals
- **Stone**: 2-3 taps — standard mining
- **Hard Rock**: 3-5 taps — contains better loot
- **Dense Ore**: 5-8 taps — guaranteed mineral node
- **Obsidian/Crystal**: 8+ taps — rare, high-tier loot
- **Unbreakable**: Cannot be mined — shapes pathways, creates puzzles

### Special Blocks
- **Mineral Node**: Glows subtly. Mining it yields minerals for the backpack.
- **Artifact Node**: Distinct visual (ancient symbol?). Yields an artifact of unknown rarity.
- **Oxygen Cache**: Rare. Restores some oxygen on mining.
- **Upgrade Crate**: Contains an in-run upgrade (tool, backpack slot, scanner boost).
- **Hazard Block**: Lava, gas, unstable ground. Damages or costs oxygen.
- **Quiz Gate**: Barrier block. Must answer a question to pass. Wrong answer = oxygen cost.

## Backpack (Inventory System)

### Tetris-Style Slotting
- Items have **shapes** (1x1, 2x1, L-shape, T-shape, etc.)
- Backpack is a small grid that items must physically fit into
- **Starting size is very small** (e.g., 3x3 or 4x3 grid)
- Creates agonizing trade-off decisions: carry minerals or artifacts? Keep the big rare crystal or two small common ones?

### Capacity Progression
- **Permanent upgrades** (at base): Slightly expand backpack grid
- **In-run upgrades**: Find backpack expansion drops during dives (temporary, lost after run)
- Both are intentionally limited — the tension of limited space is a core mechanic

### When Full
- Player must **choose what to drop** to make room
- Dropped items are **lost forever** (no going back for them, especially across layer boundaries)
- This decision pressure is intentional — it forces players to value what they carry

## In-Run Upgrades

### Philosophy
Starting gear should be deliberately weak. The excitement of a run comes from what you *find*. Permanent base upgrades improve your starting position slightly, but in-run upgrades are where the power comes from.

### Upgrade Style: Binding of Isaac Passives
In-run upgrades are primarily **passive relics/items** that modify the player's stats and abilities. The player accumulates these throughout a run, building a unique combination each time. This is inspired by The Binding of Isaac's item system.

**Design rule**: Incredible players should be able to build absurdly powerful combinations, but nobody should become truly invincible. There should always be a way to fail if you're careless with oxygen or make bad decisions.

### Upgrade Types
- **Passive Relics** (Binding of Isaac style): Permanent buffs for the rest of the run
  - "Magnetite" — nearby mined minerals auto-collect
  - "Deep Lungs" — 15% reduced oxygen consumption
  - "Geologist's Eye" — mineral nodes glow brighter, visible from further
  - "Lucky Strike" — 10% chance to not consume oxygen when mining
  - "Artifact Attunement" — artifact rarity roll gets a small bonus
- **Tool Upgrades**: Better pickaxe/drill found during the run. Reduces taps needed, allows mining harder blocks.
- **Scanner Upgrades**: Reveals nearby nodes through fog of war. Improves with better scanner tiers found in-run.
- **Backpack Expansions**: Extra row or column added to inventory grid.
- **Oxygen Tanks**: Extend current dive duration.
- **Consumables**: Bombs (clear area), flares (reveal large area), shields (protect from hazard).

### Synergies
Certain upgrades should combo, and discovering synergies is one of the most addictive elements of roguelites:
- **Magnetite + Blast Mining** = explosions pull loot to you
- **Deep Lungs + Lucky Strike** = extremely efficient oxygen usage
- **Geologist's Eye + Artifact Attunement** = treasure hunter build
- Design the upgrade pool so that players discover new combinations over many runs
- Synergies should feel emergent, not scripted — players feel clever when they find them

### After the Run
- **All in-run upgrades are lost** when the run ends — no exceptions
- This is core to the roguelite feel — every run you rebuild your power
- Permanent gear at base (see Economy doc) only gives a slight starting edge

## Visibility & Exploration

### Fog of War
- Player has a limited visibility radius
- Unexplored blocks are dark/hidden
- **Scanner** (upgradeable) reveals nearby special nodes (minerals, artifacts) through the fog
- Creates exploration tension — you don't know what's around the next block

### Scanner Mechanic
- Base scanner: very limited range, only shows adjacent special blocks
- Upgraded scanners (found in-run): larger range, show rarity hints, reveal hazards
- Permanent scanner upgrades (at base): slightly improve starting scanner
- Scanner pings could be visual (sonar-style pulse) for satisfying feedback

## Mining Controls

### Input Methods
- **Tap**: Tap an adjacent block to mine it. Multiple taps for harder blocks. Most precise.
- **Swipe**: Swipe in a direction to mine the next block in that direction. Faster, less precise.
- **Hold** (potential): Hold direction to auto-mine in a line. Useful for tunneling.
- All controls must work well one-handed in portrait mode on mobile.

### Movement
- **No gravity** — player can mine and move in any direction freely
- Player occupies mined (empty) spaces
- Movement is grid-based, one tile at a time

## Hazards (Progressive Implementation)

### Phase 1 (MVP)
- Oxygen depletion (running out = forced surface with loot loss)
- Hard blocks (natural pacing/walls)
- Quiz gates (knowledge checks)

### Phase 2
- Lava blocks (instant oxygen cost on contact)
- Gas pockets (cloud that reduces visibility + drains oxygen)
- Unstable ground (cave-in after mining nearby blocks)

### Phase 3
- Underground creatures (combat system)
- Environmental events (earthquake shifts blocks)
- Boss encounters at layer boundaries

## Run End Conditions

1. **Voluntary surface**: Player chooses to return. Keep all loot. Best outcome.
2. **Oxygen depleted**: Forced to surface. **Drop random portion of loot.** Painful but survivable.
3. **Reached maximum depth**: Surface with everything. Rare achievement.

## Key Metrics to Track Per Run

- Depth reached
- Blocks mined
- Minerals collected (by type)
- Artifacts found (by rarity)
- Quiz gates passed/failed
- Oxygen remaining at surface
- In-run upgrades found
- Time spent
