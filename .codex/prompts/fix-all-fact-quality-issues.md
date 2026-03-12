# Codex Task: Fix ALL Fact Quality Issues in Recall Rogue DB

**Model recommendation:** GPT-5.2 (best balance of quality and throughput for structured content work)

## Context

This is a Svelte + TypeScript card roguelite game where every card is a quiz fact. The facts database at `public/facts.db` (SQLite, 46,780 facts) has quality issues that make ~6,000 facts partially or fully unplayable. Each fact becomes a 3-option multiple choice question in-game: 1 correct answer + 2 distractors randomly picked from a pool of 3+.

## Issues to Fix (ALL of them)

### Issue 1: 3,895 facts have ZERO distractors (CRITICAL — unplayable)

These facts render as single-option "questions" with no wrong answers — completely broken gameplay.

**Breakdown by domain/subcategory:**

| Domain | Subcategory | Count |
|---|---|---|
| Geography | capitals_countries | 387 |
| General Knowledge | landmarks_wonders | 190 |
| Geography | americas | 156 |
| Animals & Wildlife | birds | 101 |
| Art & Architecture | historic_buildings | 107 |
| History | battles_military | 106 |
| Human Body & Health | anatomy_organs | 117 |
| Space & Astronomy | missions_spacecraft | 99 |
| Mythology & Folklore | greek_roman | 98 |
| Natural Sciences | chemistry_elements | 91 |
| Geography | asia_oceania | 86 |
| Food & World Cuisine | european_cuisine | 84 |
| Natural Sciences | biology_organisms | 85 |
| Animals & Wildlife | mammals | 72 |
| Mythology & Folklore | folk_legends | 72 |
| Food & World Cuisine | food_history | 72 |
| Art & Architecture | museums_institutions | 69 |
| General Knowledge | everyday_science | 66 |
| Human Body & Health | brain_neuro | 65 |
| Natural Sciences | physics_mechanics | 64 |
| Food & World Cuisine | asian_cuisine | 64 |
| Art & Architecture | painting_visual | 62 |
| Geography | africa | 59 |
| History | early_modern | 57 |
| Food & World Cuisine | food_science | 55 |
| Natural Sciences | materials_engineering | 53 |
| Food & World Cuisine | ingredients_spices | 52 |
| History | ancient_classical | 51 |
| Space & Astronomy | stars_galaxies | 51 |
| Animals & Wildlife | marine_life | 48 |
| History | modern_contemporary | 47 |
| Space & Astronomy | satellites_tech | 46 |
| Mythology & Folklore | creatures_monsters | 47 |
| Mythology & Folklore | creation_cosmology | 45 |
| Human Body & Health | digestion_metabolism | 41 |
| History | world_wars | 40 |
| Human Body & Health | cardiovascular | 38 |
| Space & Astronomy | cosmology_universe | 37 |
| Animals & Wildlife | conservation | 34 |
| Art & Architecture | modern_contemporary | 34 |
| Art & Architecture | engineering_design | 33 |
| Mythology & Folklore | norse_celtic | 33 |
| General Knowledge | inventions_tech | 32 |
| Food & World Cuisine | fermentation_beverages | 31 |
| Mythology & Folklore | eastern_myths | 31 |
| Natural Sciences | geology_earth | 30 |
| Animals & Wildlife | reptiles_amphibians | 27 |
| Human Body & Health | senses_perception | 27 |
| Geography | europe | 26 |
| Geography | landforms_water | 26 |
| Human Body & Health | immunity_disease | 26 |
| Human Body & Health | genetics_dna | 26 |
| Art & Architecture | sculpture_decorative | 25 |
| Food & World Cuisine | baking_desserts | 25 |
| Art & Architecture | architectural_styles | 23 |
| Animals & Wildlife | insects_arachnids | 21 |
| General Knowledge | pop_culture | 21 |
| Natural Sciences | botany_plants | 20 |
| Geography | extreme_records | 19 |
| Animals & Wildlife | behavior_intelligence | 18 |
| Animals & Wildlife | adaptations | 18 |
| Mythology & Folklore | gods_deities | 18 |
| Space & Astronomy | exoplanets_astrobio | 16 |
| Human Body & Health | medical_science | 15 |
| General Knowledge | words_language | 14 |
| Food & World Cuisine | world_cuisine | 13 |
| Natural Sciences | ecology_environment | 13 |
| General Knowledge | records_firsts | 9 |
| Geography | climate_biomes | 8 |
| History | medieval | 24 |
| History | social_cultural | 4 |
| Language | german | 1 |

