/**
 * A/B experiment result aggregation (Phase 41.2).
 * Reads `experiment_assigned` and primary-metric events from analytics_events
 * to compute per-variant conversion rates with a simple Z-score significance test.
 */

export interface VariantResult {
  variant: string
  impressions: number
  conversions: number
  conversionRate: number
  /** Z-score vs control (undefined for the control variant itself). */
  zScore?: number
  /** p-value approximation (two-tailed, normal approximation). */
  pValue?: number
  isStatisticallySignificant?: boolean
}

export interface ExperimentResult {
  experimentKey: string
  primaryMetric: string
  variants: VariantResult[]
  totalImpressions: number
  winner: string | null
  status: 'insufficient_data' | 'running' | 'significant'
}

/**
 * Compute results for one experiment from raw event rows.
 * In production, `events` is the result of a DB query scoped to the experiment's
 * date range.  In tests, pass a hand-crafted array.
 *
 * @param experimentKey   - The experiment identifier.
 * @param primaryMetric   - Event name that counts as a conversion.
 * @param variantLabels   - All variant labels in definition order.
 * @param events          - Raw analytics_events rows (filtered by experiment key upstream).
 */
export function computeExperimentResult(
  experimentKey: string,
  primaryMetric: string,
  variantLabels: string[],
  events: Array<{ eventName: string; properties: string; sessionId: string }>
): ExperimentResult {
  // Map sessionId → variant from assignment events
  const sessionVariant = new Map<string, string>()
  const conversionSessions = new Set<string>()

  for (const row of events) {
    let props: Record<string, unknown>
    try {
      props = JSON.parse(row.properties) as Record<string, unknown>
    } catch {
      continue
    }

    if (row.eventName === 'experiment_assigned' && props.experiment_key === experimentKey) {
      sessionVariant.set(row.sessionId, String(props.variant))
    }
    if (row.eventName === primaryMetric) {
      conversionSessions.add(row.sessionId)
    }
  }

  // Aggregate per variant
  const variantMap = new Map<string, { impressions: number; conversions: number }>()
  for (const label of variantLabels) {
    variantMap.set(label, { impressions: 0, conversions: 0 })
  }
  for (const [sessionId, variant] of sessionVariant) {
    const agg = variantMap.get(variant)
    if (!agg) continue
    agg.impressions++
    if (conversionSessions.has(sessionId)) agg.conversions++
  }

  // Compute Z-score vs control (index 0)
  const controlLabel = variantLabels[0]!
  const control = variantMap.get(controlLabel)!
  const pControl = control.impressions > 0 ? control.conversions / control.impressions : 0

  const results: VariantResult[] = []
  let winner: string | null = null
  let anySignificant = false

  for (const label of variantLabels) {
    const agg = variantMap.get(label)!
    const conversionRate = agg.impressions > 0 ? agg.conversions / agg.impressions : 0

    if (label === controlLabel) {
      results.push({ variant: label, impressions: agg.impressions, conversions: agg.conversions, conversionRate })
      continue
    }

    // Two-proportion Z-test
    const pPooled =
      (control.conversions + agg.conversions) / Math.max(1, control.impressions + agg.impressions)
    const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / Math.max(1, control.impressions) + 1 / Math.max(1, agg.impressions)))
    const zScore = se === 0 ? 0 : (conversionRate - pControl) / se
    const pValue = 2 * (1 - normalCDF(Math.abs(zScore)))
    const isStatisticallySignificant = pValue < 0.05 && agg.impressions >= 100

    if (isStatisticallySignificant && conversionRate > pControl) {
      winner = label
      anySignificant = true
    }

    results.push({
      variant: label,
      impressions: agg.impressions,
      conversions: agg.conversions,
      conversionRate,
      zScore,
      pValue,
      isStatisticallySignificant,
    })
  }

  const totalImpressions = results.reduce((s, r) => s + r.impressions, 0)
  const status: ExperimentResult['status'] =
    totalImpressions < 100 ? 'insufficient_data' : anySignificant ? 'significant' : 'running'

  return { experimentKey, primaryMetric, variants: results, totalImpressions, winner, status }
}

/** Standard normal CDF approximation (Abramowitz & Stegun 26.2.17). */
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const poly =
    t * (0.319381530 +
      t * (-0.356563782 +
        t * (1.781477937 +
          t * (-1.821255978 +
            t * 1.330274429))))
  const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)
  const upper = pdf * poly
  return z >= 0 ? 1 - upper : upper
}
