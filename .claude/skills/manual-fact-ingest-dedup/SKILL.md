---
name: manual-fact-ingest-dedup
description: Autonomous end-to-end content factory. Generates knowledge facts from Wikidata raw data and vocabulary from Anki decks, all via Haiku sub-agents. Handles normalization, dedup, and DB rebuild.
---

# manual-fact-ingest-dedup

## Mission
Run the full content pipeline autonomously: raw data → Haiku-processed facts → universal normalizer → deduplicated DB.

## Non-Negotiable Rules
- **ABSOLUTE: No Anthropic API** — We do NOT have an API key. NEVER write scripts that call `@anthropic-ai/sdk` or any external LLM API. ALL LLM work (fact generation, quality checks, transformations) MUST be done by spawning Haiku sub-agents via the Claude Code Agent tool (`model: "haiku"`). The `LOCAL_PAID_GENERATION_DISABLED = true` flag in `haiku-client.mjs` must stay true.
- Keep every new fact schema-valid.
- Every fact MUST have `_haikuProcessed: true` before DB insertion.
- `categoryL2` is mandatory for canonical domains (use IDs from `src/data/subcategoryTaxonomy.ts`).

## Current Database State
- **33,766 facts** in `src/data/seed/facts-generated.json` (34,289 total in DB with seed files)
- **~10,423 knowledge facts** across 10 domains
- **~23,343 vocabulary facts** across 7 languages
- **Knowledge domains**: animals_wildlife, general_knowledge, human_body_health, food_cuisine, geography, art_architecture, history, mythology_folklore, natural_sciences, space_astronomy
- **Languages**: ko (7,686), es (5,575), de (4,778), it (1,924), fr (1,200), nl (1,131), cs (1,049) — Japanese pending Anki deck
- **All 5 Anki decks fully exhausted**: Spanish, Korean, German, Dutch, Czech

## Mandatory Haiku Processing (All Facts)
Every single fact that enters the database MUST be processed by a Haiku agent.

### What Haiku agents must do for each fact:
1. **Assess worth** — Is this fact interesting/educational enough for a quiz game? Reject boring/trivial/too-obscure facts.
2. **Write/rewrite quiz question** — Clear, concise, 10-20 words, ends with ?
3. **Write correct answer** — Short (1-5 words), definitive
4. **Generate 3+ plausible distractors** — Same type as correct answer. BLOCKLIST: "Unknown", "Other", "None of the above", "None of these", "All of the above", "N/A", "...", "", single-character answers
5. **Write explanation** — Engaging 1-2 sentences
6. **Generate 2+ variants** — Different question angles (forward, reverse, fill_blank)
7. **Mark as processed** — Set `_haikuProcessed: true`, `_haikuProcessedAt: <ISO date>`

## Knowledge Fact Generation Workflow

### Pipeline
```
1. Read raw Wikidata entries from data/raw/mixed/<domain>.json (preferred) or data/raw/<domain>.json
2. Chunk entries into batches of 40-50 per Haiku agent
3. Write input chunks to /tmp/<session>/<domain>-input-bNN-M.json
4. Spawn parallel Haiku agents (5-7 at a time) via Claude Code Agent tool
5. Each agent transforms entries into quiz facts, writes output to /tmp/<session>/<domain>-bNN-output-M.json
6. Collect all output files, run universal normalizer to handle schema variants
7. Append normalized facts to src/data/seed/facts-generated.json
8. Rebuild DB: node scripts/build-facts-db.mjs
```

### Available Raw Data
| Directory | Contents |
|-----------|----------|
| `data/raw/<domain>.json` | Primary Wikidata exports (10 domain files) |
| `data/raw/mixed/<domain>.json` | Enriched/merged exports (preferred, larger) |
| `data/raw/artic-artworks.json` | Art Institute of Chicago API dump |
| `data/raw/gbif-species.json` | GBIF biodiversity species |
| `data/raw/nasa-apod.json` | NASA Astronomy Picture of the Day |
| `data/raw/met-objects.json` | Metropolitan Museum objects |
| `data/raw/world-bank-countries.json` | World Bank country data |
| `data/raw/pubchem-compounds.json` | PubChem chemical compounds |

## Vocabulary Generation Workflow

### Method A: From Anki Decks (preferred for accuracy)
```
1. Extract word lists from .apkg files in data/references/
   - Anki .apkg = ZIP containing SQLite DB (collection.anki2 or collection.anki21)
   - Fields \x1f-separated; typically: field[0]=foreign word, field[1]=English meaning
   - Pre-extracted files in data/extracted/anki-*.json
2. Chunk extracted words into batches of 40-50
3. Spawn Haiku agents to transform word+meaning pairs into vocab quiz facts
4. Normalize and append to facts-generated.json
5. Rebuild DB
```

**Available Anki Decks**
| File | Language | Entries |
|------|----------|---------|
| `data/references/SPANISH.apkg` | es | 5,000 |
| `data/references/KOREAN.apkg` | ko | 7,627 |
| `data/references/GERMAN.apkg` | de | 4,207 |
| `data/references/DUTCH.apkg` | nl | 1,081 |
| `data/references/CZECH.apkg` | cs | 1,006 |
| `data/references/countries_cities_flags.apkg` | geo | 319 |