### Issue 2: 967 facts have the answer embedded in the question text

The correct answer (5+ chars) appears verbatim in the question, making it trivially solvable without knowledge. These questions need to be REWRITTEN so the answer is not given away.

### Issue 3: 1,148 vocabulary facts have vague "What does this mean?" questions

These questions don't specify WHICH word is being asked about. Breakdown:
- Spanish (es): 748
- German (de): 400

These need the target word inserted into the question, e.g.:
- BAD: "What does this mean?" → answer: "to turn off"
- GOOD: "What does 'apagar' mean in English?" → answer: "to turn off"

The target word is available in the `statement` column of these facts.

### Issue 4: ~196 knowledge facts have truncated/malformed questions (<20 chars)

Examples: "What drink made?" — these need to be rewritten into complete, clear questions using the `statement` and `correct_answer` columns as context.

### Issue 5: ~12 facts have placeholder distractors

Distractors matching patterns like "Alternative option 3", "other meaning", "another option", etc. These need to be replaced with real, plausible wrong answers.

## DB Schema

The SQLite DB (`public/facts.db`) uses `better-sqlite3`. Key columns on `facts` table:

```
id              TEXT    — unique fact ID
type            TEXT    — "fact" or "vocabulary"
statement       TEXT    — the underlying knowledge statement
quiz_question   TEXT    — the question shown to the player
correct_answer  TEXT    — the correct answer
distractors     TEXT    — JSON array of strings: ["wrong1", "wrong2", "wrong3"]
category_l1     TEXT    — domain: "Animals & Wildlife", "Language", etc.
category_l2     TEXT    — subcategory: "birds", "mammals", etc.
language        TEXT    — language code for vocab: "ja", "es", "de", etc. (NULL for knowledge facts)
explanation     TEXT    — explanation shown after answering
variants        TEXT    — JSON array of variant questions (optional)
status          TEXT    — "approved"
```

Answer check columns (already exist):
```
answer_check_issue      TEXT    — issue description (empty = clean)
answer_check_needs_fix  INTEGER — 0 or 1
answer_check_checked_at INTEGER — Unix ms timestamp
answer_check_checked_by TEXT    — checker ID
answer_check_fixed_at   INTEGER — Unix ms timestamp
answer_check_fixed_by   TEXT    — fixer ID
```

## Available Tools

### Check command (flags issues in DB):
```bash
npm run content:qa:answer-check:db -- check \
  --db public/facts.db \
  --checker <your-id> \
  --limit <N> \
  --offset <N>
```

### Export flagged facts to JSONL:
```bash
npm run content:qa:answer-check:db -- export-flagged \
  --db public/facts.db \
  --limit <N> \
  --output <path>.jsonl
```

### Apply fixes from JSONL back to DB:
```bash
npm run content:qa:answer-check:db -- apply-fixes \
  --db public/facts.db \
  --input <path>.jsonl \
  --fixer <your-id>
```

### Preview facts as player sees them:
```bash
npm run content:qa:answer-check:db -- preview \
  --db public/facts.db \
  --limit 20 \
  --output <path>.md
```

### Rebuild facts DB from source JSON (run after all fixes):
```bash
node scripts/build-facts-db.mjs
```

## Execution Plan

### Phase 1: Flag all issues
```bash
npm run content:qa:answer-check:db -- check \
  --db public/facts.db \
  --checker gpt-5.2-quality-audit \
  --limit 50000
```

### Phase 2: Export all flagged facts
```bash
npm run content:qa:answer-check:db -- export-flagged \
  --db public/facts.db \
  --limit 50000 \
  --output data/generated/qa-reports/answer-check-live-db/flagged-all.jsonl
```

### Phase 3: Fix each issue type

