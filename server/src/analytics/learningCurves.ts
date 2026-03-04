/**
 * Learning curve computation (Phase 41.6).
 * Produces per-day mastery accumulation and SM-2 interval histograms.
 * Used by the learning effectiveness dashboard and the optional research export.
 */

export interface MasteryPoint {
  daysFromStart: number
  cumulativeMastered: number
  newMastered: number
}

export interface IntervalHistogramBucket {
  intervalDays: number
  count: number
  percent: number
}

/**
 * Compute a mastery accumulation curve from fact_mastered events.
 *
 * @param events - `fact_mastered` events sorted by createdAt ascending.
 */
export function computeMasteryCurve(
  events: Array<{ sessionId: string; createdAt: number }>
): MasteryPoint[] {
  if (events.length === 0) return []

  const startMs = events[0]!.createdAt
  const dayMs = 86_400_000
  const byDay = new Map<number, number>()

  for (const e of events) {
    const day = Math.floor((e.createdAt - startMs) / dayMs)
    byDay.set(day, (byDay.get(day) ?? 0) + 1)
  }

  const maxDay = Math.max(...byDay.keys())
  const result: MasteryPoint[] = []
  let cumulative = 0

  for (let d = 0; d <= maxDay; d++) {
    const newMastered = byDay.get(d) ?? 0
    cumulative += newMastered
    result.push({ daysFromStart: d, cumulativeMastered: cumulative, newMastered })
  }

  return result
}

/**
 * Compute an SM-2 review interval histogram.
 * Buckets: [1, 3, 7, 14, 30, 60, 90, 180, 365, 365+]
 *
 * @param intervals - Array of SM-2 interval values (days) from all active SM-2 cards.
 */
export function computeIntervalHistogram(intervals: number[]): IntervalHistogramBucket[] {
  const buckets = [1, 3, 7, 14, 30, 60, 90, 180, 365]
  const counts = new Array<number>(buckets.length + 1).fill(0)

  for (const interval of intervals) {
    let placed = false
    for (let i = 0; i < buckets.length; i++) {
      if (interval <= buckets[i]!) {
        counts[i]!++
        placed = true
        break
      }
    }
    if (!placed) counts[counts.length - 1]!++
  }

  const total = intervals.length || 1
  return [...buckets, Infinity].map((limit, i) => ({
    intervalDays: limit,
    count: counts[i] ?? 0,
    percent: ((counts[i] ?? 0) / total) * 100,
  }))
}
