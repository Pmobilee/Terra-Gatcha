# AR-25: Push Notifications
> Phase: Game Design Overhaul
> Priority: Medium
> Status: Completed (March 9, 2026)

## Summary

Implemented local push notification scheduling for retention with priority ordering, quiet-hour handling, daily limits, and per-type settings controls.

## Design Reference

From `docs/GAME_DESIGN.md`:

> Notification priorities: streak risk > milestone proximity > facts due > win-back, with max 1 per day and quiet hours.

## Implementation

### Data Model
- Added persisted notification preferences (master + per-type toggles).
- Added state for last-sent guardrails and scheduling metadata.

### Logic
- Implemented scheduler priority rules and quiet-hour adjustment.
- Added reschedule behavior on app open and run completion.
- Added platform-safe no-op behavior for web.

### UI
- Added settings controls for notification opt-in and sub-type toggles.

### System Interactions
- Connected triggers to run completion/session lifecycle points.

## Edge Cases

- No duplicate spam from repeated app opens.
- Quiet-hour events deferred appropriately.
- Safe behavior when permissions denied or plugin unavailable.

## Files Modified

- notification service
- settings panel/preferences state
- app bootstrap/run flow integration
- docs

## Done-When Checklist

- [x] Four notification categories implemented.
- [x] Priority + daily cap + quiet hours enforced.
- [x] Settings toggles and permission handling integrated.
- [x] Web fallback remains safe no-op.
