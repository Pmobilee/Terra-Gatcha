/**
 * Cohort dashboard data assembly (Phase 41.4).
 * Aggregates retention windows, experiment summaries, funnel overviews, and
 * player segments into a single JSON payload for the admin dashboard renderer.
 */

import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { analyticsEvents } from '../db/schema.js'
import { computeRetention } from '../routes/analytics.js'
import { computePlayerSegments } from '../analytics/playerSegments.js'
import { EXPERIMENTS } from '../data/experiments.js'
import { FUNNELS, computeFunnel } from '../analytics/funnels.js'
import { computeExperimentResult } from '../analytics/experiments.js'

export interface DashboardData {
  generatedAt: string
  retention: {
    d1: number | null
    d7: number | null
    d30: number | null
    d90: number | null
    d1Target: number
    d7Target: number
    d30Target: number
    d90Target: number
    cohortDate: string
  }
  experiments: Array<{
    key: string
    name: string
    status: string
    totalImpressions: number
    winner: string | null
  }>
  funnels: Array<{
    key: string
    label: string
    overallConversion: number
    totalEntered: number
    worstDropOffStep: string
    worstDropOffRate: number
  }>
  segments: {
    masteryFreePercent: number
    masteryFreeStatus: string
    totalD30Active: number
  }
}

/**
 * Assemble all dashboard data.  Heavy — cache the result externally for at
 * least 5 minutes to avoid redundant full-table scans.
 *
 * @param cohortDate - The base date for retention computation (defaults to 30 days ago).
 */
export async function assembleDashboard(cohortDate?: Date): Promise<DashboardData> {
  const base = cohortDate ?? (() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d
  })()

  const since90d = Date.now() - 90 * 86_400_000

  // Fetch events for the last 90 days (widest window needed)
  const allEvents = await db
    .select()
    .from(analyticsEvents)
    .where(sql`${analyticsEvents.createdAt} >= ${since90d}`)
    .all()

  // Retention
  const retentionReport = computeRetention(
    base,
    allEvents.map((e) => ({
      sessionId: e.sessionId,
      eventName: e.eventName,
      createdAt: e.createdAt,
    }))
  )

  // D90 (not yet in computeRetention — compute inline)
  const d90Events = allEvents.filter((e) => e.eventName === 'app_open')
  const cohortMs = base.getTime()
  const dayMs = 86_400_000
  const cohortSessions = new Set(
    d90Events
      .filter((e) => e.createdAt >= cohortMs && e.createdAt < cohortMs + dayMs)
      .map((e) => e.sessionId)
  )
  const d90Returning = new Set(
    d90Events
      .filter(
        (e) =>
          e.createdAt >= cohortMs + 90 * dayMs &&
          e.createdAt < cohortMs + 91 * dayMs &&
          cohortSessions.has(e.sessionId)
      )
      .map((e) => e.sessionId)
  ).size
  const d90Rate = cohortSessions.size > 0 ? d90Returning / cohortSessions.size : null

  // Experiment summaries
  const expMapped = allEvents.map((e) => ({
    eventName: e.eventName,
    properties: e.properties,
    sessionId: e.sessionId,
  }))
  const experiments = EXPERIMENTS.map((def) => {
    const result = computeExperimentResult(def.key, def.primaryMetric, [...def.variants], expMapped)
    return {
      key: def.key,
      name: def.name,
      status: result.status,
      totalImpressions: result.totalImpressions,
      winner: result.winner,
    }
  })

  // Funnel summaries
  const funnelMapped = allEvents.map((e) => ({ eventName: e.eventName, sessionId: e.sessionId }))
  const funnels = FUNNELS.map((def) => {
    const result = computeFunnel(def, funnelMapped)
    let worstDropOffStep = ''
    let worstDropOffRate = 0
    for (const step of result.steps) {
      if (step.dropOffRate > worstDropOffRate) {
        worstDropOffRate = step.dropOffRate
        worstDropOffStep = step.name
      }
    }
    return {
      key: def.key,
      label: def.label,
      overallConversion: result.overallConversion,
      totalEntered: result.totalEntered,
      worstDropOffStep,
      worstDropOffRate,
    }
  })

  // Segments
  const segReport = computePlayerSegments(base)

  return {
    generatedAt: new Date().toISOString(),
    retention: {
      d1: retentionReport.d1.actual,
      d7: retentionReport.d7.actual,
      d30: retentionReport.d30.actual,
      d90: d90Rate,
      d1Target: 0.45,
      d7Target: 0.20,
      d30Target: 0.10,
      d90Target: 0.05,
      cohortDate: retentionReport.cohortDate,
    },
    experiments,
    funnels,
    segments: {
      masteryFreePercent: segReport.masteryFreePercent,
      masteryFreeStatus: segReport.status,
      totalD30Active: segReport.totalD30Active,
    },
  }
}