Process the exported JSONL. For each fact, apply the appropriate fix based on its `answerCheckIssue` field. Write a Node.js script that reads the JSONL, fixes each fact, and writes a fixed JSONL.

You can also work directly on the DB with `better-sqlite3` if that's more efficient — just be careful to update all the answer_check columns.

#### 3A: Generate missing distractors (3,895 facts)

For each fact missing distractors, generate **exactly 5 plausible wrong answers**. Rules:

1. **Same domain, same subcategory** — a Geography/capitals question gets other capital cities, not random words
2. **Same difficulty level** — if the answer is "Khartoum", distractors should be other African capitals, not "Paris"
3. **Same format as the answer** — if answer is "1339", distractors are other years. If "Temple of Jupiter", distractors are other temples
4. **NEVER include the correct answer** as a distractor
5. **NEVER use generic garbage words**: approach, concept, method, practice, process, system, theory, technique, book, chair, door, house, tree, table, to change, to find, to know, to make, to move, etc. (see `GARBAGE_DISTRACTORS` set in `scripts/content-pipeline/qa/shared.mjs`)
6. **NEVER use placeholder text**: "Alternative option", "other meaning", "wrong answer", "Option A", etc. (see `PLACEHOLDER_RE` in same file)
7. **No duplicate distractors** — all 5 must be distinct
8. **Each distractor must be factually WRONG** for the question — they must be plausible but incorrect
9. each distraxgtor must be of similar length and form, so that recognizing specific charatceristics of the answers doesnt lead to rememebring the longest answer, isntead of understanding the correct answer

**Strategy by domain:**
- **Geography/capitals_countries** (387): Use other capitals from the same continent/region
- **Geography/americas, asia_oceania, africa** (301): Use other places from the same region
- **History/battles_military** (106): Use other battles from the same era
- **Space/missions_spacecraft** (99): Use other missions/spacecraft from the same era
- **Animals/birds, mammals** (173): Use other species from the same taxonomic group
- **Mythology/greek_roman** (98): Use other figures from the same mythology
- **General Knowledge/landmarks** (190): Use other landmarks from the same category
- For all: look at the `category_l2` subcategory and generate distractors that a student of that specific topic would find plausible

#### 3B: Rewrite answer-in-question facts (967 facts)

Rewrite `quiz_question` so the correct answer is NOT contained in the question text. The question must still be answerable and test the same knowledge. Use the `statement` column for context.

Example:
- BAD: Q: "What is the capital of France, also known as Paris?" A: "Paris"
- GOOD: Q: "What is the capital of France?" A: "Paris"

#### 3C: Fix vague vocabulary questions (1,148 facts)

For facts where `quiz_question = "What does this mean?"`:
1. Read the `statement` column to get the target word
2. Read the `language` column to get the language
3. Rewrite the question to include the target word

Format by language:
- Spanish: `"What does '{word}' mean in English?"`
- German: `"What does '{word}' mean in English?"`

If `statement` is empty or unhelpful, construct the question from `correct_answer` context.

#### 3D: Fix truncated questions (196 facts)

For facts where `LENGTH(quiz_question) < 20`:
1. Read `statement`, `correct_answer`, `category_l1`, `category_l2`
2. Rewrite into a clear, complete question that tests the same knowledge
3. Ensure the answer is NOT embedded in the rewritten question

#### 3E: Replace placeholder distractors (12 facts)

For facts with distractors matching placeholder patterns, replace only the bad distractors with real ones following the same rules as 3A.

### Phase 4: Apply all fixes back to DB
```bash
npm run content:qa:answer-check:db -- apply-fixes \
  --db public/facts.db \
  --input data/generated/qa-reports/answer-check-live-db/reviewed/fixed-all.jsonl \
  --fixer gpt-5.2-fix-1
```

### Phase 5: Verify — run check again on full DB
```bash
npm run content:qa:answer-check:db -- check \
  --db public/facts.db \
  --checker gpt-5.2-verify \
  --limit 50000 \
  --report data/generated/qa-reports/answer-check-live-db/check-report-post-fix.json
```

Expected: **0 flagged facts** (or very close to 0).

