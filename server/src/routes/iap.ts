/**
 * In-App Purchase verification routes (DD-V2-145).
 * Receipt verification via RevenueCat REST API.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { config } from '../config.js'
import {
  getSubscriber,
  verifyWebhookSecret,
  productIdToTier,
} from '../services/revenuecatService.js'
import type { RCWebhookEvent } from '../types/revenuecat.js'

export async function iapRoutes(fastify: FastifyInstance): Promise<void> {
  /** POST /verify — verify IAP receipt via RevenueCat */
  fastify.post('/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>
    const productId = body?.productId as string
    const appUserId = body?.appUserId as string

    if (!productId || !appUserId) {
      return reply
        .status(400)
        .send({ error: 'missing_fields', message: 'productId and appUserId are required' })
    }

    if (!config.revenuecatApiKey) {
      // Dev/sandbox mode: accept all purchases without hitting RC
      return {
        valid: true,
        productId,
        tier: productIdToTier(productId),
        sandbox: true,
      }
    }

    try {
      const subscriber = await getSubscriber(appUserId)
      const sub = subscriber.subscriber.subscriptions[productId]
      if (!sub) {
        return reply
          .status(404)
          .send({ error: 'no_subscription_found', productId })
      }
      const expiresAt = new Date(sub.expires_date)
      const valid = expiresAt > new Date()
      return {
        valid,
        productId,
        tier: productIdToTier(productId),
        expiresAt: sub.expires_date,
        sandbox: sub.is_sandbox,
      }
    } catch (err) {
      fastify.log.error(err, 'RevenueCat verify error')
      return reply
        .status(502)
        .send({ error: 'upstream_error', message: 'Could not verify with RevenueCat' })
    }
  })

  /** POST /restore — handle restore purchases request */
  fastify.post('/restore', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return {
      restoredProducts: [] as string[],
      message: 'Restore purchases stub — production will query RevenueCat',
    }
  })

  /** POST /webhook — RevenueCat S2S webhook (DD-V2-145) */
  fastify.post('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers['authorization'] as string | undefined
    if (!verifyWebhookSecret(authHeader)) {
      return reply.status(401).send({ error: 'invalid_webhook_secret' })
    }

    const event = (request.body as RCWebhookEvent).event
    const { type, app_user_id, product_id, expiration_at_ms } = event

    fastify.log.info({ type, app_user_id, product_id }, 'RevenueCat webhook received')

    const tier = productIdToTier(product_id)
    const expiresAt = new Date(expiration_at_ms).toISOString()

    if (type === 'INITIAL_PURCHASE' || type === 'RENEWAL') {
      // Production: db.upsertSubscription(app_user_id, { tier, expiresAt })
      fastify.log.info({ app_user_id, tier, expiresAt }, 'Subscription activated/renewed')
    } else if (type === 'CANCELLATION' || type === 'EXPIRATION') {
      // Production: db.expireSubscription(app_user_id)
      fastify.log.info({ app_user_id }, 'Subscription cancelled/expired')
    }

    return reply.status(200).send({ received: true })
  })
}
