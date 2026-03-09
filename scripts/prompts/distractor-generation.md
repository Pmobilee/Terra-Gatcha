Generate high-quality distractors for quiz questions.

Input:
- Question
- Correct answer
- Domain/category
- Difficulty target

Output:
- JSON object with `distractors` array (minimum 5 entries).

Rules:
- Distractors must be plausible and contextually close.
- Avoid obvious throwaway wrong answers.
- Never repeat the correct answer.
- Mix confusion types:
  - near-neighbor concept
  - common misconception
  - same era/region/class but wrong entity
  - visually/sound-alike term (when relevant)
- Keep each distractor concise and unique.
