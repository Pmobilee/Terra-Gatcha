import { FastifyInstance } from 'fastify'
import { config } from '../config.js'

export interface NotificationPreferences {
  dailyReminder: boolean
  streakAlert: boolean
  seasonAnnouncement: boolean
  weeklyDigest: boolean
  maxPerDay: number  // DD-V2-159: max 1/day default
}

const DEFAULT_PREFS: NotificationPreferences = {
  dailyReminder: true,
  streakAlert: true,
  seasonAnnouncement: true,
  weeklyDigest: false,
  maxPerDay: 1
}

/** In-memory device token store (production: replaces with DB table) */
const tokenStore = new Map<string, {
  userId: string | null
  platform: string
  registeredAt: string
}>()

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  // Register device push token
  app.post('/register', async (req, reply) => {
    const { token, platform } = req.body as {
      token: string
      platform: 'ios' | 'android' | 'web'
    }
    if (!token || !platform) {
      return reply.status(400).send({ error: 'Token and platform required' })
    }

    // Store token (production: persist to database with userId from JWT)
    tokenStore.set(token, {
      userId: null, // production: extract from request.user.id
      platform,
      registeredAt: new Date().toISOString(),
    })

    return reply.send({ registered: true, tokenCount: tokenStore.size })
  })

  // Get notification preferences
  app.get('/preferences', async (_req, reply) => {
    return reply.send({ preferences: DEFAULT_PREFS })
  })

  // Update notification preferences
  app.put('/preferences', async (req, reply) => {
    const prefs = req.body as Partial<NotificationPreferences>
    const merged = {
      ...DEFAULT_PREFS,
      ...prefs,
      maxPerDay: Math.min(prefs.maxPerDay ?? 1, 3),
    }
    return reply.send({ preferences: merged })
  })

  // Unregister device
  app.delete('/unregister', async (req, reply) => {
    const { token } = req.body as { token: string }
    if (!token) return reply.status(400).send({ error: 'Token required' })
    tokenStore.delete(token)
    return reply.send({ unregistered: true })
  })

  // POST /send-test — admin-only test push dispatch
  app.post('/send-test', async (req, reply) => {
    const adminKey = req.headers['x-admin-key'] as string
    if (adminKey !== config.adminApiKey) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const { token, title, body } = req.body as {
      token: string
      title: string
      body: string
    }

    if (!token) {
      return reply.status(400).send({ error: 'token required' })
    }

    const { sendPush } = await import('../services/pushService.js')
    const valid = await sendPush(token, { title, body })
    return reply.send({ sent: valid, tokenValid: valid })
  })
}
