# AR-18: Vocabulary Expansion

Import and process vocabulary data for all 6 target languages from approved sources (JMdict, Wikidata lexemes, CEFR lists, Tatoeba).

## Overview

### Goal
Build a complete multi-language vocabulary system supporting 8 languages (Japanese, Spanish, French, German, Dutch, Czech, Korean, Mandarin Chinese) by importing from open data sources, applying proficiency level mappings (JLPT, CEFR, HSK, TOPIK), and converting vocabulary entries into the game's Fact schema with quiz variants and visual descriptions.

### Dependencies
- **AR-15** (Source Data & Registry) — Fetch scripts must be complete and producing JSON outputs
- **AR-17** (Haiku Fact Engine) — Required for `vocab-to-facts.mjs` to generate quiz variants
- **AR-11 Part C** (Visual Description Pipeline) — Required for final visual description generation step
- **Vocabulary sources**: All publicly available, no API keys required except for Haiku in final steps

### Estimated Complexity
**Large** — involves data integration from multiple sources, cross-referencing level lists, and format conversion. Estimated timeline: 3-4 weeks.

### Requirements & Constraints
- **Open Data Sources Only**: JMdict (EDRDG), Wikidata, Tatoeba, and public CEFR/HSK/TOPIK lists
- **Copyright Attribution**: All sources must be credited in `sourceName` and `sourceUrl` fields
- **Language Coverage**:
  - Japanese: Complete JLPT N1-N5 (estimated 20K+ words total)
  - Spanish: 5K+ words from Wikidata + frequency lists
  - French: 5K+ words from Wikidata + frequency lists
  - German: 5K+ words from Wikidata + frequency lists
  - Dutch: 5K+ words from Anki extraction + Leipzig Corpora + Haiku enrichment
  - Czech: 5K+ words from Anki extraction + Leipzig Corpora + Haiku enrichment
  - Korean: 5K+ words from Wikidata + TOPIK mapping
  - Mandarin Chinese: 5K+ words from Wikidata + HSK mapping
- **License Compatibility**: All sources licensed under CC-BY or CC0; attribution required in-game

---

## Sub-steps

### 1. Complete JMdict Import for All JLPT Levels

**File(s)**: `scripts/content-pipeline/vocab/import-jmdict.mjs`

**Objective**: Download the full JMdict dictionary from verified, community-maintained sources, parse entries, extract JLPT level tags, and produce 5 separate JSON files (one per proficiency level).

**Implementation Details**:

**Data Source Pipeline** (Verified):
- **Primary**: jmdict-simplified JSON from `github.com/scriptin/jmdict-simplified` (auto-updated weekly, CC-BY-SA 4.0)
  - EDRDG explicitly permits commercial use of JMdict derivatives
  - Cleaner JSON format than raw XML, easier to parse
  - URL: `https://raw.githubusercontent.com/scriptin/jmdict-simplified/master/jmdict.json` (~50MB)
- **JLPT Mapping**: Merge from `stephenmk/yomitan-jlpt-vocab` (maps Waller CC-BY lists to JMdict entry IDs)
  - **Key limitation**: JMdict does NOT contain JLPT tags natively. All JLPT level assignments are community-compiled approximations.
  - Official JLPT level lists do not exist in public domain; estimates based on educational consensus
- **Example Sentences**: JMdict_e_examp.xml (curated Tatoeba examples mapped to entries, CC-BY-SA 4.0)
- **Kanji Data**: KANJIDIC2 (13K kanji with readings and meanings, CC-BY-SA 4.0)
- **Frequency List**: Optional: BCCWJ frequency data from linguistic research
  - **WARNING**: BCCWJ is restricted to research/educational use — CANNOT use commercially
  - Frequency data is supplementary only; skip if license unclear

**Input Processing**:

```javascript
/**
 * Download and parse JMdict XML
 * @param {Object} options - Configuration
 * @param {string} options.outputDir - Directory to write vocab JSON files
 * @param {boolean} options.resume - Skip download if file exists
 * @returns {Promise<Object>} Summary { recordsPerLevel, totalRecords, errors }
 */
async function importJMdict(options)
```

1. **Download**:
   - Check if `JMdict_e.gz` exists locally; if not, download from EDRDG FTP
   - Decompress to temp file using Node's `zlib`
   - Validate: file size > 100MB (sanity check)

