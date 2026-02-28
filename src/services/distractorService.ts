import type { Fact } from '../data/types'

function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase()
}

function getFinalCategorySegment(fact: Fact): string | null {
  if (fact.category.length === 0) {
    return null
  }

  return fact.category[fact.category.length - 1]?.toLowerCase() ?? null
}

/**
 * Generates plausible distractor answers for a vocabulary item.
 *
 * The selection prefers vocabulary entries that share the same final category
 * segment as the source fact (when found) and have similar answer length.
 * If there are not enough preferred matches, it broadens to any vocabulary
 * answers while still excluding the correct answer and case-insensitive
 * duplicates.
 *
 * @param correctAnswer - Correct answer that must not appear in results.
 * @param allFacts - Full fact pool used to source distractors.
 * @param count - Maximum number of distractors to return.
 * @returns Up to `count` distractor answers.
 */
export function generateDistracters(correctAnswer: string, allFacts: Fact[], count: number): string[] {
  if (count <= 0) {
    return []
  }

  const vocabularyFacts = allFacts.filter((fact) => fact.type === 'vocabulary')
  const normalizedCorrectAnswer = normalizeAnswer(correctAnswer)
  const sourceFact = vocabularyFacts.find(
    (fact) => normalizeAnswer(fact.correctAnswer) === normalizedCorrectAnswer,
  )
  const sourceCategorySegment = sourceFact === undefined ? null : getFinalCategorySegment(sourceFact)
  const targetLength = correctAnswer.trim().length

  const seenAnswers = new Set<string>([normalizedCorrectAnswer])
  const preferred: string[] = []
  const fallback: string[] = []

  for (const fact of vocabularyFacts) {
    const candidate = fact.correctAnswer.trim()

    if (candidate.length === 0) {
      continue
    }

    const normalizedCandidate = normalizeAnswer(candidate)

    if (seenAnswers.has(normalizedCandidate)) {
      continue
    }

    seenAnswers.add(normalizedCandidate)

    const candidateCategorySegment = getFinalCategorySegment(fact)
    const isSameCategory =
      sourceCategorySegment !== null && candidateCategorySegment === sourceCategorySegment
    const isSimilarLength = Math.abs(candidate.length - targetLength) <= 3

    if (isSameCategory && isSimilarLength) {
      preferred.push(candidate)
      continue
    }

    fallback.push(candidate)
  }

  return [...preferred, ...fallback].slice(0, count)
}
