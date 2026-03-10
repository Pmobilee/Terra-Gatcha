# AR-23: Run Structure Overhaul
> Phase: Game Design Overhaul
> Priority: High
> Status: Completed (March 9, 2026)

## Summary

Reworked run progression from short runs into a 24-floor dungeon structure with segmented progression, boss cadence, save/resume, campfire pause flow, and post-boss special events.

## Design Reference

From `docs/GAME_DESIGN.md`:

> 24-floor dungeon across 4 segments, with boss checkpoints and retreat-or-delve risk progression.

## Implementation

### Data Model
- Added/updated run progression metadata to support 24 floors and segment-based penalties.
- Added boss/mini-boss scheduling and checkpoint semantics.

### Logic
- Implemented 3-encounter floor loop with boss floor handling.
- Added save/resume checkpoints and run continuation state.
- Added retreat-or-delve checkpoints and segment-based death retention tuning.

### UI
- Added/updated campfire pause flow and limited hub access while run is active.
- Added special-event presentation after boss floors.

### System Interactions
- Ensured run state serialization/deserialization supports mid-run return and resume.

## Edge Cases

- Safe resume after app reopen/background.
- Guardrails for abandoning active run vs resuming.
- Correct event/checkpoint ordering on boss floors.

## Files Modified

- core run flow and encounter orchestration
- save/resume state services
- pause/event UI components
- design/progress docs

## Done-When Checklist

- [x] 24-floor segmented run model implemented.
- [x] Boss/mini-boss cadence integrated.
- [x] Save/resume + campfire pause flow operational.
- [x] Retreat-or-delve and post-boss events integrated.
