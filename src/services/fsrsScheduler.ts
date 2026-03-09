import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FSRSCard,
} from 'ts-fsrs'
import type { PlayerFactState, ReviewState } from '../data/types'
import { getCardTier as deriveCardTier } from './tierDerivation'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const scheduler = fsrs(generatorParameters({ enable_fuzz: true }))

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function mapEaseToFSRSDifficulty(easeFactor: number): number {
  const normalized = clamp((easeFactor - 1.3) / 1.2, 0, 1)
  return Math.round(clamp(10 - normalized * 9, 1, 10))
}

function mapDifficultyToEase(difficulty: number): number {
  const normalized = clamp((difficulty - 1) / 9, 0, 1)
  return clamp(2.5 - normalized * 1.2, 1.3, 2.5)
}

function toFsrsState(state: PlayerFactState): State {
  const normalized = (state.state ?? state.cardState ?? 'new').toLowerCase()
  if (normalized === 'learning') return State.Learning
  if (normalized === 'review') return State.Review
  if (normalized === 'relearning') return State.Relearning
  return State.New
}

function fromFsrsState(state: State): 'new' | 'learning' | 'review' | 'relearning' {
  if (state === State.Learning) return 'learning'
  if (state === State.Review) return 'review'
  if (state === State.Relearning) return 'relearning'
  return 'new'
}

function toFsrsCard(state: PlayerFactState): FSRSCard {
  const lastReviewAt = state.lastReview ?? state.lastReviewAt
  const now = Date.now()
  const elapsedDays = lastReviewAt > 0 ? Math.max(0, Math.floor((now - lastReviewAt) / MS_PER_DAY)) : 0

  return {
    due: new Date(state.due ?? state.nextReviewAt ?? now),
    stability: Math.max(0.1, state.stability ?? state.interval ?? 0.1),
    difficulty: clamp(state.difficulty ?? mapEaseToFSRSDifficulty(state.easeFactor ?? 2.5), 1, 10),
    elapsed_days: elapsedDays,
    scheduled_days: Math.max(0, state.interval ?? 0),
    learning_steps: Math.max(0, state.learningStep ?? 0),
    reps: Math.max(0, state.reps ?? state.repetitions ?? 0),
    lapses: Math.max(0, state.lapses ?? state.lapseCount ?? 0),
    state: toFsrsState(state),
    last_review: lastReviewAt > 0 ? new Date(lastReviewAt) : undefined,
  }
}

function updateAvgResponseTime(state: PlayerFactState, responseTimeMs: number): number {
  if (responseTimeMs <= 0) return state.averageResponseTimeMs ?? 0
  const attempts = state.totalAttempts ?? 0
  if (attempts <= 0) return responseTimeMs
  return Math.round(((state.averageResponseTimeMs ?? 0) * attempts + responseTimeMs) / (attempts + 1))
}

export function createFactState(factId: string): PlayerFactState {
  const card = createEmptyCard()
  return {
    factId,
    cardState: 'new',
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewAt: card.due.getTime(),
    lastReviewAt: 0,
    quality: 0,
    learningStep: card.learning_steps,
    lapseCount: 0,
    isLeech: false,
    stability: 0,
    consecutiveCorrect: 0,
    passedMasteryTrial: false,
    retrievability: 0,
    masteredAt: 0,
    graduatedRelicId: null,
    difficulty: clamp(card.difficulty, 1, 10),
    due: card.due.getTime(),
    lastReview: 0,
    reps: card.reps,
    lapses: card.lapses,
    state: fromFsrsState(card.state),
    lastVariantIndex: -1,
    totalAttempts: 0,
    totalCorrect: 0,
    averageResponseTimeMs: 0,
    tierHistory: [],
  }
}

