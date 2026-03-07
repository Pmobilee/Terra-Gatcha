import { BALANCE } from '../data/balance'
import type { Fact, ReviewState } from '../data/types'

/**
 * Selects the next quiz fact from review-due cards only.
 *
 * Only cards in the 'review' state (not 'new', 'learning', or 'relearning')
 * are considered. New/learning cards stay in StudySession. Returns null when
 * no review cards are due.
 *
 * @param facts - Candidate facts available for quizzing.
 * @param reviewStates - Review states associated with learned facts.
 * @returns The selected fact, or null when no review cards are due.
 */
export function selectQuestion(facts: Fact[], reviewStates: ReviewState[]): Fact | null {
  if (facts.length === 0) {
    return null
  }

  const now = Date.now()
  const factById = new Map(facts.map((fact) => [fact.id, fact]))

  let earliestDueState: ReviewState | null = null

  for (const state of reviewStates) {
    // Only select cards in 'review' state — new/learning cards stay in StudySession
    if (state.cardState !== 'review') {
      continue
    }
    if (state.nextReviewAt > now) {
      continue
    }
    if (!factById.has(state.factId)) {
      continue
    }
    if (earliestDueState === null || state.nextReviewAt < earliestDueState.nextReviewAt) {
      earliestDueState = state
    }
  }

  if (earliestDueState !== null) {
    return factById.get(earliestDueState.factId) ?? null
  }

  // No review cards due — return null instead of random fallback
  return null
}

/**
 * Builds shuffled multiple-choice answers for a quiz fact.
 *
 * The resulting array contains the correct answer and a random subset of
 * distractors defined by game balance.
 *
 * @param fact - Fact used to generate quiz choices.
 * @returns A shuffled array containing one correct answer and distractors.
 */
export function getQuizChoices(fact: Fact): string[] {
  const distractors = shuffleArray([...fact.distractors]).slice(0, BALANCE.QUIZ_DISTRACTORS_SHOWN)
  const choices = [...distractors, fact.correctAnswer]

  return shuffleArray(choices)
}

/**
 * Grades a submitted answer against the fact's correct answer.
 *
 * @param fact - Fact containing the correct answer.
 * @param answer - Player's submitted answer.
 * @returns True when the answer exactly matches the correct answer.
 */
export function gradeAnswer(fact: Fact, answer: string): boolean {
  return answer === fact.correctAnswer
}

/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 *
 * @param array - Array to shuffle.
 * @returns The same array reference, shuffled in place.
 */
export function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }

  return array
}
