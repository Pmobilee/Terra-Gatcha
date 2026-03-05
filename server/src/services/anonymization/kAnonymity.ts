/**
 * k-Anonymity enforcement for research data exports.
 * Suppresses quasi-identifier groups whose cohort size falls below k=5.
 * DD-V2-190: Anonymization pipeline.
 */

/** Minimum cohort size required before a group can be exported. (DD-V2-190) */
export const K_ANONYMITY_THRESHOLD = 5

/**
 * A row of aggregated research data, grouped by quasi-identifiers.
 * Rows with fewer than K_ANONYMITY_THRESHOLD contributing players are suppressed.
 */
export interface AggregateRow {
  /** Quasi-identifier fields (e.g. archetype, ageBracket, cohortWeek). */
  dimensions: Record<string, string>
  /** Number of distinct players contributing to this row. */
  playerCount: number
  /** Aggregated metrics for this group. */
  metrics: Record<string, number>
}

/**
 * Filter an array of aggregate rows, suppressing any row where playerCount < K.
 * Suppressed rows are replaced with a sentinel indicating suppression rather than
 * being silently dropped, so the recipient knows gaps exist.
 *
 * @param rows - Array of aggregate rows to filter.
 * @returns Filtered array with suppressed rows replaced by sentinel objects.
 */
export function enforceKAnonymity(rows: AggregateRow[]): AggregateRow[] {
  return rows.map((row) => {
    if (row.playerCount < K_ANONYMITY_THRESHOLD) {
      return {
        dimensions: row.dimensions,
        playerCount: 0,
        metrics: Object.fromEntries(Object.keys(row.metrics).map((k) => [k, -1])),
        // -1 signals "suppressed" to consumers; they must treat it as missing data
      }
    }
    return row
  })
}

/**
 * Return true if a row has been suppressed (all metric values are -1).
 *
 * @param row - The aggregate row to check.
 * @returns True if the row has been suppressed by k-anonymity enforcement.
 */
export function isSuppressed(row: AggregateRow): boolean {
  return row.playerCount === 0
}
