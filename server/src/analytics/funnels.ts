/**
 * Funnel definitions and computation (Phase 41.3).
 * A funnel is an ordered sequence of event names.  A session "completes" a step
 * when it has at least one event with that name.  Drop-off is computed as the
 * fraction of sessions that reached step N but did not reach step N+1.
 */

export interface FunnelStep {
  name: string
  eventName: string
}

export interface FunnelDef {
  key: string
  label: string
  steps: FunnelStep[]
}

/** Defined conversion funnels tracked for product analytics. */
export const FUNNELS: FunnelDef[] = [
  {
    key: 'core_onboarding',
    label: 'Core Onboarding',
    steps: [
      { name: 'App Opened', eventName: 'app_open' },
      { name: 'Tutorial Step 1', eventName: 'tutorial_step_complete' },
      { name: 'First Dive Entered', eventName: 'first_dive_complete' },
      { name: 'First Quiz Answered', eventName: 'quiz_answered' },
      { name: 'Day-1 Return', eventName: 'app_open' },  // second occurrence
    ],
  },
  {
    key: 'monetisation',
    label: 'Monetisation',
    steps: [
      { name: 'Terra Pass Viewed', eventName: 'terra_pass_viewed' },
      { name: 'IAP Started', eventName: 'iap_purchase_started' },
      { name: 'IAP Completed', eventName: 'iap_purchase_completed' },
    ],
  },
]

export interface FunnelStepResult {
  name: string
  eventName: string
  sessions: number
  dropOffCount: number
  dropOffRate: number
  conversionRate: number
}

export interface FunnelResult {
  funnelKey: string
  label: string
  steps: FunnelStepResult[]
  overallConversion: number
  totalEntered: number
}

/**
 * Compute funnel results from raw analytics event rows.
 *
 * @param def    - The funnel definition.
 * @param events - Pre-filtered analytics event rows for the date range.
 */
export function computeFunnel(
  def: FunnelDef,
  events: Array<{ eventName: string; sessionId: string }>
): FunnelResult {
  // Build per-session ordered event name list
  const sessionEvents = new Map<string, string[]>()
  for (const e of events) {
    const list = sessionEvents.get(e.sessionId) ?? []
    list.push(e.eventName)
    sessionEvents.set(e.sessionId, list)
  }

  // For each step, count sessions that have ≥ N occurrences of the required event
  // (the Day-1 Return step needs a second 'app_open', hence occurrence counting)
  const stepCounts: number[] = def.steps.map((step, stepIdx) => {
    let count = 0
    for (const evts of sessionEvents.values()) {
      // Count how many times this event appears; require occurrence >= (step position among same-event steps + 1)
      const occurrenceNeeded =
        def.steps.slice(0, stepIdx + 1).filter((s) => s.eventName === step.eventName).length
      const occurrenceActual = evts.filter((e) => e === step.eventName).length
      if (occurrenceActual >= occurrenceNeeded) count++
    }
    return count
  })

  const total = stepCounts[0] ?? 0
  const stepResults: FunnelStepResult[] = def.steps.map((step, i) => {
    const sessions = stepCounts[i] ?? 0
    const prevSessions = i === 0 ? sessions : (stepCounts[i - 1] ?? sessions)
    const dropOffCount = prevSessions - sessions
    const dropOffRate = prevSessions > 0 ? dropOffCount / prevSessions : 0
    const conversionRate = total > 0 ? sessions / total : 0
    return { name: step.name, eventName: step.eventName, sessions, dropOffCount, dropOffRate, conversionRate }
  })

  const lastStep = stepCounts[stepCounts.length - 1] ?? 0
  const overallConversion = total > 0 ? lastStep / total : 0

  return { funnelKey: def.key, label: def.label, steps: stepResults, overallConversion, totalEntered: total }
}
