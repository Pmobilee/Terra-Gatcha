# Scenario 04: Special Rooms (Shop, Rest, Mystery)

## Goal
Test all special room types: shop (buy relic/card), rest room (heal/upgrade), and mystery event (resolve).

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Steps

1. Navigate to URL, wait 4s
2. Start a run (btn-start-run → domain → archetype), wait for combat
3. Play through encounters quickly (answer all correctly, end turn) until a special room appears in room selection, or until retreatOrDelve
4. If room selection shows special rooms, pick one. Otherwise, proceed through combat rooms.

### Testing via Direct Navigation (fallback)
If no special rooms appear naturally within 3 encounters:
5. Use `browser_evaluate` to set screen directly:
```javascript
globalThis[Symbol.for('terra:currentScreen')].set('shopRoom')
```
6. Wait 2s, take **Screenshot #1 (shop-room)**
7. Check shop UI: are relic items displayed? Are prices shown? Is buy button visible?
8. If buy buttons exist, click one: `[data-testid^="shop-buy-relic-"]`
9. Read state — did currency change?

10. Set screen to `restRoom`
11. Wait 2s, take **Screenshot #2 (rest-room)**
12. Check: heal button visible? Upgrade button visible?
13. Click `[data-testid="rest-heal"]` — note HP change
14. OR click `[data-testid="rest-upgrade"]` — note card upgrade

15. Set screen to `mysteryEvent`
16. Wait 2s, take **Screenshot #3 (mystery-event)**
17. Check: event text displayed? Continue button visible?
18. Click `[data-testid="mystery-continue"]`, wait 1s
19. Verify screen transitioned

### End
20. Navigate back to hub
21. Run filtered console check
22. Take **Screenshot #4 (final)**

## Checks
- Shop displays items with prices
- Rest room shows heal and upgrade options
- Mystery event shows text and continue button
- No "undefined" or empty text in any overlay
- Button clicks produce expected state changes
- No JS errors

## Report
Write JSON to `/tmp/playtest-04-special-rooms.json` and summary to `/tmp/playtest-04-special-rooms-summary.md`
