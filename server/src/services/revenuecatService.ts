/**
 * RevenueCat REST API client and webhook verification.
 * DD-V2-140: RevenueCat is the single source of truth for IAP receipts.
 * DD-V2-145: Server validates RevenueCat webhook signature.
 */

import { config } from '../config.js'
import type { RCSubscriberResponse } from '../types/revenuecat.js'

const RC_BASE = 'https://api.revenuecat.com/v1'

/**
 * Fetch subscriber info from RevenueCat REST API.
 * Called after a client purchase to verify the transaction.
 *
 * @param appUserId - The RevenueCat app user ID (typically the server user UUID).
 * @returns Full subscriber object including subscriptions and entitlements.
 */
export async function getSubscriber(
  appUserId: string
): Promise<RCSubscriberResponse> {
  const res = await fetch(
    `${RC_BASE}/subscribers/${encodeURIComponent(appUserId)}`,
    {
      headers: {
        Authorization: `Bearer ${config.revenuecatApiKey}`,
      },
    }
  )
  if (!res.ok) {
    throw new Error(
      `RevenueCat API error: ${res.status} ${await res.text()}`
    )
  }
  return res.json() as Promise<RCSubscriberResponse>
}

/**
 * Verify a RevenueCat S2S webhook request by comparing the Authorization
 * header to the shared webhook secret (DD-V2-145).
 * Returns true if the request is authentic.
 *
 * @param authHeader - The Authorization header value from the request.
 * @returns True if the header matches the configured webhook secret.
 */
export function verifyWebhookSecret(
  authHeader: string | undefined
): boolean {
  if (!authHeader) return false
  if (!config.revenuecatWebhookSecret) return false
  return authHeader === config.revenuecatWebhookSecret
}

/**
 * Map a RevenueCat product ID to our internal subscription tier name.
 *
 * @param productId - The RevenueCat product identifier string.
 * @returns The internal tier name, or null if not recognised.
 */
export function productIdToTier(productId: string): string | null {
  const MAP: Record<string, string> = {
    'com.terragacha.terrapass.monthly': 'terra_pass',
    'com.terragacha.patron.season':     'expedition_patron',
    'com.terragacha.patron.annual':     'grand_patron',
  }
  return MAP[productId] ?? null
}
