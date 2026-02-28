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
1. `d5f4f78` — Fix DivePrepScreen `$derived()` -> `$derived.by()` for Svelte 5 multi-statement derivations
2. `1e944e2` — Fix click handling by adding `pointer-events:auto` to all UI overlays site-wide
3. `3da90bc` — Add `@playwright/mcp` server to opencode config for browser testing
4. `ab56eaa` — Fix mine tiles invisible due to `camera.worldView` being uninitialized during `create()`
5. `322c977` — Fix pointer-event propagation so Phaser canvas receives clicks correctly
6. `516f255` — Add fallback for `crypto.randomUUID` on non-HTTPS contexts
7. `83e48c6` — Add DevPanel for god-mode testing and fix oxygen persistence on init
8. `1d9d809` — Replenish oxygen after dives and seed 5 starter facts for new players
9. `c3d492f` — Implement complete MVP (all 25 steps: data layer, mine systems, scene/UI, full loop)
10. `f5ca221` — Add Japanese JLPT N3 seed content (50 vocabulary entries)

## Known Issues / Polish Needed

### High Priority
- [ ] Quiz gate blocks: verify passing quiz avoids oxygen penalty
- [ ] Camera offset: player should start mid-screen (not top edge) — **in progress**
- [ ] Backpack click: remove "click player tile to open backpack" — **in progress**

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

1. **Finish current polish** (camera offset, backpack click, quiz gate verification)
2. **Playtesting** — test on mobile device via Tailscale/LAN
3. **Balance tuning** — adjust oxygen costs, block hardness, artifact drop rates based on feel
4. **Documentation** — update README with setup/run instructions
5. **Deployment** — Capacitor build for Android/iOS

## Testing Access

- Dev server: `npm run dev` -> `http://0.0.0.0:5173`
- Tailscale: `http://100.74.153.81:5173`
- LAN: `http://192.168.122.96:5173`
- DevPanel: Click "DEV" button (top-right) for god-mode testing

## Architecture Reference

See `docs/MVP_PLAN.md` for the complete implementation spec.
See `CLAUDE.md` for agent workflow rules.
