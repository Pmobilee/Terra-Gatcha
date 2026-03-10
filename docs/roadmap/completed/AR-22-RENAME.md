# AR-22: Rename to Recall Rogue
> Phase: Game Design Overhaul
> Priority: High
> Status: Completed (March 9, 2026)

## Summary

Renamed the project identity from legacy names ("Arcane Recall", "Terra Gacha") to **Recall Rogue** across app code, build/config files, docs, and store-facing metadata.

## Design Reference

From `docs/GAME_DESIGN.md`:

> Recall Rogue is the canonical game name and source-of-truth identity.

## Implementation

### Data / Naming Model
- Unified canonical app name to `Recall Rogue`.
- Removed outdated naming references from user-facing copy and technical metadata.

### Logic / Systems
- Updated references in routing labels, service strings, and static copy where legacy names were still surfaced.
- Aligned build/deploy metadata to the same canonical product name.

### UI / UX
- Updated visible labels and app identity text in web/native shells.

### System Interactions
- Updated ecosystem touchpoints (docs/config/store copy) so release tooling and runtime surfaces use one name.

## Edge Cases

- Prevented mixed-name regressions where old strings could reappear from stale docs or config templates.

## Files Modified

- `docs/` (design + roadmap docs)
- app/web/native config files
- UI copy and metadata files

## Done-When Checklist

- [x] Legacy product names removed from active app/docs/config.
- [x] Canonical name `Recall Rogue` used consistently.
- [x] Build/runtime/store-facing metadata aligned to the new name.
