import type { ReviewState, CardState } from '../data/types'
import { BALANCE } from '../data/balance'
import {
  SM2_SECOND_INTERVAL_DAYS,
  SM2_MASTERY_INTERVAL_GENERAL,
  SM2_MASTERY_INTERVAL_VOCAB,
  SM2_LEARNING_STEPS,
  SM2_RELEARNING_STEPS,
  SM2_GRADUATING_INTERVAL,
  SM2_EASY_INTERVAL,
  SM2_LAPSE_NEW_INTERVAL_PCT,
  SM2_LEECH_THRESHOLD,
  SM2_EASY_BONUS_MULTIPLIER,
} from '../data/balance'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_MIN = 60 * 1000

export type AnkiButton = 'again' | 'okay' | 'good'

/**
 * Creates an initial review state for a new fact.
 * Card starts in 'new' state — must be studied before it enters review rotation.
 */
export function createReviewState(factId: string): ReviewState {
  return {
    factId,
    cardState: 'new',
    easeFactor: BALANCE.SM2_INITIAL_EASE, // 2.5
    interval: 0,
    repetitions: 0,
    nextReviewAt: 0,  // immediately available
    lastReviewAt: 0,
    quality: 0,
    learningStep: 0,
    lapseCount: 0,
    isLeech: false,
  }
}

/**
 * Core Anki-faithful review function. Applies one button press and returns new immutable state.
 *
 * Card state transitions:
 * - new/learning: Again→step0, Okay→next step (graduate on last), Good→graduate immediately
 * - review: Again→lapse(relearning), Okay→interval*ease, Good→interval*ease*1.3(ease+15%)
 * - relearning: Same as learning but graduation preserves 70% of old interval
 */
export function reviewCard(state: ReviewState, button: AnkiButton): ReviewState {
  const now = Date.now()

  switch (state.cardState) {
    case 'new':
    case 'learning':
      return handleLearning(state, button, now, SM2_LEARNING_STEPS, 'review')
    case 'review':
      return handleReview(state, button, now)
    case 'relearning':
      return handleLearning(state, button, now, SM2_RELEARNING_STEPS, 'review')
    default:
      return handleLearning(state, button, now, SM2_LEARNING_STEPS, 'review')
  }
}

/** Handle learning/relearning state button presses */
function handleLearning(
  state: ReviewState,
  button: AnkiButton,
  now: number,
  steps: readonly number[],
  _graduateTo: CardState,
): ReviewState {
  const isRelearning = state.cardState === 'relearning'

  switch (button) {
    case 'again': {
      // Reset to first step
      const delay = steps[0] ?? 1
      return {
        ...state,
        cardState: isRelearning ? 'relearning' : 'learning',
        learningStep: 0,
        quality: 1,
        nextReviewAt: now + delay * MS_PER_MIN,
        lastReviewAt: now,
      }
    }
    case 'okay': {
      const nextStep = state.learningStep + 1
      if (nextStep >= steps.length) {
        // Graduate!
        return graduate(state, now, isRelearning)
      }
      // Advance to next step
      const delay = steps[nextStep] ?? 10
      return {
        ...state,
        cardState: isRelearning ? 'relearning' : 'learning',
        learningStep: nextStep,
        quality: 3,
        nextReviewAt: now + delay * MS_PER_MIN,
        lastReviewAt: now,
      }
    }
    case 'good': {
      // Graduate immediately with easy interval
      return graduateEasy(state, now, isRelearning)
    }
  }
}

/** Graduate a card from learning/relearning to review state */
function graduate(state: ReviewState, now: number, isRelearning: boolean): ReviewState {
  const interval = isRelearning
    ? Math.max(1, Math.round(state.interval * SM2_LAPSE_NEW_INTERVAL_PCT))
    : SM2_GRADUATING_INTERVAL

  return {
    ...state,
    cardState: 'review',
    learningStep: 0,
    interval,
    repetitions: isRelearning ? state.repetitions : 1,
    quality: 3,
    nextReviewAt: now + interval * MS_PER_DAY,
    lastReviewAt: now,
  }
}

/** Graduate immediately with easy interval */
function graduateEasy(state: ReviewState, now: number, isRelearning: boolean): ReviewState {
  const interval = isRelearning
    ? Math.max(SM2_EASY_INTERVAL, Math.round(state.interval * SM2_LAPSE_NEW_INTERVAL_PCT))
    : SM2_EASY_INTERVAL

  return {
    ...state,
    cardState: 'review',
    learningStep: 0,
    interval,
    repetitions: isRelearning ? state.repetitions : 1,
    easeFactor: Math.max(state.easeFactor + 0.15, BALANCE.SM2_MIN_EASE),
    quality: 5,
    nextReviewAt: now + interval * MS_PER_DAY,
    lastReviewAt: now,
  }
}

