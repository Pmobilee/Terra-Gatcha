# Scenario 08: Quiz Data Quality

## Goal
Play through 10+ quizzes verifying question quality: unique choices, complete text, no data artifacts, correct answers work.

## Preset
URL: `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`

## Steps

1. Navigate to URL, wait 4s
2. Start a run (any domain, any archetype)

### Quiz Collection Loop (repeat 10+ times)
For each quiz encountered during combat:

3. Click a card (`card-hand-{n}`) to trigger quiz
4. Read quiz data via evaluate:
```javascript
window.__terraPlay.getQuiz()
```
5. Record: { question, choices, correctIndex }

### Per-Quiz Checks
6. CHECK: question is a non-empty string, length > 10 characters
7. CHECK: exactly 3 choices
8. CHECK: all 3 choices are non-empty strings
9. CHECK: all 3 choices are UNIQUE (no duplicates)
10. CHECK: correctIndex is 0, 1, or 2
11. CHECK: no choice text contains "undefined", "null", "NaN", "[object"
12. CHECK: question text doesn't contain "undefined", "null", "NaN"
13. CHECK: correct answer text is different from the question text

### Answer Testing
14. For quizzes 1-5: answer CORRECTLY (click quiz-answer-{correctIndex})
15. For quizzes 6-8: answer WRONG (click a different index)
16. For quizzes 9-10: answer CORRECTLY again
17. After each answer, wait 2s and check:
    - Correct answer: confirm positive feedback / damage dealt
    - Wrong answer: confirm negative feedback / no damage

### Duplicate Detection
18. Track all questions seen. CHECK: no exact duplicate questions within the same run
19. Track all correct answers. Note if the same fact appears multiple times (echo mechanic is expected for wrong answers)

### End
20. Take **Screenshot #1 (quiz-sample)** during one quiz
21. Compile quiz quality report

## Checks
- All quizzes have 3 unique, non-empty choices
- No data artifacts (undefined, null, NaN) in question or choice text
- Correct answers produce positive outcomes
- Wrong answers produce negative outcomes
- No exact duplicate questions (unless echo mechanic)
- Question text length > 10 characters
- Choice text length > 0 characters

## Report
Write JSON to `/tmp/playtest-08-quiz-quality.json` with full quiz log, and summary to `/tmp/playtest-08-quiz-quality-summary.md`
