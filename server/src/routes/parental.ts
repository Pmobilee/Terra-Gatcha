import { FastifyInstance } from 'fastify'

/**
 * Parental control routes.
 * Weekly summary email, time limit sync, content filtering, COPPA consent.
 */
export async function parentalRoutes(app: FastifyInstance): Promise<void> {
  // Get parental settings for a player
  app.get('/:playerId/settings', async (req, reply) => {
    const { playerId } = req.params as { playerId: string }
    return reply.send({
      playerId,
      kidMode: false,
      maxDailyMinutes: 60,
      socialEnabled: false,
      weeklyReportEnabled: false
    })
  })

  // Update parental settings
  app.put('/:playerId/settings', async (req, reply) => {
    const { playerId } = req.params as { playerId: string }
    const settings = req.body as Record<string, unknown>
    return reply.send({ playerId, updated: true, settings })
  })

  // Get weekly learning summary (for parent email)
  app.get('/:playerId/weekly-summary', async (req, reply) => {
    const { playerId } = req.params as { playerId: string }
    const { buildWeeklyReport } = await import('../services/weeklyReport.js')
    const weekStartIso = new Date().toISOString().slice(0, 10)
    const report = buildWeeklyReport(playerId, weekStartIso)
    return reply.send({
      playerId,
      period: { start: report.weekStartIso, end: report.weekEndIso },
      totalPlayMinutes: report.totalPlayMinutes,
      factsLearned: report.factsLearned,
      factsMastered: report.factsMastered,
      streakDays: report.streakDays,
      topCategories: report.topCategories,
      socialInteractions: 0
    })
  })

  // Send weekly learning report email (called by cron job or admin trigger)
  app.post('/:playerId/send-weekly-report', async (req, reply) => {
    const { playerId } = req.params as { playerId: string }
    const { parentEmail, weekStartIso } = req.body as { parentEmail: string; weekStartIso: string }

    if (!parentEmail || !parentEmail.includes('@')) {
      return reply.status(400).send({ error: 'Valid parentEmail required' })
    }
    if (!weekStartIso || !/^\d{4}-\d{2}-\d{2}$/.test(weekStartIso)) {
      return reply.status(400).send({ error: 'weekStartIso in YYYY-MM-DD format required' })
    }

    const { buildWeeklyReport, formatReportPlainText } = await import('../services/weeklyReport.js')
    const report = buildWeeklyReport(playerId, weekStartIso)
    const plainText = formatReportPlainText(report)

    // In production: await emailService.send({ to: parentEmail, subject, html, text: plainText })
    app.log.info({ playerId, parentEmail, weekStartIso, plainTextLength: plainText.length }, 'Weekly report queued')
    return reply.send({ queued: true, playerId, reportSummary: { factsLearned: report.factsLearned } })
  })

  // Request parental consent — sends verification email to parent address
  app.post('/consent-request', async (req, reply) => {
    const { playerId, parentEmail } = req.body as { playerId: string; parentEmail: string }
    if (!parentEmail?.includes('@')) return reply.status(400).send({ error: 'Valid parentEmail required' })
    // In production: generate a signed token, store pending consent, send email
    app.log.info({ playerId, parentEmail }, 'Parental consent request received')
    return reply.send({ sent: true, playerId })
  })

  // Verify parental consent (called when parent clicks link)
  app.get('/consent-verify', async (req, reply) => {
    const { token } = req.query as { token: string }
    if (!token) return reply.status(400).send({ error: 'token required' })
    // In production: validate token, mark account consent:granted in DB
    app.log.info({ token }, 'Parental consent verification attempt')
    return reply.send({ verified: true })
  })

  // Parent-initiated complete data deletion for a child account
  app.delete('/:playerId/data', async (req, reply) => {
    const { playerId } = req.params as { playerId: string }
    const { parentPinHash } = req.body as { parentPinHash: string }

    if (!parentPinHash) return reply.status(400).send({ error: 'parentPinHash required for verification' })
    // In production: verify parentPinHash matches stored hash, then delete all player rows from DB,
    // purge analytics events, send confirmation email to parent
    app.log.info({ playerId }, 'Parent-initiated data deletion request')
    return reply.send({ deleted: true, playerId })
  })
}
