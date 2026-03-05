/**
 * Mentor Hints routes — Phase 48.3.
 * Allows omniscient players to author hint cards for facts they struggled with.
 * Hints go through a moderation queue before being surfaced to other players.
 * DD-V2-051: mentor mode.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

const MAX_HINT_LENGTH = 200

interface MentorHintRow {
  id: string
  fact_id: string
  author_id: string
  hint_text: string
  upvotes: number
  created_at: number
  status: 'pending' | 'approved' | 'rejected'
}

/**
 * Registers mentor hints routes on the Fastify instance.
 * Routes are prefixed with /api/mentor-hints.
 */
export async function mentorHintsRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  const db = (fastify as any).db as any

  /**
   * GET /api/mentor-hints/:factId
   * Returns the single highest-upvote approved hint for a fact, or 404.
   * Author ID is stripped from the response (anonymized).
   */
  fastify.get<{ Params: { factId: string } }>(
    '/:factId',
    async (request: FastifyRequest<{ Params: { factId: string } }>, reply: FastifyReply) => {
      const { factId } = request.params

      if (!db) {
        // No DB available — return 404 gracefully
        return reply.status(404).send({ hint: null })
      }

      try {
        const hint: MentorHintRow | undefined = db.prepare(
          `SELECT id, fact_id, hint_text, upvotes, created_at, status
           FROM mentor_hints
           WHERE fact_id = ? AND status = 'approved'
           ORDER BY upvotes DESC
           LIMIT 1`
        ).get(factId) as MentorHintRow | undefined

        if (!hint) {
          return reply.status(404).send({ hint: null })
        }

        // Strip author_id from response
        return reply.send({
          hint: {
            id: hint.id,
            factId: hint.fact_id,
            authorId: 'anonymous',
            hintText: hint.hint_text,
            upvotes: hint.upvotes,
            createdAt: hint.created_at,
            status: hint.status,
          },
        })
      } catch {
        return reply.status(404).send({ hint: null })
      }
    },
  )

  /**
   * POST /api/mentor-hints
   * Submit a new hint card. Requires valid JWT.
   * Validates hintText length (<= 200 chars). Strips HTML. Inserts with status: 'pending'.
   */
  fastify.post<{ Body: { factId: string; hintText: string } }>(
    '/',
    async (request: FastifyRequest<{ Body: { factId: string; hintText: string } }>, reply: FastifyReply) => {
      const { factId, hintText } = request.body ?? {}

      if (!factId || typeof factId !== 'string') {
        return reply.status(400).send({ error: 'factId is required' })
      }
      if (!hintText || typeof hintText !== 'string') {
        return reply.status(400).send({ error: 'hintText is required' })
      }
      if (hintText.length > MAX_HINT_LENGTH) {
        return reply.status(400).send({ error: `hintText must be <= ${MAX_HINT_LENGTH} characters` })
      }

      // Strip HTML tags (basic sanitization)
      const sanitized = hintText
        .replace(/<[^>]*>/g, '')
        .trim()
        .slice(0, MAX_HINT_LENGTH)

      if (!sanitized) {
        return reply.status(400).send({ error: 'hintText is empty after sanitization' })
      }

      // Get authenticated player ID from JWT payload (set by auth middleware)
      const authorId: string = (request as any).user?.playerId ?? 'guest'

      // Generate a simple unique ID
      const hintId = `hint_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

      if (!db) {
        // No DB — simulate success for dev/testing
        return reply.send({ success: true, hintId })
      }

      try {
        db.prepare(
          `INSERT INTO mentor_hints (id, fact_id, author_id, hint_text, upvotes, created_at, status)
           VALUES (?, ?, ?, ?, 0, ?, 'pending')`
        ).run(hintId, factId, authorId, sanitized, Date.now())

        return reply.send({ success: true, hintId })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return reply.status(500).send({ success: false, error: msg })
      }
    },
  )

  /**
   * POST /api/mentor-hints/:id/vote
   * Upvote a hint. Prevents double-vote via mentor_hint_votes table (returns 409 on duplicate).
   * Awards 1 prestige point to the author.
   */
  fastify.post<{ Params: { id: string }; Body: { vote: 'up' } }>(
    '/:id/vote',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { vote: 'up' } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params
      const { vote } = request.body ?? {}

      if (vote !== 'up') {
        return reply.status(400).send({ error: 'Only upvotes are supported' })
      }

      const voterId: string = (request as any).user?.playerId ?? 'guest'

      if (!db) {
        return reply.send({ success: true })
      }

      try {
        // Check for duplicate vote
        const existing = db.prepare(
          `SELECT 1 FROM mentor_hint_votes WHERE hint_id = ? AND player_id = ?`
        ).get(id, voterId)

        if (existing) {
          return reply.status(409).send({ error: 'Already voted on this hint' })
        }

        // Record vote
        db.prepare(
          `INSERT INTO mentor_hint_votes (hint_id, player_id, voted_at) VALUES (?, ?, ?)`
        ).run(id, voterId, Date.now())

        // Increment upvote count
        db.prepare(
          `UPDATE mentor_hints SET upvotes = upvotes + 1 WHERE id = ?`
        ).run(id)

        // Award 1 prestige point to the original author
        const hint: { author_id: string } | undefined = db.prepare(
          `SELECT author_id FROM mentor_hints WHERE id = ?`
        ).get(id) as { author_id: string } | undefined

        if (hint?.author_id) {
          db.prepare(
            `UPDATE players SET mentor_prestige_points = COALESCE(mentor_prestige_points, 0) + 1 WHERE id = ?`
          ).run(hint.author_id)
        }

        return reply.send({ success: true })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return reply.status(500).send({ success: false, error: msg })
      }
    },
  )
}
