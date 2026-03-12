# Scenario 06: Retreat, Delve & Run End

## Goal
Test the segment checkpoint (retreat vs delve) and run end screens.

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Steps

### Path A: Test Retreat
1. Navigate to URL, wait 4s
2. Start a run, play through encounters until `retreatOrDelve` screen appears
3. If not reached after 5 encounters, use evaluate to set screen:
```javascript
globalThis[Symbol.for('terra:currentScreen')].set('retreatOrDelve')
```
4. Take **Screenshot #1 (checkpoint)**
5. CHECK: retreat button visible, delve button visible
6. CHECK: currency amount displayed, HP displayed, death penalty shown
7. Click `[data-testid="btn-retreat"]`, wait 2s
8. Verify screen = `runEnd`
9. Take **Screenshot #2 (run-end)**

### Run End Screen
10. CHECK: currency earned displayed
11. CHECK: play-again button visible (`btn-play-again`)
12. CHECK: home button visible (`btn-home`)
13. Click `[data-testid="btn-home"]`, wait 2s
14. Verify screen = `hub`

### Path B: Test Delve (separate run)
15. Start another run, play to checkpoint
16. Click `[data-testid="btn-delve"]`, wait 2s
17. Verify screen = `combat` or `roomSelection` (next segment started)
18. Take **Screenshot #3 (post-delve)**

## Checks
- Checkpoint shows retreat and delve buttons
- Currency and HP values are numbers
- Retreat transitions to runEnd
- Run end shows results and navigation buttons
- Delve transitions to next combat segment
- Home button returns to hub

## Report
Write JSON to `/tmp/playtest-06-retreat-delve.json` and summary to `/tmp/playtest-06-retreat-delve-summary.md`
