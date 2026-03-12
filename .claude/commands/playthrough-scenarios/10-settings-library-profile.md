# Scenario 10: Settings, Library & Profile Screens

## Goal
Inspect non-run hub screens for completeness: settings panel, knowledge library, profile, and deck builder.

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Steps

### Settings
1. Navigate to URL, wait 4s
2. Navigate to settings screen (click settings nav button or use evaluate to set screen)
3. Take **Screenshot #1 (settings)**
4. CHECK: settings panel renders with options
5. CHECK: no "undefined"/"null" text
6. Check for audio, accessibility, language sections
7. Navigate back to hub

### Library
8. Navigate to library screen
9. Take **Screenshot #2 (library)**
10. CHECK: card browser renders
11. CHECK: deck builder section accessible
12. CHECK: study mode options visible
13. Snapshot DOM — check for data artifacts
14. Navigate back to hub

### Profile
15. Navigate to profile screen
16. Take **Screenshot #3 (profile)**
17. CHECK: player stats displayed (runs completed, facts learned, etc.)
18. CHECK: values are numbers not NaN/undefined
19. Navigate back to hub

### Deck Builder (if accessible from library)
20. Navigate to library → deck builder
21. Take **Screenshot #4 (deck-builder)**
22. CHECK: cards listed
23. CHECK: deck size displayed

### Final
24. Run filtered console check across all screen visits
25. Return to hub

## Checks
- Settings renders without errors
- Library shows card collection
- Profile shows valid stats
- Deck builder accessible and functional
- No data artifacts on any screen
- All navigation works bidirectionally

## Report
Write JSON to `/tmp/playtest-10-screens.json` and summary to `/tmp/playtest-10-screens-summary.md`
