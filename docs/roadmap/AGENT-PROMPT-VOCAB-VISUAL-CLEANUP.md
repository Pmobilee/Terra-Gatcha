# Agent Prompt: Delete Vocab Visual Descriptions + Regenerate with Language Theming

> **Give this prompt to your Claude Code agent on your remote machine.**
> It handles: (1) deleting all existing vocab visual descriptions, (2) updating the generation script with per-language cultural theming, (3) regenerating all 400 Japanese N3 descriptions.

---

## PROMPT (copy everything below this line)

---

You have three tasks. Do them in order.

### Task 1: Delete ALL vocab visual descriptions from seed data

Open `src/data/seed/vocab-n3.json`. For every object in the array, set `"visualDescription"` to `null`. Do NOT delete any other fields. Do NOT modify `facts-general.json` — those visual descriptions are fine.

Verify: After editing, run this to confirm all are null:
```bash
node -e "const d=JSON.parse(require('fs').readFileSync('src/data/seed/vocab-n3.json','utf8')); const has=d.filter(f=>f.visualDescription&&f.visualDescription!=='null'); console.log('Remaining non-null visualDescriptions:', has.length, '(should be 0)')"
```

Also clear the visual_description column for all vocabulary rows in the cardback SQLite database if it exists:
```bash
# Check if cardback DB exists
ls sprite-gen/cardback-tool/cardbacks.db 2>/dev/null && sqlite3 sprite-gen/cardback-tool/cardbacks.db "UPDATE cardbacks SET visual_description = NULL, status = 'pending' WHERE fact_type = 'vocabulary';"
```

### Task 2: Update the visual description generator with per-language cultural theming

Open `sprite-gen/scripts/generate-visual-descriptions.mjs`. Find the system prompt string used for generating visual descriptions. Modify it so that:

1. It accepts a `--language` CLI argument (e.g., `--language ja`)
2. When `--language ja` is passed, APPEND this to the system prompt:

```
CRITICAL — CULTURAL THEMING (Japanese vocabulary):
Every scene MUST be unmistakably set in Japan. Use feudal, Edo-period, or traditional Japanese settings.

REQUIRED ELEMENTS (use at least 2 per description):
- Architecture: torii gates, pagodas, tatami rooms, shoji screens, castle towns, wooden bridges, thatched roofs
- Nature: bamboo forests, cherry blossoms, koi ponds, zen rock gardens, misty mountains, rice paddies
- Cultural: tea ceremonies, calligraphy brushes, paper lanterns, shrine bells, incense, silk kimonos
- People: samurai, monks, merchants, artisans, fishermen (all stylized pixel art, no realistic faces)
- Settings: moonlit temple roofs, bustling Edo markets, mountain hot springs, coastal fishing villages

COLOR PALETTE: Ukiyo-e influence — deep indigos, warm ambers, cherry blossom pink, moss green, twilight purple, lantern gold.

CRITICAL RULE: The scene must ILLUSTRATE THE MEANING of the word using Japanese cultural elements.
- "to calculate" → A merchant in a lantern-lit Edo shop carefully moving beads on a soroban abacus
- "to endure" → A samurai kneeling motionless in falling snow before a weathered temple gate
- "to translate" → A scholar in a candlelit room surrounded by scrolls, brush poised between kanji and foreign text
- "to export" → A bustling harbor with workers loading silk-wrapped crates onto a wooden trading vessel at sunrise

BAD examples (REJECT these patterns):
- Generic fantasy with no Japanese elements
- Just "a person doing X" with no cultural setting
- Glowing orbs, magic portals, generic wizards — these belong to general facts, NOT vocab cards
- Offensive stereotypes or modern settings (no neon, no anime tropes)
```

3. When `--language es` is passed, APPEND:

```
CRITICAL — CULTURAL THEMING (Spanish vocabulary):
Every scene MUST be unmistakably set in Spain or Latin America.

REQUIRED ELEMENTS (use at least 2 per description):
- Architecture: terracotta plazas, haciendas, Moorish arches, colonial churches, adobe walls
- Nature: agave fields, jungle cenotes, olive groves, volcanic landscapes, desert mesas
- Cultural: flamenco dancers, guitar players, bull arenas, mercados, Day of the Dead altars
- People: matadors, conquistadors, artisans, farmers, musicians (stylized pixel art)
- Settings: sun-drenched courtyards, candlelit cantinas, Mediterranean harbors, Aztec temple ruins

COLOR PALETTE: Warm sunset tones — burnt orange, terracotta red, golden yellow, turquoise, deep crimson.
```

4. When `--language fr` is passed, APPEND:

```
CRITICAL — CULTURAL THEMING (French vocabulary):
Every scene MUST be unmistakably set in France or French-speaking regions.

REQUIRED ELEMENTS (use at least 2 per description):
- Architecture: cobblestone cafés, cathedral stained glass, château gardens, wrought-iron balconies
- Nature: lavender fields, vineyard hillsides, misty river bridges, poplar-lined roads
- Cultural: patisserie windows, wine barrels, beret-wearing painters, bookshop stalls along the Seine
- People: bakers, artists, musketeers, vineyard workers (stylized pixel art)
- Settings: Parisian rooftops at dusk, Provençal markets, candlelit bistros, fog-wrapped lighthouses

COLOR PALETTE: Soft pastels — powder blue, dusty rose, cream, sage green, warm gold, violet twilight.
```

5. If no `--language` flag is passed, keep the existing generic system prompt (for general knowledge facts).

6. Add a `--reset` flag that clears the checkpoint file (`.vd-checkpoint.json`) for the target file, forcing regeneration of all descriptions.

### Task 3: Regenerate all 400 Japanese N3 visual descriptions

Run the updated script:
```bash
node sprite-gen/scripts/generate-visual-descriptions.mjs --language ja --reset --file vocab-n3
```

Wait for it to complete. Then spot-check 10 random descriptions:
```bash
node -e "const d=JSON.parse(require('fs').readFileSync('src/data/seed/vocab-n3.json','utf8')); const sample=d.filter(f=>f.visualDescription).sort(()=>Math.random()-0.5).slice(0,10); sample.forEach(f=>console.log(f.id, f.statement.slice(0,30), '→', f.visualDescription))"
```

Verify that:
- All 400 have non-null visualDescription
- Each description contains at least 2 Japanese cultural elements
- No descriptions contain generic fantasy (glowing orbs, magic portals, etc.)
- Each description relates to the word's meaning, not just a random Japanese backdrop

### After all three tasks:

1. Rebuild the seed pack: `npm run build` (or whatever command compiles seed data)
2. Run typecheck: `npm run typecheck`
3. Commit with message: "feat: delete generic vocab visual descriptions, add language-themed regeneration pipeline, regenerate 400 JP N3 descriptions"
