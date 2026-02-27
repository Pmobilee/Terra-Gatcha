# Game Design Document — Terra Miner

Mining/knowledge game combining underground exploration with Anki-style spaced repetition learning.

## Core Concept
A lone miner's spaceship crash-lands on an unexplored planet — which is actually Earth in the far, far future. The surface is barren and unrecognizable. The miner must dig underground to survive and rebuild, discovering minerals that can be cracked open to reveal relics of Earth's past civilizations.

## Game Loop
1. **Mine**: Dig through procedurally generated underground layers
2. **Discover**: Find minerals and relics buried in the earth
3. **Learn**: Crack open discoveries to reveal facts about Earth
4. **Quiz**: Answer questions to "decode" relics (1 correct + 3 similar distractors)
5. **Progress**: Correct answers unlock deeper layers, better tools, and story progression
6. **Review**: Spaced repetition ensures previously learned facts are revisited

## Core Mechanics

### Mining System
- Top-down or side-view grid-based mining (TBD based on prototype testing)
- Different block types with varying hardness
- Tool upgrades affect mining speed and depth access
- Energy/stamina system limits mining per session

### Knowledge/Quiz System (Anki-Inspired)
- **Fact Database**: Historical, scientific, and cultural facts about Earth
- **Quiz Format**: Multiple choice — 1 correct answer + 3 plausible distractors
- **Spaced Repetition**: Uses SM-2 algorithm variant for review scheduling
- **Difficulty Scaling**: Wrong answers = easier variants; correct answers = harder variants
- **Integration**: Quizzes trigger when cracking open minerals/relics

### Progression
- **Depth Layers**: Surface → Shallow → Deep → Ancient → Core
- Each layer corresponds to different historical eras
- Deeper = harder blocks, rarer relics, more valuable knowledge
- Story elements unlock as player reaches new depths

### RPG Elements
- Miner character with upgradeable stats
- Inventory system for minerals, relics, and tools
- Base camp on the surface (upgradeable)
- Achievement/collection system for discovered facts

## Visual Style
- 2D pixel art (resolution TBD — testing 16x16, 32x32, 64x64)
- Dark underground palette with glowing minerals
- Retro RPG-inspired UI elements
- Particle effects for mining, discovery moments

## Target Platform
- Mobile-first (Android primary, iOS secondary)
- Web browser (desktop/mobile)
- Touch controls optimized for one-handed play
- Portrait orientation preferred

## Audio (Future)
- Chiptune/lo-fi soundtrack
- Satisfying mining sound effects
- Discovery fanfares
- Quiz feedback sounds
