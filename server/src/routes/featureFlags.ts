/**
 * Feature flag API routes (Phase 41.1).
 * GET  /api/flags          — resolve all flags for the authenticated user
 * GET  /api/flags/:key     — resolve a single flag
 * POST /api/admin/flags    — upsert a flag definition (admin only)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { resolveFlag, resolveAllFlags, upsertFlag } from '../services/featureFlagService.js'
import { config } from '../config.js'

/**
 * Register feature flag routes on the Fastify instance.
 *
 * @param fastify - The Fastify application instance.
 */
export async function featureFlagRoutes(fastify: FastifyInstance): Promise<void> {
  /** GET /api/flags — returns all flags for the authenticated user. */
  fastify.get('/flags', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '')
      if (!token) return reply.status(401).send({ error: 'Unauthorized' })
      const payload = fastify.jwt.verify<{ sub: string }>(token)
      const flags = await resolveAllFlags(payload.sub)
      return reply.send({ flags })
    } catch {
      return reply.status(401).send({ error: 'Invalid token' })
    }
  })

  /** GET /api/flags/:key — resolve a single flag for the authenticated user. */
  fastify.get(
    '/flags/:key',
    async (request: FastifyRequest<{ Params: { key: string } }>, reply: FastifyReply) => {
      try {
        const token = request.headers.authorization?.replace('Bearer ', '')
        if (!token) return reply.status(401).send({ error: 'Unauthorized' })
        const payload = fastify.jwt.verify<{ sub: string }>(token)
        const resolution = await resolveFlag(request.params.key, payload.sub)
        return reply.send(resolution)
      } catch {
        return reply.status(401).send({ error: 'Invalid token' })
      }
    }
  )

  /** POST /api/admin/flags — upsert a flag (X-Admin-Key required). */
  fastify.post(
    '/admin/flags',
    async (
      request: FastifyRequest<{
        Body: { key: string; description: string; enabled: boolean; rolloutPct: number }
      }>,
      reply: FastifyReply
    ) => {
      if (request.headers['x-admin-key'] !== config.adminApiKey) {
        return reply.status(403).send({ error: 'Forbidden' })
      }
      const { key, description, enabled, rolloutPct } = (request.body ?? {}) as {
        key?: string
        description?: string
        enabled?: boolean
        rolloutPct?: number
      }
      if (!key || typeof rolloutPct !== 'number' || rolloutPct < 0 || rolloutPct > 100) {
        return reply.status(400).send({ error: 'key and rolloutPct (0–100) are required' })
      }
      await upsertFlag(key, description ?? '', enabled ?? false, rolloutPct)
      return reply.send({ ok: true })
    }
  )
}
