/**
 * Client-side learning insights computation from a player's SM-2 review history.
 * All calculations run locally from the player's own ReviewStates.
 * No server round-trip is required. DD-V2-190: GAIA learning insights.
 */

import type { ReviewState } from '../data/types'
import type { EngagementData } from './engagementScorer'

/** A computed category strength entry. */
export interface CategoryStrength {
  category: string
  /** Fraction of facts in this category where interval ≥ 30 days. */
  masteryRate: number
  /** Average ease factor for facts in this category. */
  avgEaseFactor: number
  /** Total number of reviews logged in this category. */
  reviewCount: number
}

/** Predicted retention at a future time point. */
export interface RetentionPrediction {
  /** Days in the future (30, 60, 90). */
  daysOut: number
  /** Predicted fraction of currently-mastered facts still recalled. */
  predictedRetention: number
}

/** Personal learning insights derived from a player's ReviewState array. */
export interface LearningInsights {
  /** ISO date this was computed (YYYY-MM-DD). */
  computedOn: string
  /** Total facts the player has ever reviewed. */
  totalReviewed: number
  /** Facts with interval ≥ 30 days (considered mastered). */
  masteredCount: number
  /** Mastery rate (masteredCount / totalReviewed). */
  masteryRate: number
  /** Average ease factor across all review states. */
  avgEaseFactor: number
  /** Current average interval in days across all review states. */
  avgIntervalDays: number
  /**
   * Mastery velocity: facts reaching mastery (interval ≥ 30d) per week,
   * computed over the most recent 28 days.
   */
  masteryVelocityPerWeek: number
  /** Top 3 strongest categories (highest mastery rate + ease factor). */
  topCategories: CategoryStrength[]
  /** Retention predictions at 30/60/90 days using Ebbinghaus model + player ease factor. */
  retentionPredictions: RetentionPrediction[]
  /** Optimal daily study window estimate (hours), derived from review history timestamps. */
  optimalStudyHourLocal: number | null
  /** Number of facts currently overdue for review. */
  overdueCount: number
  /** Average lapse rate (fraction of reviews that followed a successful review). */
  lapseRate: number
}

/** Mastery threshold: interval ≥ this many days = fact is considered mastered. */
const MASTERY_INTERVAL_DAYS = 30

/**
 * Compute personal learning insights from a player's review states.
 *
 * @param reviewStates   - The player's full SM-2 review state array.
 * @param engagementData - The player's engagement data for velocity computation.
 * @param factCategories - Map from factId → category name, for category breakdown.
 * @returns A LearningInsights object populated from the player's local data.
 */
export function computeLearningInsights(
  reviewStates: ReviewState[],
  engagementData: EngagementData,
  factCategories: Map<string, string>,
): LearningInsights {
  const now = Date.now()
  const computedOn = new Date(now).toISOString().slice(0, 10)

  // Suppress unused parameter warning — engagementData reserved for future use
  void engagementData

  if (reviewStates.length === 0) {
    return {
      computedOn,
      totalReviewed: 0,
      masteredCount: 0,
      masteryRate: 0,
      avgEaseFactor: 2.5,
      avgIntervalDays: 0,
      masteryVelocityPerWeek: 0,
      topCategories: [],
      retentionPredictions: [],
      optimalStudyHourLocal: null,
      overdueCount: 0,
      lapseRate: 0,
    }
  }

  const mastered = reviewStates.filter((rs) => rs.interval >= MASTERY_INTERVAL_DAYS)
  const overdue  = reviewStates.filter((rs) => rs.nextReviewAt <= now)

  const totalReviewed    = reviewStates.length
  const masteredCount    = mastered.length
  const masteryRate      = masteredCount / totalReviewed
  const avgEaseFactor    = reviewStates.reduce((s, rs) => s + rs.easeFactor, 0) / totalReviewed
  const avgIntervalDays  = reviewStates.reduce((s, rs) => s + rs.interval, 0) / totalReviewed

  // Mastery velocity: count facts that crossed the mastery threshold in the last 28 days.
  // Proxy: lastReviewAt within 28 days AND interval >= MASTERY_INTERVAL_DAYS
  const twentyEightDaysAgo = now - 28 * 24 * 60 * 60 * 1000
  const recentlyMastered = mastered.filter(
    (rs) => rs.lastReviewAt >= twentyEightDaysAgo,
  ).length
  const masteryVelocityPerWeek = (recentlyMastered / 28) * 7

  // Category strengths
  const catMap = new Map<string, { mastered: number; total: number; easeSum: number }>()
  for (const rs of reviewStates) {
    const cat = factCategories.get(rs.factId) ?? 'Unknown'
    const existing = catMap.get(cat) ?? { mastered: 0, total: 0, easeSum: 0 }
    catMap.set(cat, {
      mastered: existing.mastered + (rs.interval >= MASTERY_INTERVAL_DAYS ? 1 : 0),
      total:    existing.total + 1,
      easeSum:  existing.easeSum + rs.easeFactor,
    })
  }
  const categoryStrengths: CategoryStrength[] = Array.from(catMap.entries())
    .map(([category, data]) => ({
      category,
      masteryRate:    data.mastered / data.total,
      avgEaseFactor:  data.easeSum / data.total,
      reviewCount:    data.total,
    }))
    .sort((a, b) => (b.masteryRate + b.avgEaseFactor / 5) - (a.masteryRate + a.avgEaseFactor / 5))

  // Retention predictions using simplified Ebbinghaus decay S(t) = e^(-t/tau),
  // where tau is calibrated from the player's average ease factor.
  // EF 2.5 → tau ≈ 90 days (strong retention); EF 1.3 → tau ≈ 25 days
  const tau = 25 + (avgEaseFactor - 1.3) * (90 - 25) / (2.5 - 1.3)
  const retentionPredictions: RetentionPrediction[] = [30, 60, 90].map((daysOut) => ({
    daysOut,
    predictedRetention: parseFloat(Math.exp(-daysOut / tau).toFixed(3)),
  }))

  // Lapse rate: lapses occur when quality < 3 in SM-2 (we proxy via EF drop)
  // Since we don't store raw quality history, approximate from ease factors below baseline
  const lapseRate = reviewStates.filter((rs) => rs.easeFactor < 2.0).length / totalReviewed

  // Optimal study hour: not yet computed (requires server-side timestamp analysis)
  const optimalStudyHourLocal = null

  return {
    computedOn,
    totalReviewed,
    masteredCount,
    masteryRate: parseFloat(masteryRate.toFixed(3)),
    avgEaseFactor: parseFloat(avgEaseFactor.toFixed(3)),
    avgIntervalDays: parseFloat(avgIntervalDays.toFixed(1)),
    masteryVelocityPerWeek: parseFloat(masteryVelocityPerWeek.toFixed(2)),
    topCategories: categoryStrengths.slice(0, 3),
    retentionPredictions,
    optimalStudyHourLocal,
    overdueCount: overdue.length,
    lapseRate: parseFloat(lapseRate.toFixed(3)),
  }
}