/** Handle review state button presses */
function handleReview(state: ReviewState, button: AnkiButton, now: number): ReviewState {
  switch (button) {
    case 'again': {
      // Lapse — enter relearning
      const newEase = Math.max(state.easeFactor - 0.20, BALANCE.SM2_MIN_EASE)
      const newLapseCount = state.lapseCount + 1
      const steps = SM2_RELEARNING_STEPS
      const delay = steps[0] ?? 10

      return {
        ...state,
        cardState: 'relearning',
        easeFactor: newEase,
        learningStep: 0,
        lapseCount: newLapseCount,
        isLeech: newLapseCount >= SM2_LEECH_THRESHOLD,
        repetitions: 0,
        quality: 1,
        nextReviewAt: now + delay * MS_PER_MIN,
        lastReviewAt: now,
      }
    }
    case 'okay': {
      const newInterval = Math.max(state.interval + 1, Math.round(state.interval * state.easeFactor))
      return {
        ...state,
        interval: newInterval,
        repetitions: state.repetitions + 1,
        quality: 4,
        nextReviewAt: now + newInterval * MS_PER_DAY,
        lastReviewAt: now,
      }
    }
    case 'good': {
      const newInterval = Math.max(state.interval + 1, Math.round(state.interval * state.easeFactor * SM2_EASY_BONUS_MULTIPLIER))
      const newEase = state.easeFactor + 0.15
      return {
        ...state,
        interval: newInterval,
        easeFactor: newEase,
        repetitions: state.repetitions + 1,
        quality: 5,
        nextReviewAt: now + newInterval * MS_PER_DAY,
        lastReviewAt: now,
      }
    }
  }
}

/**
 * Returns human-readable interval previews for each button.
 * Shows what interval would result from pressing each button.
 */
export function getButtonIntervals(state: ReviewState): Record<AnkiButton, string> {
  const formatMinutes = (m: number): string => {
    if (m < 60) return `${m}m`
    if (m < 1440) return `${Math.round(m / 60)}h`
    return `${Math.round(m / 1440)}d`
  }
  const formatDays = (d: number): string => {
    if (d < 30) return `${d}d`
    if (d < 365) return `${Math.round(d / 30)}mo`
    return `${(d / 365).toFixed(1)}y`
  }

  const steps = state.cardState === 'relearning' ? SM2_RELEARNING_STEPS : SM2_LEARNING_STEPS

  if (state.cardState === 'new' || state.cardState === 'learning' || state.cardState === 'relearning') {
    const isRelearning = state.cardState === 'relearning'
    const currentStep = Math.min(state.learningStep, steps.length - 1)
    const nextStep = state.learningStep + 1
    const isLastStep = nextStep >= steps.length

    const againDelay = steps[0] ?? 1

    const okayLabel = isLastStep
      ? formatDays(isRelearning ? Math.max(1, Math.round(state.interval * SM2_LAPSE_NEW_INTERVAL_PCT)) : SM2_GRADUATING_INTERVAL)
      : formatMinutes(steps[nextStep] ?? 10)

    const goodInterval = isRelearning
      ? Math.max(SM2_EASY_INTERVAL, Math.round(state.interval * SM2_LAPSE_NEW_INTERVAL_PCT))
      : SM2_EASY_INTERVAL

    return {
      again: formatMinutes(againDelay),
      okay: okayLabel,
      good: formatDays(goodInterval),
    }
  }

  // Review state
  const okayInterval = Math.max(state.interval + 1, Math.round(state.interval * state.easeFactor))
  const goodInterval = Math.max(state.interval + 1, Math.round(state.interval * state.easeFactor * SM2_EASY_BONUS_MULTIPLIER))
  const relearningDelay = SM2_RELEARNING_STEPS[0] ?? 10

  return {
    again: formatMinutes(relearningDelay),
    okay: formatDays(okayInterval),
    good: formatDays(goodInterval),
  }
}

/**
 * Backward-compatible wrapper. Maps boolean/number quality to AnkiButton.
 * - true → 'okay', false → 'again'
 * - 5 → 'good', 3-4 → 'okay', 0-2 → 'again'
 */
export function reviewFact(state: ReviewState, correctOrQuality: boolean | number): ReviewState {
  let button: AnkiButton
  if (typeof correctOrQuality === 'boolean') {
    button = correctOrQuality ? 'okay' : 'again'
  } else {
    if (correctOrQuality >= 5) button = 'good'
    else if (correctOrQuality >= 3) button = 'okay'
    else button = 'again'
  }
  return reviewCard(state, button)
}

/** Checks whether a fact is due for review. */
export function isDue(state: ReviewState): boolean {
  return state.nextReviewAt <= Date.now()
}

/** Returns true if the fact has reached the mastery threshold. */
export function isMastered(
  state: ReviewState,
  factType: 'fact' | 'vocabulary' | 'grammar' | 'phrase' = 'fact',
): boolean {
  const threshold =
    factType === 'vocabulary' || factType === 'grammar' || factType === 'phrase'
      ? SM2_MASTERY_INTERVAL_VOCAB
      : SM2_MASTERY_INTERVAL_GENERAL
  return state.cardState === 'review' && state.interval >= threshold
}

/** Maps current state to a user-facing mastery label. */
export function getMasteryLevel(
  state: ReviewState,
  contentType: 'fact' | 'vocabulary' | 'grammar' | 'phrase' = 'fact',
): 'new' | 'learning' | 'familiar' | 'known' | 'mastered' {
  if (state.cardState === 'new') return 'new'
  if (state.cardState === 'learning' || state.cardState === 'relearning') return 'learning'

  const isVocab = contentType === 'vocabulary' || contentType === 'phrase'

  if (isVocab) {
    if (state.interval <= 2)  return 'learning'
    if (state.interval <= 7)  return 'familiar'
    if (state.interval <= 30) return 'known'
    return 'mastered'
  } else {
    if (state.interval <= 3)  return 'learning'
    if (state.interval <= 14) return 'familiar'
    if (state.interval <= 60) return 'known'
    return 'mastered'
  }
}
