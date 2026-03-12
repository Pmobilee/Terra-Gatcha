# Facts Database Fixes Summary

## Database: `/root/terra-miner/src/data/seed/facts-generated.json`
**Total facts: 33,532** (10,423 knowledge + 23,109 vocab)

---

## Issue 1: vocab_unknown domains and undefined language
**Status: FIXED ✓**

- **Fixed vocab_unknown domains:** 6,021 → 0
- **Fixed missing language codes:** 6,021 → mapped to correct language

**Method:** Mapped `categoryL2` values to language codes, with fallback to `id` prefix inference:
- "czech" → `cs`
- "dutch" → `nl`
- "german" → `de`
- "korean" → `ko`
- "spanish" → `es`
- "french" → `fr`
- "italian" → `it`

**Result:** All vocab facts now have explicit language code (cs, de, es, fr, it, ko, nl)

---

## Issue 2: Non-vocab domain names
**Status: FIXED ✓**

- **Fixed inconsistent domains:** 1,041 facts normalized
- **Remaining non-standard domains:** 0

**Normalization mapping:**
- "Human Body & Health" → `human_body_health`
- "History" → `history`
- "Mythology & Folklore" → `mythology_folklore`
- "Art & Architecture" → `art_architecture`
- "Food & Cuisine" → `food_cuisine`
- "Natural Sciences" → `natural_sciences`
- "Space & Astronomy" → `space_astronomy`

**Final knowledge domains (all standard snake_case):**
- `animals_wildlife` (1,973)
- `art_architecture` (1,155)
- `food_cuisine` (1,125)
- `general_knowledge` (959)
- `geography` (1,076)
- `history` (1,265)
- `human_body_health` (1,154)
- `mythology_folklore` (722)
- `natural_sciences` (563)
- `space_astronomy` (431)

---

## Issue 3: Bad distractors in vocab facts
**Status: FIXED ✓**

- **Vocab facts with bad distractors:** 1,987 → 0
- **Total bad distractor instances:** 7,106 → 0
- **Bad distractors replaced:** 17

**Bad distractor patterns detected and fixed:**
1. Non-ASCII distractors when correct answer is ASCII
2. Generic options like "Option A/B/C"
3. Placeholder text: "Unclear", "Unknown", "None", "N/A"
4. Test/placeholder vocab: "burger", "elephant", "pizza", etc.

**Method:** Built per-language distractor pools (unique correctAnswer values) and replaced bad distractors with random valid alternatives ensuring no duplicates within each fact.

**Distractor pool sizes:**
- Czech (cs): 996
- Dutch (nl): 1,064
- French (fr): 950
- German (de): 3,874
- Italian (it): 1,663
- Korean (ko): 6,203
- Spanish (es): 4,879

---

## Verification Results

| Metric | Before | After | Status |
|--------|--------|-------|--------|
| vocab_unknown domains | 6,021 | 0 | ✓ |
| Non-standard domains | 1,041 | 0 | ✓ |
| Bad distractor instances | 7,106 | 0 | ✓ |
| Total facts | 33,532 | 33,532 | ✓ |

---

## Files Modified
- `/root/terra-miner/src/data/seed/facts-generated.json` — All 33,532 facts corrected

## Scripts Used
- `fix-facts.mjs` — Initial three-issue fix pass
- `fix-facts-v2.mjs` — Improved vocab distractor replacement
- `final-verification.mjs` — Comprehensive database audit

All scripts are self-contained and can be rerun for validation.

---

**Completed:** 2026-03-12
