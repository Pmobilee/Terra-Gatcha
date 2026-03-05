/**
 * Learning effectiveness metrics computation for research reporting.
 * DD-V2-190: Learning effectiveness metrics.
 * All values are aggregated across anonymized player cohorts.
 * Individual player data is never accessible via this service.
 */

/** Retention curve data point at a given days-since-first-review interval. */
export interface RetentionPoint {
  /** Days since first review of the fact. */
  daysSinceFirstReview: number
  /** Fraction of reviews at this interval that were correct (0–1). */
  retentionRate: number
  /** Number of review events contributing to this data point. */
  sampleSize: number
}

/** Spacing-effect measurement comparing massed vs. spaced review accuracy. */
export interface SpacingEffectResult {
  /** Retention rate for facts reviewed with intervals < 3 days (massed practice proxy). */
  massedRetentionRate: number
  /** Retention rate for facts reviewed with intervals ≥ 3 days (spaced practice). */
  spacedRetentionRate: number
  /** Ratio (spaced / massed); values > 1 indicate spacing benefit. */
  spacingAdvantageRatio: number
  sampleSizeMassed: number
  sampleSizeSpaced: number
}

/** Transfer-learning proxy: accuracy on facts in the same category as recently mastered facts. */
export interface TransferLearningResult {
  /** Category name. */
  category: string
  /** Accuracy on facts reviewed within 7 days of mastering a related fact in the same category. */
  postMasteryAccuracy: number
  /** Baseline accuracy on facts in this category without a recent related mastery event. */
  baselineAccuracy: number
  /** Lift = postMasteryAccuracy - baselineAccuracy. */
  transferLift: number
  sampleSizePostMastery: number
  sampleSizeBaseline: number
}

/** Full learning effectiveness report. */
export interface LearningEffectivenessReport {
  generatedAt: string
  periodStart: string
  periodEnd: string
  /** Estimated total active learners (DP-noised). */
  totalActiveLearners: number
  /** Forgetting curve — retention rate binned by days since first exposure. */
  retentionCurve: RetentionPoint[]
  /** Spacing-effect measurement. */
  spacingEffect: SpacingEffectResult
  /** Transfer-learning proxy per category. */
  transferLearning: TransferLearningResult[]
  /** SM-2 algorithm statistics. */
  sm2Stats: {
    avgEaseFactor: number
    avgIntervalAtMastery: number
    avgRepetitionsToMastery: number
    lapseRateAtRep1: number
    lapseRateAtRep5Plus: number
    consistencyPenaltyTriggerRate: number
  }
  /** Engagement correlation with retention. */
  engagementCorrelation: {
    nurtureRetention30d: number
    normalRetention30d: number
    challengeRetention30d: number
  }
}

/** Ordered category names matching the facts database top-level categories. */
export const CATEGORIES = [
  'Language',
  'Natural Sciences',
  'Life Sciences',
  'History',
  'Geography',
  'Technology',
  'Culture',
] as const

/**
 * Compute a learning effectiveness report for the given calendar period.
 * In production this executes SQL queries against the review_states and
 * analytics_events tables with appropriate GROUP BY / HAVING clauses.
 * For now returns a plausible stub with realistic benchmark values.
 *
 * @param periodStart - ISO 8601 date string for period start.
 * @param periodEnd   - ISO 8601 date string for period end.
 * @returns Populated LearningEffectivenessReport (stub values until DB is queried).
 */
export function computeLearningEffectiveness(
  periodStart: string,
  periodEnd: string,
): LearningEffectivenessReport {
  // Forgetting curve buckets matching Ebbinghaus empirical decay
  const retentionCurve: RetentionPoint[] = [
    { daysSinceFirstReview: 1,  retentionRate: 0.91, sampleSize: 0 },
    { daysSinceFirstReview: 3,  retentionRate: 0.84, sampleSize: 0 },
    { daysSinceFirstReview: 7,  retentionRate: 0.76, sampleSize: 0 },
    { daysSinceFirstReview: 14, retentionRate: 0.69, sampleSize: 0 },
    { daysSinceFirstReview: 30, retentionRate: 0.61, sampleSize: 0 },
    { daysSinceFirstReview: 60, retentionRate: 0.54, sampleSize: 0 },
    { daysSinceFirstReview: 90, retentionRate: 0.49, sampleSize: 0 },
  ]

  const transferLearning: TransferLearningResult[] = CATEGORIES.map((category) => ({
    category,
    postMasteryAccuracy: 0.0,
    baselineAccuracy: 0.0,
    transferLift: 0.0,
    sampleSizePostMastery: 0,
    sampleSizeBaseline: 0,
  }))

  return {
    generatedAt: new Date().toISOString(),
    periodStart,
    periodEnd,
    totalActiveLearners: 0,
    retentionCurve,
    spacingEffect: {
      massedRetentionRate: 0.0,
      spacedRetentionRate: 0.0,
      spacingAdvantageRatio: 0.0,
      sampleSizeMassed: 0,
      sampleSizeSpaced: 0,
    },
    transferLearning,
    sm2Stats: {
      avgEaseFactor: 2.5,
      avgIntervalAtMastery: 60,
      avgRepetitionsToMastery: 0,
      lapseRateAtRep1: 0.0,
      lapseRateAtRep5Plus: 0.0,
      consistencyPenaltyTriggerRate: 0.0,
    },
    engagementCorrelation: {
      nurtureRetention30d: 0.0,
      normalRetention30d:  0.0,
      challengeRetention30d: 0.0,
    },
  }
}
