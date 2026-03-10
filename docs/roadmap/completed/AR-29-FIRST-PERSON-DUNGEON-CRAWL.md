# AR-29: First-Person Dungeon Crawl
> Phase: Post-Content UX
> Priority: Medium-Large
> Status: Core Implementation Completed (March 10, 2026)

## Summary

Converted combat and room traversal presentation to a first-person framing. The player avatar is removed from combat, enemies are centered and enlarged, encounter entry uses fade/zoom transitions, and room selection now uses a perspective hallway with doorways.

## Design Reference

From `docs/GAME_DESIGN.md`:

> "Shift combat and room exploration to first-person perspective."

> "Enemies and bosses rendered large and menacing, staring directly at you."

> "Room entry fade-in transitions for atmosphere."

> "First-person hallway view for door/room selection (2-3 doorways perspective)."

## Implementation

### Data Model
- Added first-person combat sizing by enemy category (`common`, `elite`/`mini_boss`, `boss`).
- Added room-selection perspective transform helpers for doorway offset/tilt.

### Logic
- Combat scene now tracks current enemy category and applies category-based scale.
- Encounter entry now triggers a fade-in + sprite zoom transition, with stronger treatment for boss entries.
- Hit/attack animations were tuned to first-person framing (camera shake + scale/lunge effects).

### UI
- `CombatScene`:
  - Removed player sprite visuals.
  - Centered enemy into first-person focal position.
  - Increased enemy/boss render sizes.
  - Added entry fade overlay and boss zoom-in effect.
  - Preserved HP/intent/relic display with updated spatial hierarchy.
- `RoomSelection.svelte`:
  - Replaced flat card row with hallway perspective scene.
  - Added vanishing-point floor treatment and 2-3 doorway perspective layout.
  - Added entry fade and doorway focus/dim transitions on selection.

### System Interactions
- Existing `encounterBridge` animation hooks remain intact (`playEnemyHitAnimation`, `playEnemyAttackAnimation`, `playPlayerDamageFlash`, etc.).
- No run-state schema changes required.

## Edge Cases

- Reduce-motion mode still bypasses high-motion tween/shake paths.
- Handles rooms with fewer options by collapsing hallway transform offsets.
- Fallback rectangle enemy rendering remains functional when enemy textures are missing.

## Files Modified

- `src/game/scenes/CombatScene.ts`
- `src/ui/components/RoomSelection.svelte`
- `docs/roadmap/PROGRESS.md`

## Done-When Checklist

- [x] Player sprite removed from combat framing.
- [x] Enemy is first-person focal target in combat viewport.
- [x] Bosses render larger with stronger intro.
- [x] Encounter entry fade/zoom is present.
- [x] Room selection uses hallway perspective doors.
- [x] First-person-aligned hit/attack feedback is implemented.
- [x] Typecheck/test suite passes after integration.