export function migrateReviewState(oldState: ReviewState): PlayerFactState {
  return {
    ...oldState,
    difficulty: clamp(oldState.difficulty ?? mapEaseToFSRSDifficulty(oldState.easeFactor ?? 2.5), 1, 10),
    stability: Math.max(0, oldState.stability ?? oldState.interval ?? 0),
    retrievability: clamp(oldState.retrievability ?? 0.9, 0, 1),
    due: oldState.due ?? oldState.nextReviewAt,
    lastReview: oldState.lastReview ?? oldState.lastReviewAt,
    reps: oldState.reps ?? oldState.repetitions ?? 0,
    lapses: oldState.lapses ?? oldState.lapseCount ?? 0,
    state: oldState.state ?? (
      oldState.cardState === 'suspended'
        ? 'review'
        : oldState.cardState
    ),
    lastVariantIndex: oldState.lastVariantIndex ?? -1,
    totalAttempts: oldState.totalAttempts ?? 0,
    totalCorrect: oldState.totalCorrect ?? 0,
    averageResponseTimeMs: oldState.averageResponseTimeMs ?? 0,
    tierHistory: oldState.tierHistory ?? [],
  }
}

export function reviewFact(
  state: PlayerFactState,
  correct: boolean,
  responseTimeMs = 0,
  variantIndex?: number,
): PlayerFactState {
  const previous = migrateReviewState(state)
  const previousTier = deriveCardTier(previous)
  const now = new Date()
  const grade = correct ? Rating.Good : Rating.Again
  const next = scheduler.next(toFsrsCard(previous), now, grade)
  const card = next.card

  const nextState: PlayerFactState = {
    ...previous,
    difficulty: clamp(card.difficulty, 1, 10),
    stability: Math.max(0, card.stability),
    retrievability: clamp(scheduler.get_retrievability(card, now, false), 0, 1),
    state: fromFsrsState(card.state),
    reps: card.reps,
    lapses: card.lapses,
    due: card.due.getTime(),
    lastReview: now.getTime(),
    cardState: fromFsrsState(card.state),
    easeFactor: mapDifficultyToEase(card.difficulty),
    interval: Math.max(0, card.scheduled_days),
    repetitions: card.reps,
    lapseCount: card.lapses,
    nextReviewAt: card.due.getTime(),
    lastReviewAt: now.getTime(),
    learningStep: card.learning_steps,
    quality: correct ? 4 : 1,
    consecutiveCorrect: correct ? (previous.consecutiveCorrect ?? 0) + 1 : 0,
    totalAttempts: (previous.totalAttempts ?? 0) + 1,
    totalCorrect: (previous.totalCorrect ?? 0) + (correct ? 1 : 0),
    averageResponseTimeMs: updateAvgResponseTime(previous, responseTimeMs),
    lastVariantIndex: variantIndex ?? previous.lastVariantIndex ?? -1,
  }

  const nextTier = deriveCardTier(nextState)
  if (nextTier !== previousTier) {
    nextState.tierHistory = [
      ...(previous.tierHistory ?? []),
      { from: previousTier, to: nextTier, date: now.getTime() },
    ]
  }

  if (nextTier === '3' && !(previous.masteredAt && previous.masteredAt > 0)) {
    nextState.masteredAt = now.getTime()
  }

  return nextState
}

export function isDue(state: PlayerFactState): boolean {
  const dueAt = state.due ?? state.nextReviewAt
  return dueAt <= Date.now()
}

export function getCardTier(state: PlayerFactState): '1' | '2a' | '2b' | '3' {
  return deriveCardTier(state)
}

export function isDormant(state: PlayerFactState): boolean {
  return (state.retrievability ?? 1) < 0.7
}

export function getDueForReview(states: PlayerFactState[], limit: number): PlayerFactState[] {
  return states
    .filter((state) => isDue(state) && (state.state ?? state.cardState) !== 'new')
    .sort((a, b) => (a.due ?? a.nextReviewAt) - (b.due ?? b.nextReviewAt))
    .slice(0, limit)
}

export function getNewFacts(states: PlayerFactState[], limit: number): PlayerFactState[] {
  return states
    .filter((state) => (state.state ?? state.cardState) === 'new')
    .slice(0, limit)
}