**Pre-extracted JSON (ready to use)**
| File | Entries |
|------|---------|
| `data/extracted/anki-spanish.json` | 5,000 |
| `data/extracted/anki-korean-full.json` | 7,627 |
| `data/extracted/anki-german.json` | 4,207 |
| `data/extracted/anki-dutch.json` | 1,081 |
| `data/extracted/anki-czech.json` | 1,006 |
| `data/extracted/anki-geography.json` | 319 |

### Method B: From Training Knowledge (for languages without Anki decks)
```
1. Spawn Haiku agents with prompt: "Generate 50 [Language] vocabulary quiz facts"
2. Agent generates word+meaning pairs from training knowledge
3. Used for: French (fr), Italian (it), and any future language without Anki source
4. Same normalization and append process
```

## Universal Output Normalizer
Haiku agents independently choose different output schemas. MUST normalize before merging. Known schema variants:

| Variant | correctAnswer field | Distractors field |
|---------|-------------------|-------------------|
| Standard | `correctAnswer: "text"` | `distractors: ["a","b","c"]` |
| Answer field | `answer: "text"` | `distractors: ["a","b","c"]` |
| Options+correct index | `correct: 0, options: [...]` | derived from options |
| Options+correctAnswerIndex | `correctAnswerIndex: 0, options: [...]` | derived from options |
| MCQ options | `mcqOptions: [{text, isCorrect: true/false}]` | derived from mcqOptions |
| Answers array | `answers: [{text, correct: true/false}]` | derived from answers |

**Standard Output Schema**
```json
{
  "correctAnswer": "plain string",
  "distractors": ["plain string", "plain string", ...]
}
```

Always ensure:
- `correctAnswer` is a plain string (not an object)
- `distractors` are plain strings (not objects with `.text`)
- At least 4 distractors (pad with "Unknown" only as last resort, flag for review)
- `difficulty` is integer 1-5
- `funScore` is integer 1-10
- `category` is an array
- `_haikuProcessed: true` and `_haikuProcessedAt` are set

## DB Rebuild
```bash
node scripts/build-facts-db.mjs
```
- Reads all `src/data/seed/*.json` files
- Inserts into SQLite via sql.js
- Output: `public/facts.db` + `public/seed-pack.json`
- `normalizeFactShape()` auto-derives missing fields (type, explanation, rarity)

## Fact Schema (DB NOT NULL columns)
Required fields (or auto-derived):
- `id` string (unique)
- `type` string — `"fact"` or `"vocabulary"` (auto-derived from `contentType`)
- `statement` string
- `explanation` string (auto-derived from `wowFactor` or `statement`)
- `quizQuestion` string
- `correctAnswer` string
- `distractors` array (>= 4, serialized as JSON text in DB)
- `category` string or array (auto-wrapped in array)
- `rarity` string — `"common"|"uncommon"|"rare"|"epic"` (auto-derived from `difficulty`)
- `difficulty` integer 1-5
- `funScore` integer 1-10
- `ageRating` string — `"kid"|"teen"|"adult"`

Recommended:
- `variants` array (>= 2)
- `sourceUrl`, `sourceName` when available
- `tags` array
- `_haikuProcessed: true`, `_haikuProcessedAt: <ISO date>`

## Variant & Answer Quality Rules
1. **Variant coherence** — `correctAnswer` must directly answer the variant's `question`.
2. **No self-answering** — No significant word (5+ chars) from `correctAnswer` may appear in the question.
3. **Distractor format match** — Distractors must be the same type as the answer (numbers with numbers, proper nouns with proper nouns).
4. **Variant structure** — `{ question, type, correctAnswer, distractors }` (NEVER a plain string). Types: `forward`, `reverse`, `context`, `fill_blank`, `negative`.
5. **No parenthetical reveals** — Answers must be concise. Explanations go in the `explanation` field.
6. **Variant-specific distractors** — Each variant SHOULD have its own tailored `distractors` array (3 minimum).

## Known Issues & Fixes

### normalizeFactShape() auto-derivation
Generated facts often lack fields the DB expects. These are auto-derived during promotion:
- **`type`** — defaults to `"fact"`, or `"vocabulary"` if `contentType === 'vocabulary'`
- **`explanation`** — falls back to `wowFactor`, then `statement`
- **`rarity`** — derived from `difficulty`: 1-2 = common, 3 = uncommon, 4 = rare, 5 = epic

### Distractor blocklist enforcement
Invalid distractors: "Unknown", "Other", "None of the above", "None of these", "All of the above", "N/A", "...", "", single-character answers. Promotion fails if found.

### Quality gate enforcement
Every fact must have `_haikuProcessed: true` to pass promotion. QA validates:
- Schema validity
- Distractor blocklist
- Dedup check for duplicate `id` and similar `quizQuestion` text

## Key Files
| File | Role |
|------|------|
| `src/data/seed/facts-generated.json` | Main generated facts file (32,172 facts) |
| `src/data/seed/facts.json` | Hand-curated seed facts |
| `scripts/build-facts-db.mjs` | Builds SQLite DB from seed files |
| `public/facts.db` | Runtime SQLite database |
| `public/seed-pack.json` | Exported seed pack for distribution |
| `data/raw/<domain>.json` | Wikidata raw exports (10 domains) |
| `data/raw/mixed/<domain>.json` | Enriched Wikidata exports (preferred) |
| `data/extracted/anki-*.json` | Pre-extracted Anki word lists |
| `data/references/*.apkg` | Source Anki deck files |
| `src/data/subcategoryTaxonomy.ts` | Domain/subcategory taxonomy IDs |
