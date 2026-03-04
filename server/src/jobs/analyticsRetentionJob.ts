/**
 * Analytics data retention enforcement (Phase 41.7).
 * Purges analytics_events older than RETENTION_DAYS to comply with the data
 * minimisation principle (GDPR Article 5(1)(e)).
 *
 * Target: 90 days of raw events, aggregate summaries retained indefinitely.
 * Run daily via setInterval.
 */

import { db } from '../db/index.js'
import { analyticsEvents } from '../db/schema.js'
import { lt } from 'drizzle-orm'

/** Raw event retention window: 90 days. */
const RETENTION_DAYS = 90
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000

/**
 * Purge analytics events older than 90 days from the database.
 * Safe to run at any time — idempotent.
 *
 * @returns Object with deletedCount for monitoring.
 */
export async function runAnalyticsRetentionJob(): Promise<{ deletedCount: number }> {
  const cutoff = Date.now() - RETENTION_MS

  // Drizzle's delete with a where clause
  const result = await db
    .delete(analyticsEvents)
    .where(lt(analyticsEvents.createdAt, cutoff))
    .run()

  const deletedCount = typeof result?.changes === 'number' ? result.changes : 0
  console.log(`[AnalyticsRetention] Purged ${deletedCount} events older than ${RETENTION_DAYS} days`)

  return { deletedCount }
}
