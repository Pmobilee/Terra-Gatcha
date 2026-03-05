/**
 * Anonymization pipeline entry point for research data exports.
 * Combines k-anonymity, PII scrubbing, and differential privacy noise.
 * DD-V2-190: Anonymization pipeline.
 */

import { scrubPii } from './piiScrubber.js'
import { noisifyStats } from './differentialPrivacy.js'
import { enforceKAnonymity, type AggregateRow } from './kAnonymity.js'

export { scrubPii } from './piiScrubber.js'
export { addLaplaceNoise, noisifyStats } from './differentialPrivacy.js'
export { enforceKAnonymity, isSuppressed, K_ANONYMITY_THRESHOLD } from './kAnonymity.js'
export type { AggregateRow }

/** Default privacy budget for standard research exports. */
export const DEFAULT_EPSILON = 1.0

/** Default L1 sensitivity for player counts (one player can change count by 1). */
export const DEFAULT_SENSITIVITY = 1.0

/**
 * Full anonymization pipeline for a batch of aggregate export rows.
 * Applies PII scrubbing, k-anonymity filtering, and Laplace noise in sequence.
 *
 * @param rows        - Raw aggregate rows from the database query.
 * @param epsilon     - DP epsilon (default 1.0).
 * @param sensitivity - L1 sensitivity (default 1.0).
 * @returns Anonymized, filtered, noised rows ready for external delivery.
 */
export function anonymizeBatch(
  rows: AggregateRow[],
  epsilon = DEFAULT_EPSILON,
  sensitivity = DEFAULT_SENSITIVITY,
): AggregateRow[] {
  // Step 1: k-anonymity — suppress small groups
  const kFiltered = enforceKAnonymity(rows)

  // Step 2: PII scrub dimensions (quasi-identifiers may contain PII if misconfigured)
  const piiCleaned = kFiltered.map((row) => ({
    ...row,
    dimensions: scrubPii(row.dimensions) as Record<string, string>,
  }))

  // Step 3: Add Laplace noise to metrics
  return piiCleaned.map((row) => ({
    ...row,
    metrics: noisifyStats(row.metrics, sensitivity, epsilon) as Record<string, number>,
  }))
}
