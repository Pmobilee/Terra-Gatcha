import { FastifyInstance } from 'fastify'
import path from 'path'
import { existsSync, createReadStream } from 'fs'
import { config } from '../config.js'

/**
 * Audio routes for vocabulary pronunciation (DD-V2-094).
 * Streams pre-generated TTS audio files and provides admin generation endpoint.
 */
export async function audioRoutes(app: FastifyInstance): Promise<void> {
  /** GET /:factId — stream pronunciation audio file */
  app.get('/:factId', async (req, reply) => {
    const { factId } = req.params as { factId: string }

    // Sanitize factId — must match pattern: alphanumeric, hyphens, underscores only
    if (!/^[a-zA-Z0-9_-]+$/.test(factId)) {
      return reply.status(400).send({ error: 'Invalid factId format' })
    }

    const filePath = path.join(process.cwd(), 'data', 'audio', `${factId}_recognition.mp3`)

    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: 'Audio not found' })
    }

    reply.header('Content-Type', 'audio/mpeg')
    reply.header('Cache-Control', 'public, max-age=31536000, immutable') // 1 year CDN cache
    return reply.send(createReadStream(filePath))
  })

  /** POST /generate — admin-only on-demand TTS generation (DD-V2-094) */
  app.post('/generate', async (req, reply) => {
    const adminKey = req.headers['x-admin-key'] as string
    if (adminKey !== config.adminApiKey) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const { factId, language, text } = req.body as {
      factId: string
      language: string
      text: string
    }

    if (!factId || !language || !text) {
      return reply.status(400).send({ error: 'factId, language, text required' })
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(factId)) {
      return reply.status(400).send({ error: 'Invalid factId format' })
    }

    const outputPath = `${process.cwd()}/data/audio/${factId}_recognition.mp3`
    const { generatePronunciationAudio } = await import('../services/ttsService.js')
    const result = await generatePronunciationAudio(factId, language, text, outputPath)

    if (!result.success) {
      return reply.status(500).send({ error: result.error })
    }

    return reply.send({ generated: true, outputPath: result.outputPath })
  })
}
