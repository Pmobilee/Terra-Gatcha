# Terra Miner — Agent Context

A 2D pixel art mining/knowledge game built with Vite + Svelte + TypeScript + Phaser 3, targeting mobile via Capacitor.

## Project Summary
- **Concept**: Miner crash-lands on a far-future Earth. Mine underground to discover minerals and relics. Learn facts about Earth's history through Anki-inspired spaced repetition quizzes (1 correct + 3 similar distractors).
- **Tech Stack**: Vite 7, Svelte 5, TypeScript 5.9, Phaser 3, Capacitor (Android/iOS)
- **Sprite Generation**: ComfyUI with SDXL + pixel art LoRA, running locally on RTX 3060 12GB
- **Backend**: Fastify + TypeScript (planned), containerized for portable hosting
- **Data**: Quiz facts served via API, cached locally for offline play

## Directory Structure
```
src/game/          — Phaser scenes, entities, game systems
src/ui/            — Svelte components (menus, quiz overlay, HUD)
src/services/      — API client, caching, auth
src/data/          — TypeScript types, schemas, seed data
src/assets/        — Sprites, tilesets, audio, UI graphics
sprite-gen/        — ComfyUI workflows, automation scripts
docs/              — Project documentation (LLM-optimized)
```

## Key Conventions
- All code in TypeScript with strict mode
- Svelte components use `.svelte` extension, PascalCase filenames
- Game entities use composition over inheritance
- File naming: kebab-case for utilities, PascalCase for components/classes
- All public functions must have JSDoc comments
- Pixel art assets: PNG format, transparent backgrounds, power-of-2 dimensions

## Security Rules — MANDATORY
- NEVER use `eval()`, `Function()`, or `innerHTML` with dynamic content
- NEVER commit `.env` files, API keys, tokens, or credentials
- NEVER disable Content Security Policy headers
- ALWAYS sanitize user input before rendering or storing
- ALWAYS use parameterized queries for any database operations
- ALWAYS validate API responses against expected schemas
- Keep dependencies minimal; audit before adding new packages

## Agent Autonomy Rules
- MAY: Run ComfyUI workflows to generate sprites autonomously
- MAY: Run `npm run typecheck`, `npm run build`, `npm run dev`
- MAY: Edit game code, UI components, and documentation
- MAY: Create new files in src/ and docs/
- MUST ASK: Before adding new npm dependencies
- MUST ASK: Before modifying database schemas
- MUST ASK: Before deleting files
- MUST ASK: Before changing security-critical configuration (CSP, auth, CORS)

## Sub-Agent Rules
- When spawning Task sub-agents, NEVER use "spark" tier — always use **codex 5.3 medium** or **codex 5.3 high** depending on task complexity
- Simple/mechanical tasks (file creation from spec, refactoring): medium
- Complex tasks (system integration, architecture, debugging): high

## Context Guide — What to Read
- Game mechanics and design → `docs/GAME_DESIGN.md`
- System architecture and data flow → `docs/ARCHITECTURE.md`
- Past decisions and rationale → `docs/DECISIONS.md`
- Sprite generation pipeline → `docs/SPRITE_PIPELINE.md`
- Security policies and practices → `docs/SECURITY.md`
- Quick lookup index → `docs/CONTEXT_INDEX.md`

## Commands
- `npm run dev` — Start dev server (port 5173)
- `npm run build` — Production build
- `npm run typecheck` — Run TypeScript/Svelte type checking
- `npm run check` — Full type check (app + node configs)
