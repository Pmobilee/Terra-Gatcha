# Context Index — Terra Miner

Quick lookup for agents: find the right doc for your task.

## By Topic
| Need to understand... | Read this file |
|---|---|
| Project overview, tech stack, conventions | `CLAUDE.md` (project root) |
| Game mechanics, progression, quiz system | `docs/GAME_DESIGN.md` |
| System architecture, data flow, components | `docs/ARCHITECTURE.md` |
| Why a technology was chosen | `docs/DECISIONS.md` |
| Security policies and practices | `docs/SECURITY.md` |
| Sprite generation with ComfyUI | `docs/SPRITE_PIPELINE.md` |

## By Task
| Task | Start here |
|---|---|
| Add a new game mechanic | `docs/GAME_DESIGN.md` then `src/game/systems/` |
| Create a new UI screen | `src/ui/components/` — follow existing Svelte patterns |
| Generate new sprites | `docs/SPRITE_PIPELINE.md` then `sprite-gen/scripts/` |
| Add a new quiz category | `src/data/` for types, backend API for content |
| Fix a security issue | `docs/SECURITY.md` for policies |
| Understand a past decision | `docs/DECISIONS.md` |
| Set up development environment | `CLAUDE.md` Commands section |

## File Size Guide (for context budgeting)
- `CLAUDE.md`: ~60 lines — always safe to load
- `docs/GAME_DESIGN.md`: ~100 lines — load when working on game mechanics
- `docs/ARCHITECTURE.md`: ~80 lines — load when working on system design
- `docs/DECISIONS.md`: ~80 lines — load when questioning a technology choice
- `docs/SECURITY.md`: ~70 lines — load when touching auth, input, or CSP
- `docs/SPRITE_PIPELINE.md`: ~70 lines — load when generating assets
- `docs/CONTEXT_INDEX.md`: ~40 lines — quick reference, always safe to load
