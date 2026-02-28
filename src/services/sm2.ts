import type { ReviewState } from '../data/types'
import { BALANCE } from '../data/balance'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Creates an initial SM-2 review state for a fact.
 *
 * @param factId - Fact identifier to track in spaced repetition.
 * @returns Fresh review state marked as immediately due.
 */
export function createReviewState(factId: string): ReviewState {
  return {
    factId,
    easeFactor: BALANCE.SM2_INITIAL_EASE,
    interval: 0,
    repetitions: 0,
    nextReviewAt: 0,
    lastReviewAt: 0,
    quality: 0,
  }
}

/**
 * Applies one SM-2 review result and returns a new immutable state.
 *
 * @param state - Current review state.
 * @param correct - Whether the answer was correct.
 * @returns Updated review state with recalculated schedule.
 */
export function reviewFact(state: ReviewState, correct: boolean): ReviewState {
  let quality: number
  let repetitions: number
  let interval: number
  let easeFactor: number

  if (correct) {
    quality = 5
    repetitions = state.repetitions + 1

    if (repetitions === 1) {
      interval = 1
    } else if (repetitions === 2) {
      interval = 6
    } else {
      interval = Math.round(state.interval * state.easeFactor)
    }

    easeFactor =
      state.easeFactor +
      (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    easeFactor = Math.max(easeFactor, BALANCE.SM2_MIN_EASE)
  } else {
    quality = 1
    repetitions = 0
    interval = 1
    easeFactor = Math.max(state.easeFactor - 0.2, BALANCE.SM2_MIN_EASE)
  }

  const now = Date.now()

  return {
    ...state,
    easeFactor,
    interval,
    repetitions,
    quality,
    nextReviewAt: now + interval * MS_PER_DAY,
    lastReviewAt: now,
  }
}

/**
 * Checks whether a fact is due for review.
 *
 * @param state - Review state to evaluate.
 * @returns True if the review time has been reached.
 */
export function isDue(state: ReviewState): boolean {
  return state.nextReviewAt <= Date.now()
}

/**
 * Maps current interval to a user-facing mastery label.
 *
 * @param state - Review state to classify.
 * @returns Current mastery level bucket.
 */
export function getMasteryLevel(
  state: ReviewState,
): 'new' | 'learning' | 'familiar' | 'known' | 'mastered' {
  if (state.interval === 0) {
    return 'new'
  }

  if (state.interval < 3) {
    return 'learning'
  }

  if (state.interval < 10) {
    return 'familiar'
  }

  if (state.interval < 30) {
    return 'known'
  }

  return 'mastered'
}
