/**
 * Weekly report cron job.
 * Runs every Monday at 08:00 UTC.
 * Queries all player accounts where weeklyReportEnabled === true and parentEmail is set.
 * For production: replace stub player list with a PostgreSQL query.
 */

import { FastifyInstance } from 'fastify'

const MONDAY_CRON = '0 8 * * 1' // Every Monday at 08:00 UTC

/**
 * Registers the weekly report cron job with the Fastify server.
 * Uses node-cron (already a project dependency via notification scheduler).
 */
export async function registerWeeklyReportJob(app: FastifyInstance): Promise<void> {
  // Dynamically import node-cron to avoid hard compile-time dependency.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cron: any
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    cron = await import('node-cron' as string)
  } catch {
    app.log.warn('node-cron not available — weekly report job not scheduled')
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  cron.schedule(MONDAY_CRON, async () => {
    const weekStartIso = getMondayIso()
    app.log.info({ weekStartIso }, 'Running weekly learning report job')

    // Production: query DB for players with weeklyReportEnabled + parentEmail set
    const players: Array<{ playerId: string; parentEmail: string }> = []

    for (const { playerId, parentEmail } of players) {
      try {
        await app.inject({
          method: 'POST',
          url: `/parental/${playerId}/send-weekly-report`,
          payload: { parentEmail, weekStartIso },
        })
      } catch (err) {
        app.log.error({ playerId, err }, 'Failed to send weekly report')
      }
    }

    app.log.info({ count: players.length }, 'Weekly report job complete')
  })

  app.log.info('Weekly report cron job registered (Mondays 08:00 UTC)')
}

/**
 * Returns the ISO date string (YYYY-MM-DD) of the most recent Monday (UTC).
 */
export function getMondayIso(): string {
  const now = new Date()
  const day = now.getUTCDay()
  const daysToMonday = day === 0 ? 6 : day - 1
  now.setUTCDate(now.getUTCDate() - daysToMonday)
  return now.toISOString().slice(0, 10)
}
