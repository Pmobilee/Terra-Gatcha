import type { ReviewState } from '../data/types'
import { BALANCE } from '../data/balance'
import {
  SM2_SECOND_INTERVAL_DAYS,
  SM2_MASTERY_INTERVAL_GENERAL,
  SM2_MASTERY_INTERVAL_VOCAB,
} from '../data/balance'

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
 * Supports both boolean (legacy: correct=q5, wrong=q1) and numeric quality (0-5).
 * Quality >= 3 is treated as a passing response; quality < 3 resets repetitions.
 * (DD-V2-085)
 *
 * @param state - Current review state.
 * @param correctOrQuality - Boolean (true=q5, false=q1) or numeric quality 0-5.
 * @returns Updated review state with recalculated schedule.
 */
export function reviewFact(state: ReviewState, correctOrQuality: boolean | number): ReviewState {
  let quality: number

  if (typeof correctOrQuality === 'boolean') {
    quality = correctOrQuality ? 5 : 1
  } else {
    quality = correctOrQuality
  }

  let repetitions: number
  let interval: number
  let easeFactor: number

  if (quality >= 3) {
    // Correct / Good / Easy — advance the schedule
    repetitions = state.repetitions + 1

    if (repetitions === 1) {
      interval = 1
    } else if (repetitions === 2) {
      interval = SM2_SECOND_INTERVAL_DAYS  // 3 days (tuned from SM-2 default of 6)
    } else {
      interval = Math.round(state.interval * state.easeFactor)
    }

    easeFactor =
      state.easeFactor +
      (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    easeFactor = Math.max(easeFactor, BALANCE.SM2_MIN_EASE)
  } else {
    // Failed (quality < 3) — reset to beginning
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
 * Returns true if the fact has reached the mastery threshold.
 * General facts: interval >= 60 days. Vocab/grammar/phrase: interval >= 30 days.
 * (DD-V2-099)
 *
 * @param state - Review state to evaluate.
 * @param factType - Category of the fact for threshold selection.
 * @returns True if the fact is considered mastered.
 */
export function isMastered(
  state: ReviewState,
  factType: 'fact' | 'vocabulary' | 'grammar' | 'phrase' = 'fact',
): boolean {
  const threshold =
    factType === 'vocabulary' || factType === 'grammar' || factType === 'phrase'
      ? SM2_MASTERY_INTERVAL_VOCAB
      : SM2_MASTERY_INTERVAL_GENERAL
  return state.interval >= threshold
}

/**
 * Maps current interval to a user-facing mastery label.
 * Buckets are aligned with SM2_SECOND_INTERVAL_DAYS (3 days) for the learning boundary.
 *
 * @param state - Review state to classify.
 * @param contentType - Optional content type; defaults to 'fact' thresholds.
 * @returns Current mastery level bucket.
 */
export function getMasteryLevel(
  state: ReviewState,
  contentType: 'fact' | 'vocabulary' | 'grammar' | 'phrase' = 'fact',
): 'new' | 'learning' | 'familiar' | 'known' | 'mastered' {
  if (state.interval === 0) return 'new'

  const isVocab = contentType === 'vocabulary' || contentType === 'phrase'

  if (isVocab) {
    // Vocabulary profile (DD-V2-098): faster mastery timeline
    if (state.interval <= 2)  return 'learning'
    if (state.interval <= 7)  return 'familiar'
    if (state.interval <= 30) return 'known'
    return 'mastered'
  } else {
    // General fact profile (DD-V2-098): slower mastery timeline
    if (state.interval <= 3)  return 'learning'
    if (state.interval <= 14) return 'familiar'
    if (state.interval <= 60) return 'known'
    return 'mastered'
  }
}