2. **XML Parsing**:
   - Use simple streaming XML parser (Node's built-in XML parser or lightweight library like `fast-xml-parser`)
   - Extract `<entry>` elements
   - For each entry, extract:
     - `<ent_seq>` — unique entry ID
     - `<keb>` — kanji spelling (may not exist for kana-only words)
     - `<reb>` — kana reading (hiragana)
     - `<gloss>` array — English meanings
     - `<pos>` — part of speech tag (e.g., "v1", "n", "adj-i")
     - `<ke_inf>` / `<re_inf>` — inflection information (e.g., "oK", "jy")
     - JLPT level: Extract from `<misc>` tags like `<jlpt>3</jlpt>` if present

3. **JLPT Level Assignment**:
   - If `<jlpt>N</jlpt>` tag exists: use that level (values: 1=N1, 2=N2, 3=N3, 4=N4, 5=N5)
   - If tag missing: attempt to infer from word frequency or complexity
     - Look for presence of kanji: kanji-less words are typically N4-N5
     - Common words (in top 1000 of corpus) → N5
     - Otherwise: default to N3
   - Output difficulty mapping: N5→1, N4→2, N3→3, N2→4, N1→5

4. **Output Format**:
   - Create separate file for each level: `vocab-n5.json`, `vocab-n4.json`, `vocab-n3.json`, `vocab-n2.json`, `vocab-n1.json`
   - Each file contains JSON array of vocabulary entries
   - Entry structure:

   ```json
   {
     "id": "jmdict-entry-12345",
     "word": "漢字",
     "reading": "かんじ",
     "meanings": ["kanji", "Chinese character"],
     "partOfSpeech": "noun",
     "jlptLevel": "N3",
     "difficulty": 3,
     "language": "ja",
     "sourceName": "JMdict/EDRDG",
     "sourceUrl": "https://www.edrdg.org/jmdict/j_jmdict.html"
   }
   ```

5. **Quality Checks**:
   - Warn if entry has no kanji/kana (malformed)
   - Warn if entry has no meanings (incomplete)
   - Warn if JLPT level is missing (will use default)
   - Count entries per level; display distribution

6. **Expected Output** (Verified Yields):
   - `vocab-n5.json`: ~800 entries (N5 = beginner)
   - `vocab-n4.json`: ~1,500 entries (N4 = elementary)
   - `vocab-n3.json`: ~3,500 entries (N3 = intermediate)
   - `vocab-n2.json`: ~5,000 entries (N2 = advanced)
   - `vocab-n1.json`: ~10,000 entries (N1 = proficiency)
   - Total: ~20,800 Japanese vocabulary entries

**CLI Interface**:

```bash
node import-jmdict.mjs \
  --output-dir src/data/seed/ \
  [--resume] \
  [--verbose]
```

---

### 2. Anki Deck Word List Extraction

**Objective:** Extract target-language word lists from popular community Anki decks to use as pedagogically curated input for the Haiku translation pipeline. We extract ONLY the target-language words — no translations, no examples, no mnemonics. All English content is generated fresh by Haiku to create original CC0 data.

**Why this matters:** Popular Anki decks with tens of thousands of downloads represent years of community curation on which words matter most for learners. This is superior to raw frequency lists because the word selection has been battle-tested by real students. This approach specifically solves the Korean data gap.

**Legal framework:**
- Word lists (which words exist in a language) are factual/functional data — not copyrightable
- We extract ONLY target-language words, discarding ALL English translations, example sentences, mnemonics, and notes
- Haiku generates 100% fresh translations, CEFR/TOPIK/level mappings, and example sentences
- Output is original data we own (CC0)
- This is analogous to using a phone book to get a list of names, then writing your own descriptions of each person

**Implementation Details:**

1. **Anki Deck Parser Script**
   - File: `scripts/content-pipeline/vocab/extract-anki-wordlist.mjs`
   - `.apkg` files are ZIP archives containing a SQLite database (`collection.anki2` or `collection.anki21`)
   - Parse the SQLite database using `better-sqlite3` or `sql.js`
   - Extract the `notes` table → parse note fields → identify the target-language field
   - Output: one JSON file per language containing ONLY the target-language strings, in order
   - CLI: `node extract-anki-wordlist.mjs --input data/reference/anki-decks/korean.apkg --language ko --output data/extracted/korean-wordlist.json`

2. **Reference Anki Deck Files** (provided by project owner)
   Location: `data/reference/anki-decks/`
   ```
   korean.apkg    — Korean Core vocabulary (5K-10K words, TOPIK-aligned)
   spanish.apkg   — Spanish frequency/core vocabulary (5K+ words)
   french.apkg    — French frequency/core vocabulary (5K+ words)
   german.apkg    — German frequency/core vocabulary (5K+ words)
   dutch.apkg     — Dutch Core vocabulary (5K+ words)
   czech.apkg     — Czech Core vocabulary (5K+ words)
   flags.apkg     — Flags of the World (optional, for cross-reference)
   ```
   NOTE: These files are reference material only. We do NOT redistribute their content.

3. **Extraction Rules (STRICT)**
   For each note in the Anki deck:
   - Extract ONLY the field containing the target-language word/phrase
   - Discard ALL other fields (English translations, example sentences, mnemonics, audio paths, images, notes, tags)
   - Discard any Anki-specific metadata (scheduling, intervals, ease factor)
   - Preserve the ORDER of cards (earlier cards = more common/important words)
   - Deduplicate: remove exact string matches
   - Output format:
     ```json
     {
       "language": "ko",
       "source": "anki-community-deck",
       "extractedAt": "2026-03-09",
       "words": ["사과", "학교", "선생님", ...]
     }
     ```

4. **Haiku Enrichment Pipeline**
   After extraction, feed the word list through the existing Haiku translation pipeline:
   - File: `scripts/content-pipeline/vocab/enrich-wordlist.mjs`
   - For each target-language word, call Haiku with domain-specific prompt:
     ```
     For the Korean word "사과", provide:
     1. English translation(s) (most common meaning first)
     2. Romanization (Revised Romanization)
     3. Part of speech
     4. Estimated TOPIK level (1-6)
     5. One example sentence in Korean with English translation

     Output as JSON.
     ```
   - Batch processing with rate limiting (reuse AR-17 Haiku client)
   - Cost estimate: ~500 tokens per word × 10K words × $0.25/M input = ~$1.25 per language
   - Output: enriched vocabulary JSON with all fields needed for Fact schema conversion

5. **Cross-verification step**
   - File: `scripts/content-pipeline/vocab/verify-translations.mjs`
   - Spot-check Haiku translations against Tatoeba sentence pairs
   - For each word: find Tatoeba sentences containing it, verify Haiku's translation aligns
   - Flag words where Haiku's translation doesn't match any Tatoeba usage (may need human review)
   - Target: >90% alignment with Tatoeba for common words

6. **Integration with existing pipeline**
   The enriched wordlist feeds directly into the existing `vocab-to-facts.mjs` script (already in step 5):
   ```
   Anki .apkg → extract-anki-wordlist.mjs → korean-wordlist.json
       → enrich-wordlist.mjs (Haiku) → korean-enriched.json
       → verify-translations.mjs → korean-verified.json
       → vocab-to-facts.mjs → korean-facts.json (Fact schema)
   ```

**This specifically solves the Korean gap:** Korean went from "Coming Soon / may need commissioned data" to a concrete pipeline. The Korean Core deck provides the curated word list, Haiku provides fresh translations, Tatoeba provides cross-verification.

**Acceptance Criteria:**
- Parser extracts words from all 4 `.apkg` files without errors
- Korean extraction yields 5K+ unique words
- Spanish/French/German each yield 3K+ unique words
- Haiku enrichment produces valid translations for >95% of words
- Cross-verification against Tatoeba shows >90% alignment on common words (top 1000)
- Output integrates seamlessly with existing vocab-to-facts.mjs

---

### 3. European Language Vocabulary via Leipzig Corpora + Haiku Enrichment

**CRITICAL FINDING**: Spanish, French, German, Dutch, and Czech have **NO clean bilingual dictionaries under CC-BY or CC0.** All major sources (Wiktionary/kaikki.org, FreeDict, WikDict, hermitdave/FrequencyWords, Lexique.org, CEFRLex) are either CC-BY-SA or research-only. ShareAlike creates derivative work ambiguity for commercial products.

**Solution: Original CC0 Data Pipeline** (creates data we own):

**File(s)**: `scripts/content-pipeline/vocab/import-european-vocab.mjs`

**Data Sources & Processing**:

1. **Step 1: Download Frequency Lists** (CC-BY 4.0, commercial use OK):
   - Source: Leipzig Corpora Collection (Universität Leipzig)
   - URL: `http://wortschatz.uni-leipzig.de/en/download/`
   - Files: `${language}_news` corpora (e.g., `spa_news`, `fra_news`, `deu_news`, `nld_news`, `ces_news`)
   - Each file: tab-separated (rank, word, frequency)
   - Extract: Top 10,000 frequency-ranked words per language

2. **Step 2: Generate Translations + CEFR Levels via Claude Haiku**:
   - For each word (batch up to 50 per request):
     - Prompt: `"Provide English translation, part of speech, CEFR level (A1-C2), and a short example sentence for this [LANGUAGE] word: [WORD]"`
     - Haiku cost: ~$0.25 per 1,000 words in European languages (5 languages × 10K = 50K words ≈ $12.50 total)
   - **OUTPUT IS ORIGINAL DATA**: Haiku-generated translations + CEFR levels are created by Claude and not derived from copyrighted sources. We own this data (CC0).

3. **Step 3: Frequency-to-CEFR Fallback** (if Haiku response incomplete):
   - Approximate CEFR from frequency rank:
     - A1 ≈ top 500 words
     - A2 ≈ 500-1,000
     - B1 ≈ 1,000-2,000
     - B2 ≈ 2,000-3,500
     - C1 ≈ 3,500-5,000
     - C2 ≈ 5,000+

4. **Step 4: Cross-Reference with Tatoeba Sentences** (CC-BY 2.0 FR, commercial OK):
   - Tatoeba pairs available:
     - Spanish-English: ~74K sentence pairs
     - French-English: ~58K sentence pairs
     - German-English: ~80K sentence pairs
     - Dutch-English: ~30K-50K sentence pairs
     - Czech-English: ~30K-50K sentence pairs
   - Link each word to matching Tatoeba sentences (step 4 below handles this)

**Expected Output**:
- `vocab-es.json`: ~10,000 Spanish words with Haiku-generated translations, CEFR levels, part of speech
- `vocab-fr.json`: ~10,000 French words with Haiku-generated translations, CEFR levels, part of speech
- `vocab-de.json`: ~10,000 German words with Haiku-generated translations, CEFR levels, part of speech
- `vocab-nl.json`: ~10,000 Dutch words with Haiku-generated translations, CEFR levels, part of speech
- `vocab-cs.json`: ~10,000 Czech words with Haiku-generated translations, CEFR levels, part of speech

**Implementation** (pseudocode):

```javascript
/**
 * Import European vocabulary via Leipzig Corpora + Haiku enrichment
 * @param {string} language - 'es', 'fr', 'de', 'nl', or 'cs'
 * @param {Object} options - Configuration
 * @returns {Promise<Object>} { wordsImported, language, outputFile }
 */
async function importEuropeanVocab(language, options) {
  // 1. Download Leipzig Corpora file
  // 2. Extract top 10K words with frequencies
  // 3. Batch words into groups of 50
  // 4. Call Haiku API for each batch (translation + CEFR + example)
  // 5. Write to JSON with sourceName: "Leipzig Corpora (Haiku-enriched)"
}
```

**CLI Interface**:

```bash
node import-european-vocab.mjs \
  --language es \
  --output-dir src/data/seed/ \
  [--batch-size 50]
```

---

### 4. Vocabulary Level Mapping (Language-Specific)

**File(s)**: `scripts/content-pipeline/vocab/level-mapper.mjs`

**Objective**: Vocabulary from step 2 already includes proficiency levels assigned by Claude Haiku or frequency heuristic. This step validates and enhances those assignments, particularly for Mandarin (HSK 3.0 transition) and Korean (if data becomes available).

**Implementation Details**:

**Processing Pipeline**:

```javascript
/**
 * Validate and enhance vocabulary proficiency levels
 * @param {string} language - Language code (es, fr, de, ko, zh, ja)
 * @param {Object} options - Configuration
 * @param {string} options.inputFile - Vocab JSON file (already has level assignments)
 * @param {string} options.outputFile - Enhanced output with validated levels
 * @returns {Promise<Object>} { entriesProcessed, entriesWithLevel, validationReport }
 */
async function mapLevels(language, options)
```

1. **European Languages** (Spanish, French, German, Dutch, Czech):
   - Levels already assigned by Haiku in Step 2 (CEFR A1-C2)
   - Validation: Check that ~80% of words are distributed across all 6 CEFR levels
   - If distribution is skewed, log warning but do not override Haiku assignments
   - Output adds: `cefrLevel` (already present), `cefrRank` (position by frequency)

2. **Mandarin (Verified HSK Pipeline)**:
   - Primary source: `complete-hsk-vocabulary` repo (MIT license, 11K+ words)
   - Supports both HSK 2.0 (current) and HSK 3.0 (launching July 2026)
   - Fields per entry: simplified, traditional, pinyin, English definitions, POS, HSK level, frequency rank
   - HSK 2.0 levels: 1-6 (total ~2,500 words, see step 1 below)
   - HSK 3.0 levels: 1-9 (launching July 2026, ~5,000 words)
   - Kanji enrichment: Unicode Unihan Database (98K+ characters, Unicode License)
   - Tatoeba enrichment: CMN-EN pairs (~29-59K pairs, CC-BY 2.0 FR)
   - **WARNING**: complete-hsk-vocabulary may derive some definitions from CC-CEDICT (CC-BY-SA 4.0). Verify derivative work status before commercial use.
   - Output adds: `hskLevel`, `hskRank`, `traditional`, `pinyin`

3. **Korean (Anki Extraction Pipeline)**:
   - Korean uses the Anki deck extraction + Haiku enrichment pipeline (step 2)
   - Haiku generates TOPIK levels, romanizations, and translations from the extracted Korean words
   - Output adds: `topikLevel` (from Haiku), `romanization`, `meanings` (all Haiku-generated)

4. **Japanese (Already Complete in Step 1)**:
   - JLPT levels N5-N1 assigned in step 1
   - No further mapping needed

5. **Enhanced Output Format**:

   ```json
   {
     "id": "leipzig-es-12345",
     "word": "hola",
     "meanings": ["hello", "hi"],
     "language": "es",
     "difficulty": 1,
     "cefrLevel": "A1",
     "cefrRank": 12,
     "partOfSpeech": "interjection",
     "sourceName": "Leipzig Corpora (Haiku-enriched)",
     "sourceUrl": "http://wortschatz.uni-leipzig.de/"
   }
   ```

6. **Quality Checks**:
   - Warn if >10% of entries have no level assignment
   - Display distribution of entries per level
   - For Mandarin: verify HSK 2.0/3.0 transition coverage

**CLI Interface**:

```bash
node level-mapper.mjs \
  --language es \
  --input src/data/seed/vocab-es.json \
  --output src/data/seed/vocab-es-leveled.json
```

---

### 4.1 Mandarin Chinese (Complete-HSK-Vocabulary Import)

**File(s)**: `scripts/content-pipeline/vocab/import-hsk-vocabulary.mjs`

**Objective**: Download and import complete HSK vocabulary lists (both HSK 2.0 and 3.0) from MIT-licensed source. Unify proficiency level mappings.

**Data Source**:
- Repo: `complete-hsk-vocabulary` (MIT license, actively maintained)
- URL: `https://github.com/[owner]/complete-hsk-vocabulary`
- Contains: Simplified, traditional, pinyin, English definitions, part of speech, HSK level, frequency
- License: MIT (commercial OK)
- **Important caveat**: Some definitions may derive from CC-CEDICT (CC-BY-SA 4.0). Verify with repo maintainer before commercial use.

**Processing**:
1. Clone or download repo
2. Parse JSON files for HSK 1-6 (current, valid until July 2026)
3. Also parse HSK 1-9 files (new standard, launching July 2026)
4. For each word:
   - Extract: simplified, traditional, pinyin, English meanings (use first definition)
   - Map HSK level to difficulty (1→1, 2→1, 3→2, 4→2, 5→3, 6→5)
   - Keep frequency rank
5. Enrich with Tatoeba CMN-EN example sentences (step 4 below)
6. Output: `vocab-zh-hsk2.json` and `vocab-zh-hsk3.json` (for future migration)

**Expected Output** (HSK 2.0):
- HSK 1: ~150 words
- HSK 2: ~300 words
- HSK 3: ~600 words
- HSK 4: ~1,200 words
- HSK 5: ~2,000 words
- HSK 6: ~2,500 words
- **Total: ~6,750 words**

**Note on HSK 3.0**: New standard launches July 2026. Complete-hsk-vocabulary repo should provide migrated lists. Plan for upgrade path in settings UI.

---

### 4.2 Korean Vocabulary (ANKI EXTRACTION PIPELINE)

**File(s)**: Anki extraction pipeline from step 2, integrated via `vocab-to-facts.mjs`

**RESOLVED**: Korean now uses the Anki community deck extraction pipeline (step 2), which completely bypasses licensing ambiguities.

**Why Anki Extraction Solves the Korean Gap**:
- Popular Anki decks like "Korean Core" represent years of community curation — linguists and learners have already curated the most important words
- Extraction is purely mechanical: we extract ONLY the target-language words (factual data, not copyrightable)
- All English translations, TOPIK levels, romanizations, and example sentences are generated fresh by Haiku from the word list
- Output is 100% original data we own (CC0)
- This avoids all licensing ambiguities with official TOPIK lists and CC-BY-SA sources

**Korean Vocabulary Import Process**:
1. Extract Korean word list from Korean Core Anki deck (5K-10K words in pedagogical order)
2. Haiku enrichment: for each word, generate:
   - English translation(s)
   - Romanization (Revised Romanization)
   - Part of speech
   - Estimated TOPIK level (1-6)
   - Example sentence
3. Cross-verify against Tatoeba KOR-EN pairs (6,394 pairs)
4. Integrate into `vocab-to-facts.mjs` to produce Korean facts with all variants

**Acceptance Criteria** (same as other languages):
- Extraction yields 5K+ unique Korean words from Anki deck
- Haiku enrichment produces valid translations for >95%
- Cross-verification shows >90% alignment with Tatoeba for common words (top 1000)
- Output integrates seamlessly into vocab-to-facts.mjs pipeline

---

### 5. Tatoeba Example Sentence Matching

**File(s)**: `scripts/content-pipeline/vocab/match-tatoeba.mjs`

**Objective**: Find example sentences containing each vocabulary word from the Tatoeba corpus, with English translations.

**Implementation Details**:

**Data Source**:
- Tatoeba: `https://tatoeba.org/` (CC-BY)
- Available as downloadable database: `sentences.tar.bz2` and `links.tar.bz2`
- Contains millions of sentences in 500+ languages with translations
- License: CC-BY (requires attribution)

**Processing Pipeline**:

```javascript
/**
 * Match vocabulary words to example sentences from Tatoeba
 * @param {string} language - Language code (es, fr, de, ko, zh, ja)
 * @param {Object} options - Configuration
 * @param {string} options.inputFile - Vocab JSON file
 * @param {string} options.outputFile - Enhanced output with examples
 * @param {string} options.tataoebaDir - Directory with extracted Tatoeba data
 * @returns {Promise<Object>} { wordsMatched, sentencesLinked, outputFile }
 */
async function matchTatoeba(language, options)
```

1. **Data Preparation**:
   - Download Tatoeba sentence and link files (one-time setup)
   - Extract: `sentences_${lang}.csv`, `links.csv`
   - Load into memory or create indexed database for fast lookup
   - Tatoeba format: tab-separated (sentence_id, language, text, author)
   - Links: source_sentence_id, target_sentence_id (English translation)

2. **Word Matching**:
   - For each vocabulary entry:
     - Search for sentences containing the word (substring match or word boundary match)
     - Collect up to 3 matching sentences
     - For each sentence, find English translation via `links` file
     - Verify English translation is available (not all sentences have pairs)

3. **Quality Filtering**:
   - Skip sentences with >50 words (too long for learner example)
   - Skip sentences with rare characters or encoding issues
   - Prioritize sentences from professional contributors (if available in metadata)
   - Ensure matched word is not split across multiple parts (word boundary check)

4. **Output Format**:

   ```json
   {
     "id": "wikidata-lexeme-es-hola",
     "word": "hola",
     "exampleSentences": [
       {
         "sentence": "Hola, ¿cómo estás?",
         "translation": "Hello, how are you?",
         "tataoebaId": 12345,
         "author": "User123"
       }
     ],
     "exampleCount": 1,
     "sourceName": "Tatoeba (CC-BY)",
     ...
   }
   ```

5. **Attribution**:
   - Store Tatoeba sentence ID in output
   - Game UI must display: "Example from Tatoeba"
   - Can link to https://tatoeba.org/en/sentences/show/${id}

6. **Expected Coverage** (per language):
   - Japanese: 80%+ (JMdict has curated Tatoeba mappings)
   - Spanish: 60%+ (~74K Spanish-EN pairs)
   - French: 55%+ (~58K French-EN pairs)
   - German: 65%+ (~80K German-EN pairs)
   - Mandarin: 40%+ (~29-59K CMN-EN pairs)
   - Korean: 20-30% (only 6,394 KOR-EN pairs — sparse)

**CLI Interface**:

```bash
node match-tatoeba.mjs \
  --language es \
  --input src/data/seed/vocab-es-leveled.json \
  --output src/data/seed/vocab-es-examples.json \
  [--tatoeba-dir data/tatoeba/]
```

---

### 6. Convert Vocabulary to Fact Schema

**File(s)**: `scripts/content-pipeline/vocab/vocab-to-facts.mjs`

**Objective**: Transform vocabulary JSON entries into full Fact schema objects with quiz variants, distractors, and metadata ready for the game.

**Implementation Details**:

**Objective**: Convert vocabulary entries into the game's Fact schema with multiple quiz question variants.

**Processing Pipeline**:

```javascript
/**
 * Convert vocabulary entries to Fact schema
 * @param {string} language - Language code
 * @param {Object} options - Configuration
 * @param {string} options.inputFile - Enhanced vocab JSON file
 * @param {string} options.outputFile - Fact schema JSONL output
 * @returns {Promise<Object>} { factsGenerated, language, outputFile }
 */
async function vocabToFacts(language, options)
```

1. **Quiz Variant Generation**:
   - Generate 4 quiz question variants per vocabulary entry:
     - **Forward**: Show target word (in native script) → select English meaning
       - Example: Q: "What does 'hola' mean?" A: "hello"
     - **Reverse**: Show English meaning → select target word (in native script)
       - Example: Q: "Select the Spanish word for 'hello'" A: "hola"
     - **Fill-Blank**: Show sentence with word blanked → select correct word
       - Example: Q: "'_____ , ¿cómo estás?' means 'Hello, how are you?'" A: "Hola"
       - Only if example sentence available
     - **True/False**: Statement about word or usage → true/false
       - Example: Q: "'Hola' is a Spanish greeting: true or false?" A: "true"

2. **Distractor Generation**:
   - For each question variant, generate 8-10 distractor answers
   - Distractors should be other words from the same language and similar difficulty level
   - Mark difficulty tiers: easy (obvious wrong), medium (plausible wrong), hard (subtle wrong)
   - Examples:
     - Forward variant (word → meaning):
       - Easy: completely unrelated Spanish words ("gato", "perro") translated
       - Medium: related concepts ("goodbye", "thanks")
       - Hard: similar-looking words or false cognates ("bola" meaning "ball")
     - Reverse variant (meaning → word):
       - Easy: words with very different meanings
       - Medium: other common Spanish greetings or polite words
       - Hard: related Spanish words that are less common

3. **Fact Schema Conversion**:

   ```json
   {
     "id": "vocab-es-hola-forward",
     "statement": "The Spanish word 'hola' means hello or hi.",
     "quizQuestion": "What does the Spanish word 'hola' mean?",
     "correctAnswer": "hello",
     "variants": [
       "The Spanish word 'hola' translates to which English word?",
       "Select the English translation of 'hola'",
       "'Hola, ¿cómo estás?' — what is 'hola'?"
     ],
     "distractors": [
       { "text": "goodbye", "difficultyTier": "easy" },
       { "text": "thank you", "difficultyTier": "medium" },
       { "text": "good morning", "difficultyTier": "medium" }
     ],
     "difficulty": 1,
     "funScore": 3,
     "wowFactor": "'Hola' is used for informal greetings in Spanish-speaking countries and is one of the first words Spanish learners master!",
     "visualDescription": null,
     "ageRating": "kid",
     "sourceName": "Wikidata + Tatoeba",
     "sourceUrl": "...",
     "category": ["Language", "Spanish", "Beginner"],
     "contentType": "vocabulary",
     "language": "es",
     "cefrLevel": "A1",
     "tags": ["spanish", "greeting", "beginner", "spoken"]
   }
   ```

4. **Metadata Assignment**:
   - `contentType: "vocabulary"`
   - `language: [language code]`
   - `category: ["Language", "[Language Name]", "[Level Name]"]`
   - Include CEFR/HSK/TOPIK level if available
   - `tags: [language, pos, level, ...]`
   - `funScore`: 3-5 for vocabulary (not as fun as knowledge facts, but educational)
   - `difficulty`: map from CEFR/HSK/TOPIK to 1-5 scale

5. **Output Format**:
   - JSONL (one Fact per line)
   - Filename: `facts-vocab-${language}.jsonl`
   - Total facts per language: ~3 variants per word × 5K words = 15K facts per language

**CLI Interface**:

```bash
node vocab-to-facts.mjs \
  --language es \
  --input src/data/seed/vocab-es-examples.json \
  --output data/generated/facts-vocab-es.jsonl \
  [--variants forward,reverse,blank,truefalse]
```

---

### 7. Language-Themed Visual Descriptions

**File(s)**: Depends on AR-11 Part C completion

**Objective**: Generate or assign visual descriptions for all vocabulary facts using language-specific cultural themes.

**Implementation Details**:

**Processing Pipeline**:

```javascript
/**
 * Generate visual descriptions for vocabulary facts
 * @param {string} language - Language code
 * @param {Object} options - Configuration
 * @param {string} options.inputFile - Facts JSONL file
 * @param {string} options.outputFile - Enhanced facts with visual descriptions
 * @returns {Promise<Object>} { factsEnhanced, outputFile }
 */
async function generateVisualDescriptionsForVocab(language, options)
```

1. **Language-Specific Theming** (from GAME_DESIGN.md §22):
   - **Japanese**: Feudal Japan, torii gates, zen gardens, bamboo groves, cherry blossoms, samurai, Mount Fuji
   - **Spanish**: Mediterranean coast, terracotta plazas, flamenco dancers, paella, bullfighting arenas, Spanish architecture
   - **French**: Belle Époque, cobblestone cafés with small tables, lavender fields, wine bottles, Eiffel Tower silhouettes
   - **German**: Central European villages, Gothic architecture, Black Forest, beer steins, cuckoo clocks, Christmas markets
   - **Dutch**: Dutch Golden Age, windmills, tulip fields, canal houses, Delft blue pottery, trading ships, dike landscapes
   - **Czech**: Bohemian / Central European, Prague castle spires, medieval clock towers, forest trails, stained glass windows, cobblestone lanes, beer halls
   - **Korean**: Joseon Dynasty hanok houses, Korean temples, traditional dress (hanbok), Korean food (kimchi, bibimbap), K-pop aesthetics
   - **Mandarin**: Imperial China, wuxia martial arts, misty mountains, dragon motifs, red lanterns, silk, pagodas, tea houses

2. **Visual Description Format**:
   - 20-40 words
   - Include: setting, key cultural objects, colors, art style
   - Example (Spanish word "fiesta"):
     - "Spanish plaza at sunset with lanterns strung overhead, people dancing flamenco, colorful decorative flags, warm orange and red tones, pixel art style, 64x48px"

3. **Template per Language**:
   - Create prompt template for each language (similar to knowledge domain prompts in AR-17)
   - Use Haiku API to generate visual descriptions (brief, since it's just description not full fact generation)
   - Or: Pre-create a set of 20 stock visual descriptions per language and randomly assign to vocabulary facts (simpler, no API cost)

4. **Integration with Visual Gen Pipeline**:
   - Add `--language` flag to visual description generation script
   - Apply cultural theming per language when generating images

---

### 8. Language Selection UI Updates

**File(s)**: Multiple UI components (Svelte/TypeScript)

**Objective**: Update onboarding and settings UI to allow players to select languages and manage vocabulary packs.

**Implementation Details**:

**Files to Create/Edit**:
- `src/ui/LandingScreen.svelte` — onboarding language selection
- `src/ui/SettingsLanguages.svelte` — new language pack management UI
- `src/data/language-config.ts` — language metadata (flags, names, word counts, etc.)

**Onboarding Changes**:

1. **Language Selection Screen** (new screen after age/proficiency onboarding):
   - Title: "Choose a Language to Learn"
   - Display 6 language cards:
     - Card layout: flag icon, language name (English + native name), word count, available levels
     - Example card (Spanish):
       ```
       🇪🇸 Spanish (Español)
       5,420 words
       CEFR A1–C2
       ```
   - Selection: click card to select language (can select multiple for future expansion)
   - UI state: highlight selected language
   - Button: "Start Learning" (moves to first lesson with selected language)

2. **Language Status**:
   - Languages with 0 vocabulary entries show: "Coming Soon" instead of word count
   - Show which languages are fully imported (all 6 target languages should be ready at phase end)

3. **Settings UI** (new tab in Settings page):

   - **Language Packs Management**:
     - Table showing all 6 languages
     - Columns: Flag, Language, Status (✓ Installed, ◯ Available, ✗ Not available), Word Count, Proficiency Levels, Download/Remove Buttons
     - Allow players to download/remove language packs for offline play
   - **Current Language Setting**:
     - Dropdown: select active language for learning
     - Option to learn multiple languages (UI shows which facts/cards are from which language)
   - **Proficiency Level Filter**:
     - Checkboxes per language: A1, A2, B1, B2, C1, C2 (for European languages)
     - Or: N5, N4, N3, N2, N1 (for Japanese)
     - Allow players to filter by level

**Data Structure Changes**:

```typescript
// src/data/language-config.ts
interface Language {
  code: string;          // 'es', 'fr', 'de', 'ko', 'zh', 'ja'
  name: string;          // 'Spanish', 'French', etc.
  nativeName: string;    // 'Español', 'Français', etc.
  flag: string;          // emoji flag '🇪🇸'
  wordCount: number;     // 5420
  levels: Array<{
    code: string;        // 'A1', 'CEFR', 'JLPT', 'HSK', 'TOPIK'
    label: string;       // 'Beginner', 'N5', etc.
    wordCount: number;
  }>;
  sourceUrl: string;     // Link to language Wikipedia or official site
}

export const LANGUAGES: Record<string, Language> = {
  es: { code: 'es', name: 'Spanish', ... },
  fr: { code: 'fr', name: 'French', ... },
  ...
}
```

**Integration with Game State**:
- Store selected language in player profile/settings
- When loading facts, filter by selected language
- Display language tag on fact cards (visual indicator which language is being studied)
- Update quiz UI to show language context (e.g., "Spanish Card" header)

---

---

## Attribution & Licensing Compliance

The game MUST include an About/Sources screen (accessible from Settings) listing all vocabulary data sources with proper attribution:

- **EDRDG JMdict/KANJIDIC**: CC-BY-SA 4.0 with link to `https://www.edrdg.org/jmdict/j_jmdict.html`
- **Tatoeba**: CC-BY 2.0 FR, with per-sentence author credits shown on vocabulary cards
- **Leipzig Corpora Collection**: CC-BY 4.0, Universität Leipzig, with link to `http://wortschatz.uni-leipzig.de/`
- **Complete-HSK-Vocabulary**: MIT License
- **Any other CC-BY sources used**: Include full attribution URL

**UI Implementation**:
- Settings → "About" tab → "Data Sources" section
- Each source shows: name, license, link, brief description
- Example format: "Japanese vocabulary data from JMdict/EDRDG (CC-BY-SA 4.0) | Example sentences from Tatoeba (CC-BY 2.0 FR)"

---

## Acceptance Criteria

- Complete JMdict import produces separate JSON files for N5-N1 with correct structure and metadata
- Wikidata queries retrieve 5K+ words per non-Japanese language
- Level mapping produces CEFR/HSK/TOPIK assignments for >90% of imported vocabulary
- Tatoeba matching finds example sentences for >50% of vocabulary entries
- Vocabulary to Fact conversion produces valid JSON with all required fields
- Generated facts have diverse quiz variants (forward, reverse, fill-blank, true/false)
- Distractors are plausible, relevant, and vary in difficulty tier
- All vocabulary sources properly attributed (sourceName and sourceUrl present)
- Language selection UI renders all 8 languages in onboarding
- Settings UI allows managing language packs
- `npm run typecheck` passes
- `npx vitest run` passes

---

## Verification Gate

- [ ] `node import-jmdict.mjs --output-dir src/data/seed/` produces 5 vocab JSON files (N5-N1) totaling 20K+ entries
- [ ] `node import-european-vocab.mjs --language es` produces Spanish vocab with Haiku-enriched translations and CEFR levels
- [ ] `node import-hsk-vocabulary.mjs --output-dir src/data/seed/` produces 2 vocab files (HSK 2.0 and 3.0) with 6,750+ entries each
- [ ] `node level-mapper.mjs --language es` validates and enhances all level assignments; output has cefrLevel for 100% of entries
- [ ] `node match-tatoeba.mjs --language es` finds example sentences for 60%+ of Spanish vocabulary
- [ ] Tatoeba attribution metadata (sentence ID, author) present in output
- [ ] `node vocab-to-facts.mjs --language es --input src/data/seed/vocab-es-leveled-examples.json --output data/generated/facts-vocab-es.jsonl` produces valid Fact JSON with 25K+ facts (forward + reverse + blank + true/false variants)
- [ ] `npm run typecheck` passes
- [ ] `npx vitest run` passes
- [ ] Onboarding includes language selection screen with all 8 languages
- [ ] Settings UI shows language pack management with all 8 languages, attribution links visible
- [ ] Settings → "About" → "Data Sources" displays all vocabulary source attributions
- [ ] Playwright test: select Spanish in onboarding → facts display Spanish content with CEFR level badges

---

## Files Affected

**NEW Scripts**:
- `scripts/content-pipeline/vocab/import-jmdict.mjs` — JMdict/EDRDG + JLPT level mapping
- `scripts/content-pipeline/vocab/extract-anki-wordlist.mjs` — Parse Anki .apkg files, extract target-language word lists
- `scripts/content-pipeline/vocab/enrich-wordlist.mjs` — Haiku enrichment for extracted word lists
- `scripts/content-pipeline/vocab/verify-translations.mjs` — Cross-verify Haiku translations against Tatoeba
- `scripts/content-pipeline/vocab/import-european-vocab.mjs` — Leipzig Corpora + Haiku enrichment (ES/FR/DE)
- `scripts/content-pipeline/vocab/import-hsk-vocabulary.mjs` — Complete-HSK-Vocabulary (MIT)
- `scripts/content-pipeline/vocab/level-mapper.mjs` — Validate and enhance proficiency levels
- `scripts/content-pipeline/vocab/match-tatoeba.mjs` — Link words to example sentences
- `scripts/content-pipeline/vocab/vocab-to-facts.mjs` — Convert to Fact schema with variants

**NEW Data Files** (reference and extracted):
- `data/reference/anki-decks/korean.apkg` — Korean Core vocabulary deck (reference, not redistributed)
- `data/reference/anki-decks/spanish.apkg` — Spanish frequency/core vocabulary deck
- `data/reference/anki-decks/french.apkg` — French frequency/core vocabulary deck
- `data/reference/anki-decks/german.apkg` — German frequency/core vocabulary deck
- `data/reference/anki-decks/dutch.apkg` — Dutch Core vocabulary (reference, not redistributed)
- `data/reference/anki-decks/czech.apkg` — Czech Core vocabulary (reference, not redistributed)
- `data/extracted/korean-wordlist.json` — Extracted Korean words (gitignored intermediate)
- `data/extracted/spanish-wordlist.json` — Extracted Spanish words (gitignored intermediate)
- `data/extracted/french-wordlist.json` — Extracted French words (gitignored intermediate)
- `data/extracted/german-wordlist.json` — Extracted German words (gitignored intermediate)
- `data/extracted/dutch-wordlist.json` — Extracted Dutch words (gitignored intermediate)
- `data/extracted/czech-wordlist.json` — Extracted Czech words (gitignored intermediate)

**NEW Data Files** (seed vocabulary):
- `src/data/seed/vocab-n5.json` — Japanese N5 (~800 entries)
- `src/data/seed/vocab-n4.json` — Japanese N4 (~1,500 entries)
- `src/data/seed/vocab-n3.json` — Japanese N3 (~3,500 entries)
- `src/data/seed/vocab-n2.json` — Japanese N2 (~5,000 entries)
- `src/data/seed/vocab-n1.json` — Japanese N1 (~10,000 entries)
- `src/data/seed/vocab-es-leveled-examples.json` — Spanish with CEFR + Tatoeba
- `src/data/seed/vocab-fr-leveled-examples.json` — French with CEFR + Tatoeba
- `src/data/seed/vocab-de-leveled-examples.json` — German with CEFR + Tatoeba
- `src/data/seed/vocab-nl-leveled-examples.json` — Dutch with CEFR + Tatoeba
- `src/data/seed/vocab-cs-leveled-examples.json` — Czech with CEFR + Tatoeba
- `src/data/seed/vocab-ko-leveled-examples.json` — Korean with TOPIK + Tatoeba (from Anki extraction)
- `src/data/seed/vocab-zh-hsk2.json` — Mandarin HSK 2.0 levels 1-6
- `src/data/seed/vocab-zh-hsk3.json` — Mandarin HSK 3.0 levels 1-9 (for July 2026)

**NEW UI Components**:
- `src/ui/SettingsLanguages.svelte` — language pack management
- `src/ui/SettingsSources.svelte` — data attribution screen
- `src/data/language-config.ts` — language metadata, flags, word counts

**EDIT**:
- `src/ui/LandingScreen.svelte` — add language selection screen (post-onboarding)
- `src/ui/SettingsPage.svelte` — add "Languages" and "About/Sources" tabs
- `src/data/types.ts` — extend Fact schema for language, cefrLevel, hskLevel, topikLevel (if used)
- `src/data/seed/vocab-n3.json` — replace with fresh import from JMdict-simplified

**Generated (not in version control)**:
- `data/generated/facts-vocab-*.jsonl` — vocabulary fact files (Fact schema, one per line)

**Note on .gitignore**:
Add the following to `.gitignore`:
```
# Reference Anki decks (not redistributed, local reference only)
data/reference/anki-decks/*.apkg
# Extracted intermediate files
data/extracted/
```

---

## Dependencies & Environment

- **Node.js**: 18+
- **npm packages**: All from AR-17 (batch generation already handles JSON operations)
- **External data sources** (one-time downloads):
  - JMdict XML from EDRDG
  - Tatoeba sentence data
  - CEFR/HSK/TOPIK word lists (publicly available)
- **SPARQL endpoint**: Wikidata (free, rate-limited to ~300 queries/minute)
- **API keys**: None required (all sources are open)

---

## Notes for Implementers

1. **Data Source Reliability**: All sources are community-maintained open data. Quality varies; validate samples before committing to full imports.

2. **Romanization**: Korean and Mandarin romanization is complex. Consider using existing libraries or pre-computed mappings if available.

3. **Frequency-Based Difficulty**: If official level lists are unavailable, use word frequency as proxy. Frequency data is available from multiple sources (Leipzig Corpus, most-common-words lists on GitHub).

4. **Performance**: Loading 30K+ vocabulary entries may impact game performance. Consider lazy-loading or paginating vocabulary facts by language/level.

5. **Licensing Compliance**: All sources are openly licensed, but ensure compliance in game's credits/about section. Display attribution: "Vocabulary data from Wikidata, JMdict, and Tatoeba (CC-BY/CC0)".

6. **Test Workflow**:
   - Test with small imports first (e.g., --limit 100)
   - Validate with 10 sample facts before full run
   - Check output schema before integrating into game

---
