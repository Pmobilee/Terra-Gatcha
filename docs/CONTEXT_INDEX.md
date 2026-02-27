# Context Index — Terra Miner

Quick lookup for agents: find the right doc for your task.

## By Topic
| Need to understand... | Read this file |
|---|---|
| Project overview, tech stack, conventions | `CLAUDE.md` (project root) |
| Game concept, loop, pillars, monetization | `docs/GAME_DESIGN.md` |
| Dive mechanics, layers, oxygen, mining, backpack | `docs/ROGUELITE_RUNS.md` |
| Artifacts, facts, quizzes, Anki system, Knowledge Tree | `docs/KNOWLEDGE_SYSTEM.md` |
| Minerals, currency, crafting, pets, farm, economy sinks | `docs/ECONOMY.md` |
| System architecture, data flow, components | `docs/ARCHITECTURE.md` |
| Why a technology/design was chosen | `docs/DECISIONS.md` |
| Unresolved design questions | `docs/OPEN_QUESTIONS.md` |
| Security policies and practices | `docs/SECURITY.md` |
| Sprite generation with ComfyUI | `docs/SPRITE_PIPELINE.md` |

## By Task
| Task | Start here |
|---|---|
| Understand the full game vision | `docs/GAME_DESIGN.md` → system-specific docs |
| Add a new game mechanic | `docs/ROGUELITE_RUNS.md` or `docs/ECONOMY.md` then `src/game/systems/` |
| Work on the mining system | `docs/ROGUELITE_RUNS.md` then `src/game/scenes/MainScene.ts` |
| Work on quiz/learning system | `docs/KNOWLEDGE_SYSTEM.md` then `src/ui/components/` |
| Work on economy/crafting | `docs/ECONOMY.md` then `src/data/types.ts` |
| Create a new UI screen | `src/ui/components/` — follow existing Svelte patterns |
| Generate new sprites | `docs/SPRITE_PIPELINE.md` then `sprite-gen/scripts/` |
| Add a new quiz category | `docs/KNOWLEDGE_SYSTEM.md` for structure, `src/data/` for types |
| Fix a security issue | `docs/SECURITY.md` for policies |
| Understand a past decision | `docs/DECISIONS.md` |
| Check what's undecided | `docs/OPEN_QUESTIONS.md` |
| Set up development environment | `CLAUDE.md` Commands section |

## File Size Guide (for context budgeting)
- `CLAUDE.md`: ~60 lines — always safe to load
- `docs/GAME_DESIGN.md`: ~100 lines — load for game overview
- `docs/ROGUELITE_RUNS.md`: ~250 lines — load when working on dive/mining mechanics
- `docs/KNOWLEDGE_SYSTEM.md`: ~250 lines — load when working on facts/quiz/learning
- `docs/ECONOMY.md`: ~200 lines — load when working on minerals/crafting/pets
- `docs/OPEN_QUESTIONS.md`: ~200 lines — load when making design decisions
- `docs/DECISIONS.md`: ~150 lines — load when questioning a choice
- `docs/ARCHITECTURE.md`: ~80 lines — load when working on system design
- `docs/SECURITY.md`: ~60 lines — load when touching auth, input, or CSP
- `docs/SPRITE_PIPELINE.md`: ~50 lines — load when generating assets
- `docs/CONTEXT_INDEX.md`: ~50 lines — quick reference, always safe to load
