/**
 * FCM HTTP v1 push notification service.
 * Covers both Android (FCM native) and iOS (APNs via FCM).
 * Uses only Node.js built-in crypto and fetch — no external npm SDK.
 * DD-V2-159: Push auto-stop after 7 consecutive days of silence.
 */

import { config } from '../config.js'
import { createSign } from 'crypto'

const FCM_URL = `https://fcm.googleapis.com/v1/projects/${config.fcmProjectId}/messages:send`

/** Cached short-lived OAuth2 token with expiry tracking */
let cachedToken: { token: string; expiresAt: number } | null = null

/**
 * Build a minimal RS256 JWT service-account grant and exchange it for an
 * FCM OAuth2 access token. Caches the result until 60 seconds before expiry.
 *
 * @returns A valid FCM access token string.
 */
async function getFCMToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token
  }

  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' })
  ).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({
      iss: config.fcmClientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })
  ).toString('base64url')

  const sign = createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const signature = sign.sign(
    config.fcmPrivateKey.replace(/\\n/g, '\n'),
    'base64url'
  )

  const jwt = `${header}.${payload}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!res.ok) throw new Error(`FCM token error: ${res.status}`)

  const data = (await res.json()) as {
    access_token: string
    expires_in: number
  }
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return cachedToken.token
}

export interface PushPayload {
  title: string
  body: string
  data?: Record<string, string>
}

/**
 * Send a push notification to one device token via FCM HTTP v1.
 * Returns true on success. Returns false if the token is no longer valid
 * (caller should remove it from the database).
 * In dev mode (no FCM_PROJECT_ID / FCM_PRIVATE_KEY), logs to console and returns true.
 *
 * @param deviceToken - The FCM/APNs device registration token.
 * @param payload - Notification title, body, and optional data map.
 * @returns True if the notification was accepted; false if the token is invalid.
 */
export async function sendPush(
  deviceToken: string,
  payload: PushPayload
): Promise<boolean> {
  if (!config.fcmProjectId || !config.fcmPrivateKey) {
    console.log(
      `[Push] DEV — "${payload.title}" → ...${deviceToken.slice(-8)}`
    )
    return true
  }

  const accessToken = await getFCMToken()

  const res = await fetch(FCM_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        android: { priority: 'normal' },
        apns: { headers: { 'apns-priority': '5' } },
      },
    }),
  })

  if (res.status === 404 || res.status === 410) return false // Token unregistered
  if (!res.ok) throw new Error(`FCM send error ${res.status}: ${await res.text()}`)
  return true
}

/**
 * Send a push to multiple tokens. Returns an array of invalid tokens that
 * should be removed from the database.
 *
 * @param tokens - Array of FCM/APNs device registration tokens.
 * @param payload - Notification content.
 * @returns Object containing tokens that are no longer valid.
 */
export async function sendPushBatch(
  tokens: string[],
  payload: PushPayload
): Promise<{ invalidTokens: string[] }> {
  const invalidTokens: string[] = []
  for (const token of tokens) {
    const valid = await sendPush(token, payload)
    if (!valid) invalidTokens.push(token)
  }
  return { invalidTokens }
}
