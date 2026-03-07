// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  computeEngagementScore,
  scoreToMode,
  updateEngagementAfterDive,
  getDistractorDifficulty,
  getEngagementGaiaComment,
  type EngagementData,
  type DailyEngagementSnapshot,
} from '../../src/services/engagementScorer'

describe('computeEngagementScore', () => {
  it('returns neutral baseline for empty snapshots', () => {
    expect(computeEngagementScore([])).toBe(50)
  })

  it('computes weighted average across accuracy, frequency, and depth', () => {
    const snapshots: DailyEngagementSnapshot[] = [
      { date: '2026-03-01', quizAccuracy: 1, diveCount: 2, avgLayerReached: 20 },
      { date: '2026-03-02', quizAccuracy: 0.5, diveCount: 1, avgLayerReached: 10 },
    ]

    // avgAccuracy=0.75->75, avgDives=1.5->75, avgLayer=15->75
    expect(computeEngagementScore(snapshots)).toBe(75)
  })

  it('clamps each axis to 100 before averaging', () => {
    const snapshots: DailyEngagementSnapshot[] = [
      { date: '2026-03-01', quizAccuracy: 1.5, diveCount: 8, avgLayerReached: 50 },
    ]

    expect(computeEngagementScore(snapshots)).toBe(100)
  })
})

describe('scoreToMode', () => {
  it('returns nurture below 50, normal at 50-85, and challenge above 85', () => {
    expect(scoreToMode(49)).toBe('nurture')
    expect(scoreToMode(50)).toBe('normal')
    expect(scoreToMode(85)).toBe('normal')
    expect(scoreToMode(86)).toBe('challenge')
  })
})

describe('updateEngagementAfterDive', () => {
  it('creates first snapshot for a new day and recalculates score/mode', () => {
    const current: EngagementData = {
      dailySnapshots: [],
      currentScore: 50,
      mode: 'normal',
    }

    const updated = updateEngagementAfterDive(current, '2026-03-07', 0.9, 12)
    expect(updated.dailySnapshots).toHaveLength(1)
    expect(updated.dailySnapshots[0]).toEqual({
      date: '2026-03-07',
      quizAccuracy: 0.9,
      diveCount: 1,
      avgLayerReached: 12,
    })
    expect(updated.currentScore).toBe(computeEngagementScore(updated.dailySnapshots))
    expect(updated.mode).toBe(scoreToMode(updated.currentScore))
  })

  it('upserts existing day by averaging accuracy/layer and incrementing dive count', () => {
    const current: EngagementData = {
      dailySnapshots: [{ date: '2026-03-07', quizAccuracy: 0.6, diveCount: 2, avgLayerReached: 8 }],
      currentScore: 40,
      mode: 'nurture',
    }

    const updated = updateEngagementAfterDive(current, '2026-03-07', 1, 14)
    expect(updated.dailySnapshots).toHaveLength(1)
    expect(updated.dailySnapshots[0].diveCount).toBe(3)
    expect(updated.dailySnapshots[0].quizAccuracy).toBeCloseTo((0.6 * 2 + 1) / 3, 6)
    expect(updated.dailySnapshots[0].avgLayerReached).toBeCloseTo((8 * 2 + 14) / 3, 6)
  })

  it('sorts snapshots by date and trims to the most recent 7 days', () => {
    const existing = [
      { date: '2026-03-05', quizAccuracy: 0.6, diveCount: 1, avgLayerReached: 8 },
      { date: '2026-03-01', quizAccuracy: 0.6, diveCount: 1, avgLayerReached: 8 },
      { date: '2026-03-04', quizAccuracy: 0.6, diveCount: 1, avgLayerReached: 8 },
      { date: '2026-03-02', quizAccuracy: 0.6, diveCount: 1, avgLayerReached: 8 },
      { date: '2026-03-03', quizAccuracy: 0.6, diveCount: 1, avgLayerReached: 8 },
      { date: '2026-03-07', quizAccuracy: 0.6, diveCount: 1, avgLayerReached: 8 },
      { date: '2026-03-06', quizAccuracy: 0.6, diveCount: 1, avgLayerReached: 8 },
    ]

    const updated = updateEngagementAfterDive(
      { dailySnapshots: existing, currentScore: 50, mode: 'normal' },
      '2026-03-08',
      0.6,
      8,
    )

    expect(updated.dailySnapshots).toHaveLength(7)
    expect(updated.dailySnapshots.map(s => s.date)).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
    ])
  })
})

describe('getDistractorDifficulty', () => {
  it('maps nurture->easy, normal->medium, challenge->hard', () => {
    expect(getDistractorDifficulty({ dailySnapshots: [], currentScore: 10, mode: 'nurture' })).toBe('easy')
    expect(getDistractorDifficulty({ dailySnapshots: [], currentScore: 50, mode: 'normal' })).toBe('medium')
    expect(getDistractorDifficulty({ dailySnapshots: [], currentScore: 90, mode: 'challenge' })).toBe('hard')
  })
})

describe('getEngagementGaiaComment', () => {
  it('returns null when mode does not change', () => {
    expect(getEngagementGaiaComment('normal', 'normal')).toBeNull()
  })

  it('returns challenge encouragement when entering challenge mode', () => {
    expect(getEngagementGaiaComment('normal', 'challenge')).toContain('getting the hang of this')
  })

  it('returns recovery comment when moving nurture->normal', () => {
    expect(getEngagementGaiaComment('nurture', 'normal')).toContain('Solid progress')
  })

  it('returns slowdown comment when entering nurture mode', () => {
    expect(getEngagementGaiaComment('challenge', 'nurture')).toContain("Let's slow down")
  })

  it('returns null for unhandled transition challenge->normal', () => {
    expect(getEngagementGaiaComment('challenge', 'normal')).toBeNull()
  })
})
