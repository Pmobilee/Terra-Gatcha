# Architecture Decision Records — Terra Miner

Log of key technical decisions with context and rationale. Newest first.

---

## ADR-001: Vite + Svelte + TypeScript for UI Layer
- **Date**: 2026-02-27
- **Context**: Need a frontend framework for menus, HUD, and quiz overlays around the Phaser game canvas.
- **Decision**: Svelte 5 with TypeScript, built with Vite 7.
- **Rationale**: Svelte compiles away at build time (tiny runtime), excellent Vite integration, minimal attack surface from fewer runtime dependencies, strong TypeScript support. Game rendering is 100% Phaser — Svelte only handles DOM UI.
- **Alternatives Considered**: React (heavier runtime, more deps), Vue (similar but less compile-time optimization), Vanilla TS (more boilerplate for quiz UI).

## ADR-002: Phaser 3 for Game Engine
- **Date**: 2026-02-27
- **Context**: Need a 2D game engine that runs in the browser and supports mobile.
- **Decision**: Phaser 3.
- **Rationale**: Most mature 2D web game framework, large community, excellent documentation, built-in tilemap support, mobile-optimized input handling, active development.
- **Alternatives Considered**: PixiJS (lower-level, more boilerplate), Kaboom.js (less mature), raw Canvas API (too much effort).

## ADR-003: Capacitor for Mobile Packaging
- **Date**: 2026-02-27
- **Context**: Need to package the web game as a native Android app (iOS later).
- **Decision**: Capacitor (Ionic).
- **Rationale**: Best ecosystem for wrapping web apps in native shells, access to native APIs (storage, haptics, push notifications), official Vite plugin, well-documented migration path.
- **Alternatives Considered**: Tauri Mobile (newer, less stable for mobile), TWA (limited native access).

## ADR-004: ComfyUI for Sprite Generation
- **Date**: 2026-02-27
- **Context**: Need agent-orchestratable pixel art sprite generation with transparent backgrounds.
- **Decision**: ComfyUI running locally in API mode with SDXL + pixel-art-xl LoRA.
- **Rationale**: REST API enables automation, node-based workflows are reproducible, runs on available RTX 3060 12GB, supports background removal nodes. SD 1.5 also available as fallback for faster generation.
- **Hardware**: RTX 3060 12GB VRAM, CUDA 13.1.

## ADR-005: Backend API with Fastify + TypeScript
- **Date**: 2026-02-27
- **Context**: Quiz data needs a backend for community contributions, progress tracking, and future multiplayer.
- **Decision**: Fastify + TypeScript, containerized with Docker.
- **Rationale**: Same language as frontend (TypeScript everywhere), Fastify has excellent performance and schema-based validation (security), Docker ensures portable deployment to any hosting provider.
- **Status**: Planned, not yet implemented. Starting with local JSON seed data.

## ADR-006: Online with Caching for Offline Support
- **Date**: 2026-02-27
- **Context**: Mobile game needs to work with intermittent connectivity.
- **Decision**: Online-first with aggressive caching via Service Worker.
- **Rationale**: Allows community quiz content and progress sync while remaining playable offline. Pre-fetch quiz batches, cache all assets, sync on reconnect.
