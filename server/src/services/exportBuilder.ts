/**
 * Research data export builder for academic partners.
 * Handles CSV/JSON formatting, field validation, and export request parsing.
 * DD-V2-190: Research data export.
 */

import type { AggregateRow } from './anonymization/index.js'

/**
 * Configurable export request from a research partner.
 */
export interface ExportRequest {
  /** Start of the date range (ISO 8601, inclusive). */
  startDate: string
  /** End of the date range (ISO 8601, inclusive). */
  endDate: string
  /** Which dimension fields to include. Allowed set is validated by the route. */
  dimensions: string[]
  /** Which metric fields to include. Allowed set is validated by the route. */
  metrics: string[]
  /** Output format. */
  format: 'csv' | 'json'
  /** DP epsilon override (default 1.0, max 2.0 — tighter budget for external use). */
  epsilon?: number
}

/** Fields that callers may request in the dimensions column set. */
export const ALLOWED_DIMENSIONS = new Set([
  'cohortWeek',       // ISO week string, e.g. "2026-W10"
  'archetype',        // explorer | scholar | collector | sprinter | undetected
  'ageBracket',       // under_13 | teen | adult
  'contentType',      // fact | vocabulary | grammar | phrase
  'categoryL1',       // top-level fact category
  'engagementMode',   // nurture | normal | challenge
])

/** Fields that callers may request in the metrics column set. */
export const ALLOWED_METRICS = new Set([
  'playerCount',
  'avgRetentionRate30d',    // % of facts still recalled at 30 days
  'avgRetentionRate60d',
  'avgFactsMastered',
  'avgDaysToFirstMastery',
  'avgEaseFactor',
  'avgIntervalDays',
  'avgResponseTimeMs',
  'lapseRate',              // % of reviews that were a lapse (correct → wrong)
  'avgSessionDurationMs',
  'avgDivesPerWeek',
  'avgDailyStudyMinutes',
])

/**
 * Convert an array of AggregateRow objects to a CSV string.
 * Columns are: all requested dimension keys + all requested metric keys.
 * Suppressed rows are included as empty strings for metrics.
 *
 * @param rows       - Anonymized aggregate rows.
 * @param dimensions - Ordered list of dimension field names to include.
 * @param metrics    - Ordered list of metric field names to include.
 * @returns A CSV string with a header row and one data row per AggregateRow.
 */
export function rowsToCsv(rows: AggregateRow[], dimensions: string[], metrics: string[]): string {
  const header = [...dimensions, ...metrics].join(',')
  const dataRows = rows.map((row) => {
    const dimCols = dimensions.map((d) => JSON.stringify(row.dimensions[d] ?? ''))
    const metCols = metrics.map((m) => {
      const v = row.metrics[m]
      // -1 signals suppressed; render as empty for CSV consumers
      return v === -1 ? '' : String(v ?? '')
    })
    return [...dimCols, ...metCols].join(',')
  })
  return [header, ...dataRows].join('\n')
}

/**
 * Validate an ExportRequest, returning a human-readable error string
 * or null when the request is valid.
 *
 * @param req - The export request to validate.
 * @returns null if valid, or a descriptive error string.
 */
export function validateExportRequest(req: Partial<ExportRequest>): string | null {
  if (!req.startDate || !req.endDate) return 'startDate and endDate are required'
  if (isNaN(Date.parse(req.startDate))) return 'startDate must be ISO 8601'
  if (isNaN(Date.parse(req.endDate))) return 'endDate must be ISO 8601'
  if (Date.parse(req.startDate) > Date.parse(req.endDate)) return 'startDate must be before endDate'

  const dims = req.dimensions ?? []
  const mets = req.metrics ?? []
  if (dims.length === 0) return 'At least one dimension is required'
  if (mets.length === 0) return 'At least one metric is required'

  for (const d of dims) {
    if (!ALLOWED_DIMENSIONS.has(d)) return `Unknown dimension: ${d}`
  }
  for (const m of mets) {
    if (!ALLOWED_METRICS.has(m)) return `Unknown metric: ${m}`
  }
  if (req.epsilon !== undefined && (req.epsilon <= 0 || req.epsilon > 2.0)) {
    return 'epsilon must be in (0, 2.0]'
  }
  if (!['csv', 'json'].includes(req.format ?? 'json')) return 'format must be csv or json'

  return null
}