### Phase 6: Preview a random sample to sanity-check
```bash
npm run content:qa:answer-check:db -- preview \
  --db public/facts.db \
  --limit 50 \
  --output data/generated/qa-reports/answer-check-live-db/preview-post-fix.md
```

Read the output and confirm the questions look correct and the distractors are plausible.

### Phase 7: Rebuild the DB
```bash
node scripts/build-facts-db.mjs
```

## Quality Gates (MUST ALL PASS before done)

1. `npm run content:qa:answer-check:db -- check --limit 50000` → **flagged: 0** (or <10)
2. No fact has `distractors = '[]'` or empty distractors
3. No fact has `quiz_question = 'What does this mean?'`
4. No knowledge fact has `LENGTH(quiz_question) < 20`
5. Random preview of 50 facts shows clean, playable questions with plausible distractors
6. `node scripts/build-facts-db.mjs` completes with no errors
7. All distractors pass the garbage/placeholder check in `scripts/content-pipeline/qa/shared.mjs`

## Important Constraints

- **DO NOT delete any facts** — fix them in place
- **DO NOT change `correct_answer`** unless it's provably wrong (extremely rare)
- **DO NOT change `id`, `category_l1`, `category_l2`, `type`, `language`** — these are structural
- **DO NOT use any external API** — work entirely with the local DB and scripts
- **Distractors MUST be a valid JSON array of strings** in the `distractors` column: `["wrong1","wrong2","wrong3","wrong4","wrong5"]`
- **Work in batches** — process 500-1000 facts at a time to avoid memory issues
- After fixing, always verify with the `check` command before moving to the next batch
- The GARBAGE_DISTRACTORS blocklist in `scripts/content-pipeline/qa/shared.mjs` is authoritative — any distractor matching that set will be flagged as bad

## Direct DB Access Pattern (if not using the JSONL export/import flow)

```javascript
const Database = require('better-sqlite3');
const db = new Database('public/facts.db');

// Read facts that need fixing
const facts = db.prepare(`
  SELECT id, statement, quiz_question, correct_answer, distractors,
         category_l1, category_l2, language, type, explanation
  FROM facts
  WHERE distractors IS NULL OR distractors = '[]' OR distractors = ''
  LIMIT 500
`).all();

// Update a fact with new distractors
const update = db.prepare(`
  UPDATE facts SET
    distractors = ?,
    quiz_question = ?,
    answer_check_issue = '',
    answer_check_needs_fix = 0,
    answer_check_fixed_at = ?,
    answer_check_fixed_by = ?
  WHERE id = ?
`);

const now = Date.now();
for (const fact of facts) {
  const newDistractors = generateDistractors(fact); // your logic
  const newQuestion = fixQuestion(fact); // your logic
  update.run(
    JSON.stringify(newDistractors),
    newQuestion,
    now,
    'gpt-5.2-fix',
    fact.id
  );
}

db.close();
```

## Success Criteria

When done, run this final verification:
```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('public/facts.db');
const noD = db.prepare(\"SELECT COUNT(*) as c FROM facts WHERE distractors IS NULL OR distractors = '[]' OR distractors = ''\").get();
const aiq = db.prepare(\"SELECT COUNT(*) as c FROM facts WHERE LENGTH(correct_answer) >= 5 AND INSTR(LOWER(quiz_question), LOWER(correct_answer)) > 0\").get();
const vague = db.prepare(\"SELECT COUNT(*) as c FROM facts WHERE quiz_question = 'What does this mean?'\").get();
const short = db.prepare(\"SELECT COUNT(*) as c FROM facts WHERE type = 'fact' AND LENGTH(quiz_question) < 20\").get();
console.log('Missing distractors:', noD.c, noD.c === 0 ? 'PASS' : 'FAIL');
console.log('Answer in question:', aiq.c, aiq.c < 10 ? 'PASS' : 'FAIL');
console.log('Vague vocab questions:', vague.c, vague.c === 0 ? 'PASS' : 'FAIL');
console.log('Truncated questions:', short.c, short.c < 5 ? 'PASS' : 'FAIL');
db.close();
"
```

All four should show **PASS**.
