// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computeStudyScore, getStudyScoreTier } from '../../src/services/studyScore'
import type { PlayerSave, ReviewState } from '../../src/data/types'

const NOW = Date.UTC(2026, 2, 7, 12, 0, 0)
const DAY_MS = 24 * 60 * 60 * 1000

function makeSave(input: {
  learnedFacts: string[]
  reviewStates: ReviewState[]
  lastStudySessionTimestamps?: number[]
}): PlayerSave {
  return {
    learnedFacts: input.learnedFacts,
    reviewStates: input.reviewStates,
    lastStudySessionTimestamps: input.lastStudySessionTimestamps ?? [],
  } as unknown as PlayerSave
}

describe('computeStudyScore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns neutral score for a new player with zero learned facts', () => {
    const save = makeSave({ learnedFacts: [], reviewStates: [], lastStudySessionTimestamps: [] })
    expect(computeStudyScore(save)).toBe(0.5)
  })

  it('returns a low score for overdue-heavy profiles with no mastery or recent study', () => {
    const reviewStates: ReviewState[] = Array.from({ length: 5 }, (_, idx) => ({
      factId: `f-${idx}`,
      interval: 2,
      repetitions: 2,
      lastReviewAt: NOW - 10 * DAY_MS,
      nextReviewAt: 0,
      easeFactor: 2.5,
      quality: 3,
    }))

    const save = makeSave({
      learnedFacts: ['f-0', 'f-1', 'f-2', 'f-3', 'f-4'],
      reviewStates,
      lastStudySessionTimestamps: [],
    })

    expect(computeStudyScore(save)).toBe(0)
  })

  it('returns 1.0 for high mastery, no debt, and strong 7-day engagement', () => {
    const reviewStates: ReviewState[] = Array.from({ length: 5 }, (_, idx) => ({
      factId: `f-${idx}`,
      interval: 30,
      repetitions: 4,
      lastReviewAt: NOW,
      nextReviewAt: 0,
      easeFactor: 2.7,
      quality: 5,
    }))

    const recentSessions = [1, 2, 3, 4, 5].map(days => NOW - days * DAY_MS)
    const save = makeSave({
      learnedFacts: ['f-0', 'f-1', 'f-2', 'f-3', 'f-4'],
      reviewStates,
      lastStudySessionTimestamps: recentSessions,
    })

    expect(computeStudyScore(save)).toBe(1)
  })

  it('clamps score at upper boundary when mastery ratio would exceed 1.0', () => {
    const reviewStates: ReviewState[] = [
      {
        factId: 'f-0',
        interval: 40,
        repetitions: 1,
        lastReviewAt: NOW,
        nextReviewAt: 0,
        easeFactor: 2.5,
        quality: 4,
      },
      {
        factId: 'f-1',
        interval: 50,
        repetitions: 1,
        lastReviewAt: NOW,
        nextReviewAt: 0,
        easeFactor: 2.5,
        quality: 4,
      },
      {
        factId: 'f-2',
        interval: 60,
        repetitions: 1,
        lastReviewAt: NOW,
        nextReviewAt: 0,
        easeFactor: 2.5,
        quality: 4,
      },
    ]

    const save = makeSave({
      learnedFacts: ['f-0'],
      reviewStates,
      lastStudySessionTimestamps: [NOW - DAY_MS, NOW - 2 * DAY_MS, NOW - 3 * DAY_MS, NOW - 4 * DAY_MS, NOW - 5 * DAY_MS],
    })

    expect(computeStudyScore(save)).toBe(1)
  })
})

describe('getStudyScoreTier', () => {
  it('returns new_player when total learned facts is zero', () => {
    expect(getStudyScoreTier(1, 0)).toBe('new_player')
  })

  it('returns diligent at score >= 0.7 for non-new players', () => {
    expect(getStudyScoreTier(0.7, 10)).toBe('diligent')
    expect(getStudyScoreTier(0.95, 10)).toBe('diligent')
  })

  it('returns average at 0.3 <= score < 0.7', () => {
    expect(getStudyScoreTier(0.3, 10)).toBe('average')
    expect(getStudyScoreTier(0.6999, 10)).toBe('average')
  })

  it('returns neglectful below 0.3 for non-new players', () => {
    expect(getStudyScoreTier(0.2999, 10)).toBe('neglectful')
  })
})
