# AR-28: Reward Altar (Loot Presentation Overhaul)
> Phase: Post-Content UX
> Priority: Medium-Large
> Status: Core Implementation Completed (March 10, 2026)

## Summary

Replaced the flat post-encounter reward list with an atmospheric Reward Altar scene while preserving AR-09 type-selection logic. Players now inspect physical reward icons, preview fact content, and collect with animated feedback.

## Design Reference

From `docs/GAME_DESIGN.md`:

> "A spotlight cone illuminates a surface from above"

> "Surface style varies by biome: stone slab (caves), wooden table (library), mossy altar (forest), ornate pedestal (temple)"

> "Tap an icon → it lifts, spotlight focuses, stats tooltip appears below"

> "On select → chosen reward flies to deck/inventory, others fade to shadow"

> "Each icon has subtle idle animation (bob, shimmer, glow pulse)"

## Implementation

### Data Model
- Added in-component biome metadata (`cave-stone`, `library-oak`, `forest-moss`, `temple-marble`, `obsidian-vault`).
- Added typed icon pools per `CardType`, with deterministic icon selection from fact/card seeds.
- Added decorative trinket metadata to represent gold/potion/relic atmosphere.

### Logic
- Preserved existing reward contract (`options`, `onselect`, `onskip`, `onreroll`).
- Added inspect state (`selectedType`), selection lock, and collect animation gate before final selection callback.
- Added deterministic biome/icon selection on reward load.
- Added cue triggers for altar intro, hover, reroll, and collect.

### UI
- Rebuilt screen as layered altar scene:
  - Spotlight cone
  - Biome-dependent altar surface
  - Cloth overlay
  - Interactive icon cards
  - Inspect panel + fact preview
- Added icon motion and feedback animations (bob, shimmer, glow pulse, collect fly-out).
- Added dim/fade behavior for non-selected rewards during collect.
- Kept `data-testid` hooks for reward buttons (`reward-type-*`, `reward-reroll`, `reward-accept`).

### System Interactions
- Fully integrated with existing AR-09 reward generation and reroll flow.
- No changes required to `gameFlowController` reward state transitions.

## Edge Cases

- Handles missing/empty options with safe fallback text.
- Resets selection if selected type is no longer present after reroll.
- Prevents duplicate selects while collect animation is in-flight.
- Keeps mobile layout usable by collapsing altar options to one column on small screens.

## Files Modified

- `src/ui/components/CardRewardScreen.svelte`
- `docs/roadmap/PROGRESS.md`

## Done-When Checklist

- [x] Altar scene replaces basic reward list UI.
- [x] Biome surface variants are present.
- [x] Reward icon set and inspect interactions are implemented.
- [x] Collect animation + shadow fade behavior are implemented.
- [x] Existing reward flow wiring remains intact.
- [x] Typecheck/test/build pass after integration.
- [ ] Optional handcrafted pixel-art icon sprite asset pack (future art/content pass).
