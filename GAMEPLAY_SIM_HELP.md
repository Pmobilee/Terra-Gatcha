# Gameplay Simulation Test

## What It Does

`gameplay-sim-test.mjs` simulates what a **player actually sees during combat** and checks for quality issues in the 3-option presentations (1 correct answer + 2 random distractors).

The real game flow is:
1. Player sees a question
2. Game shows 3 answer options: the correct answer + 2 randomly selected distractors from the distractor pool
3. Player picks one

This script validates the quality of those 3-option presentations using practical heuristics.

## Quality Checks

For each presentation, the script checks:

1. **Question Quality**
   - Is the question empty or a bare word?
   - Does the question contain the answer (trivial)?
   - Is it a placeholder with no context?

2. **Type Consistency**
   - Are all 3 options the same semantic category? (place, person, number, animal, etc.)
   - Chemical compounds shouldn't mix with verbs
   - Numbers shouldn't be presented alongside place names

3. **Option Plausibility**
   - Suspiciously short (<2 chars) or long (>150 chars)?
   - Contains vocab translation patterns like "(E~)" or "[verb]"?
   - Are any distractors from the garbage distractor list?

4. **Domain Matching**
   - If answer is a chemical compound, are distractors also compounds?
   - If answer is a place, are distractors also geographic?

## Scoring

Each presentation gets a score 1-5:

- **5 = Perfect** — All options same type, plausible, good question
- **4 = Minor** — Slightly different lengths but same domain
- **3 = Questionable** — One distractor from adjacent domain
- **2 = Bad** — Distractors clearly from wrong domain
- **1 = Terrible** — Vocab mixed with knowledge, nonsensical question

## Usage

```bash
# Test 200 knowledge facts (default)
node scripts/content-pipeline/qa/gameplay-sim-test.mjs

# Test custom count
node scripts/content-pipeline/qa/gameplay-sim-test.mjs --count 500

# Show detailed failures
node scripts/content-pipeline/qa/gameplay-sim-test.mjs --verbose

# Combine
node scripts/content-pipeline/qa/gameplay-sim-test.mjs --count 1000 --verbose
```

## Output Format

```
=== Gameplay Simulation Test (Knowledge Facts) ===
Facts tested:             200
Score 5 (Perfect):        150 (75.0%)
Score 4 (Minor):          35 (17.5%)
Score 3 (Questionable):   10 (5.0%)
Score 2 (Bad):            3 (1.5%)
Score 1 (Terrible):       2 (1.0%)
Average score:            4.63 / 5.0

=== Gameplay Simulation Test (Vocab Facts) ===
Facts tested:             50
Score 5 (Perfect):        45 (90.0%)
Score 4 (Minor):          5 (10.0%)
Score 3 (Questionable):   0 (0.0%)
Score 2 (Bad):            0 (0.0%)
Score 1 (Terrible):       0 (0.0%)
Average score:            4.90 / 5.0

=== Overall Quality ===
Presentations scoring 4-5: 235 / 250 (94.0%)
[PASS] Excellent presentation quality!
```

With `--verbose`, shows examples of worst presentations:

```
--- Worst Presentations (score 1-2) ---

[id-123] Score 1/5
  Question: "What is the chemical formula for table salt?"
  Correct:  "NaCl"
  Distract: "to dissolve", "a condiment"
  Issues:   type mismatch: chemical, verb, vocab; garbage/placeholder distractor
```

## When to Run

- **After fact generation/ingestion**: Verify the generated facts present well
- **After distractor mining**: Check that selected distractors match the correct answer domain
- **QA pass before release**: Spot-check presentation quality

## Integration with Pipeline

This complements the existing quality pipeline:
- `fix-fact-quality.mjs` — Cleans facts at DB level
- `mine-distractors.mjs` — Backfills distractor pools
- **gameplay-sim-test.mjs** ← YOU ARE HERE: Validates the actual presentation experience
- `scan-500.mjs` — Checks for database-level issues

