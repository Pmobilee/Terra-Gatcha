# AR-24: Launch Balance & UX Pass
> Phase: Game Design Overhaul
> Priority: High
> Status: Completed (March 9, 2026)

## Summary

Applied launch-focused balance and UX tuning to improve readability, onboarding smoothness, and early-run fairness while preserving core combat depth.

## Design Reference

From `docs/GAME_DESIGN.md`:

> Launch uses tighter mechanic gating, simplified visible mastery tiers, and clearer onboarding framing.

## Implementation

### Data / Config
- Introduced/updated launch phase gating for mechanics.
- Updated difficulty-mode labeling and reward multipliers.
- Simplified visible tier naming while preserving internal tier logic.

### Logic
- Enforced Story Mode behavior for earliest runs.
- Updated early-run unlock behavior (e.g., archetype visibility timing).
- Added wowFactor display constraints for answer feedback moments.

### UI
- Refined onboarding/domain framing copy.
- Updated difficulty labels and surfaced UX clarifications in relevant screens.

### System Interactions
- Review prompt triggers aligned with milestone moments and cooldown policies.

## Edge Cases

- Prevented early-run overload by hiding advanced choices until intended unlock points.
- Preserved internal mastery progression behavior despite simplified tier display names.

## Files Modified

- balance/config services
- onboarding/settings/run-end UI
- tier display helpers
- review prompt service + docs

## Done-When Checklist

- [x] Launch mechanic gating configured.
- [x] Difficulty labels/reward tuning updated.
- [x] Tier display simplification shipped.
- [x] Early-run flow polish and review prompt hooks verified.
