// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { selectReviewAheadQuestion, selectDifficultyWeightedQuestion } from '../../src/services/quizService'
import type { Fact, ReviewState } from '../../src/data/types'
import { createReviewState } from '../../src/services/sm2'

const MS_PER_DAY = 24 * 60 * 60 * 1000

function makeFact(id: string): Fact {
  return {
    id,
    type: 'fact',
    statement: `Statement ${id}`,
    quizQuestion: `Question ${id}?`,
    correctAnswer: `Answer ${id}`,
    distractors: ['a', 'b', 'c'],
    category: ['Test'],
    difficulty: 1,
    explanation: '',
    mnemonic: '',
    gaiaComment: '',
    categoryL1: 'Test',
    ageRating: 'adult',
    rarity: 'common',
    funScore: 5,
  } as Fact
}

function makeReviewState(factId: string, overrides: Partial<ReviewState> = {}): ReviewState {
  return {
    ...createReviewState(factId),
    cardState: 'review',
    interval: 7,
    easeFactor: 2.5,
    lastReviewAt: Date.now() - 5 * MS_PER_DAY,
    nextReviewAt: Date.now() + 2 * MS_PER_DAY,
    ...overrides,
  }
}

describe('selectReviewAheadQuestion', () => {
  it('returns null with no facts', () => {
    expect(selectReviewAheadQuestion([], [])).toBeNull()
  })

  it('returns null when all cards are due (not ahead)', () => {
    const facts = [makeFact('f1')]
    const states = [makeReviewState('f1', { nextReviewAt: Date.now() - 1000 })]
    expect(selectReviewAheadQuestion(facts, states)).toBeNull()
  })

  it('returns not-yet-due card closest to due date', () => {
    const facts = [makeFact('f1'), makeFact('f2')]
    const states = [
      makeReviewState('f1', { nextReviewAt: Date.now() + 5 * MS_PER_DAY }),
      makeReviewState('f2', { nextReviewAt: Date.now() + 1 * MS_PER_DAY }),
    ]
    const result = selectReviewAheadQuestion(facts, states)
    expect(result).not.toBeNull()
    expect(result!.fact.id).toBe('f2')
  })

  it('returns proportion based on elapsed/scheduled', () => {
    const now = Date.now()
    const facts = [makeFact('f1')]
    const states = [makeReviewState('f1', {
      interval: 10,
      lastReviewAt: now - 5 * MS_PER_DAY,
      nextReviewAt: now + 5 * MS_PER_DAY,
    })]
    const result = selectReviewAheadQuestion(facts, states)
    expect(result).not.toBeNull()
    expect(result!.proportion).toBeCloseTo(0.5, 1)
  })

  it('skips non-review cards', () => {
    const facts = [makeFact('f1')]
    const states = [makeReviewState('f1', { cardState: 'learning', nextReviewAt: Date.now() + 1000 })]
    expect(selectReviewAheadQuestion(facts, states)).toBeNull()
  })
})

describe('selectDifficultyWeightedQuestion', () => {
  it('returns null with no due review cards', () => {
    const facts = [makeFact('f1')]
    const states = [makeReviewState('f1', { nextReviewAt: Date.now() + MS_PER_DAY })]
    expect(selectDifficultyWeightedQuestion(facts, states, 0.5)).toBeNull()
  })

  it('returns a due card when available', () => {
    const facts = [makeFact('f1'), makeFact('f2'), makeFact('f3')]
    const states = facts.map(f => makeReviewState(f.id, { nextReviewAt: Date.now() - 1000 }))
    const result = selectDifficultyWeightedQuestion(facts, states, 0.5)
    expect(result).not.toBeNull()
  })

  it('falls back to selectQuestion with fewer than 3 candidates', () => {
    const facts = [makeFact('f1')]
    const states = [makeReviewState('f1', { nextReviewAt: Date.now() - 1000 })]
    const result = selectDifficultyWeightedQuestion(facts, states, 0.5)
    // Should still return the one available card (via selectQuestion fallback)
    expect(result).not.toBeNull()
    expect(result!.id).toBe('f1')
  })
})
