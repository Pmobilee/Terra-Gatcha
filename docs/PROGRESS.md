# Terra-Gacha Progress Tracker

Last updated: 2026-02-28

## Current State: MVP Playable ✅

The core game loop is **code-complete and playable**:
- Mine -> collect minerals/artifacts -> surface -> review artifacts -> study facts
- All 25 MVP build steps from `docs/MVP_PLAN.md` are implemented
- UI is clickable, Phaser rendering works, oxygen/inventory systems are functional

## Completed Work

### Core Systems (Steps 1-25)
- Data layer: types, balance constants, save/load, SM-2 spaced repetition
- Mine generation: procedural seeded RNG, fog of war, special blocks
- Phaser scene: `MineScene` with camera, input, rendering (tiles/fog/player)
- Svelte UI: 7 screens (base, dive prep, mining HUD, quiz, backpack, fact reveal, sacrifice)
- Game loop: dive -> mine -> surface -> artifact review -> study session

### Recent Fixes (Last 10 Commits)
1. `9b4b3d4` — Add pathfinding: clicking distant empty tile now auto-navigates without mining
2. `ec186d3` — Fix camera to keep player centered at all times and randomize spawn position
3. `bc0fcce` — Major UX overhaul: camera centering, free movement, auto-step, directional clicks
4. `9ac652c` — Fix UX issues: remove backpack-on-player-click, center camera, fix quiz gate oxygen costs
5. `d5f4f78` — Fix DivePrepScreen `$derived()` -> `$derived.by()` for Svelte 5 multi-statement derivations
6. `1e944e2` — Fix click handling by adding `pointer-events:auto` to all UI overlays site-wide
7. `3da90bc` — Add `@playwright/mcp` server to opencode config for browser testing
8. `ab56eaa` — Fix mine tiles invisible due to `camera.worldView` being uninitialized during `create()`
9. `322c977` — Fix pointer-event propagation so Phaser canvas receives clicks correctly
10. `516f255` — Add fallback for `crypto.randomUUID` on non-HTTPS contexts

### Recent Improvements
- ✅ Camera always centers player (no more sticking to top)
- ✅ Random spawn position in mine center (40-60% depth)
- ✅ Free movement (no oxygen cost for empty tiles)
- ✅ Auto-step after mining (one-click mining)
- ✅ Directional movement (click anywhere to move/mine that direction)
- ✅ Pathfinding (click distant empty tile to auto-navigate)

## Known Issues / Polish Needed

### High Priority
- [x] Quiz gate blocks: verify passing quiz avoids oxygen penalty
- [x] Camera offset: player should start mid-screen (not top edge)
- [x] Backpack click: remove "click player tile to open backpack"

### Medium Priority
- [ ] Visual feedback when mining multi-hit blocks (cracks/progress bar)
- [ ] Artifact rarity colors in backpack
- [ ] Sound effects (mining, collecting, quiz correct/wrong)
- [ ] Mobile touch controls testing (Tailscale/LAN access works)

### Low Priority
- [ ] Main menu (currently skipped, goes straight to base)
- [ ] Animations (player movement, block destruction)
- [ ] Particle effects (dust, sparkles)

## Next Steps

1. **Mobile playtesting** — test on device via Tailscale/LAN, gather UX feedback
2. **Visual polish** — mining feedback, artifact rarity colors, animations
3. **Balance tuning** — adjust oxygen costs, block hardness, drop rates based on playtesting
4. **Sound effects** — mining, collecting, quiz feedback
5. **Deployment** — Capacitor build for Android/iOS

## Testing Access

- Dev server: `npm run dev` -> `http://0.0.0.0:5173`
- Tailscale: `http://100.74.153.81:5173`
- LAN: `http://192.168.122.96:5173`
- DevPanel: Click "DEV" button (top-right) for god-mode testing

## Architecture Reference

See `docs/MVP_PLAN.md` for the complete implementation spec.
See `CLAUDE.md` for agent workflow rules.
