/**
 * Research partner API key issuance and validation service.
 * Keys are stored as SHA-256 hashes; raw keys are issued once and never stored.
 * DD-V2-191: Academic partnership API.
 */

import * as crypto from 'crypto'

/**
 * A research partner API key record stored in the database.
 * The raw key is issued once and never stored. Only its SHA-256 hash is persisted.
 */
export interface PartnerKeyRecord {
  id: string                // UUID
  institutionName: string
  contactEmail: string      // Stored encrypted or hashed in production
  keyHash: string           // SHA-256(rawKey) in hex
  createdAt: number         // Unix ms
  expiresAt: number         // Unix ms (1 year from creation by default)
  isRevoked: boolean
  requestsThisHour: number  // rolling hourly count
  hourWindowStart: number   // Unix ms when the current window started
}

/** Rate limit: max requests per rolling hour window per key. */
const RATE_LIMIT_PER_HOUR = 100

/** Key validity period in milliseconds (1 year). */
const KEY_TTL_MS = 365 * 24 * 60 * 60 * 1000

// In-memory store for development. Production: replace with DB table query.
const keyStore = new Map<string, PartnerKeyRecord>()

/**
 * Hash a raw API key using SHA-256.
 *
 * @param rawKey - The raw key string (e.g. "tgr_live_abc123...").
 * @returns Lowercase hex SHA-256 digest.
 */
export function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex')
}

/**
 * Generate a new raw research API key and create a PartnerKeyRecord.
 * The caller is responsible for transmitting the raw key securely — it will
 * not be recoverable after this function returns.
 *
 * @param institutionName - Name of the research institution.
 * @param contactEmail    - Contact email for the partner.
 * @returns An object containing the raw key (transmit once) and the persisted record.
 */
export function issuePartnerKey(
  institutionName: string,
  contactEmail: string,
): { rawKey: string; record: PartnerKeyRecord } {
  const rawKey = `tgr_${crypto.randomBytes(24).toString('hex')}`
  const record: PartnerKeyRecord = {
    id:                crypto.randomUUID(),
    institutionName,
    contactEmail,
    keyHash:           hashKey(rawKey),
    createdAt:         Date.now(),
    expiresAt:         Date.now() + KEY_TTL_MS,
    isRevoked:         false,
    requestsThisHour:  0,
    hourWindowStart:   Date.now(),
  }
  keyStore.set(record.keyHash, record)
  return { rawKey, record }
}

/**
 * Validate an incoming research API key header value.
 * Checks: key exists, not revoked, not expired, within rate limit.
 *
 * @param rawKey - Raw key from the X-Research-Api-Key header.
 * @returns { valid: true, record } | { valid: false, reason: string }
 */
export function validatePartnerKey(
  rawKey: string,
): { valid: true; record: PartnerKeyRecord } | { valid: false; reason: string } {
  const hash = hashKey(rawKey)
  const record = keyStore.get(hash)
  if (!record) return { valid: false, reason: 'Unknown API key' }
  if (record.isRevoked) return { valid: false, reason: 'API key has been revoked' }
  if (Date.now() > record.expiresAt) return { valid: false, reason: 'API key has expired' }

  // Rolling hourly rate limit
  const now = Date.now()
  const hourMs = 60 * 60 * 1000
  if (now - record.hourWindowStart >= hourMs) {
    record.requestsThisHour = 0
    record.hourWindowStart = now
  }
  if (record.requestsThisHour >= RATE_LIMIT_PER_HOUR) {
    return { valid: false, reason: 'Rate limit exceeded — 100 requests per hour per key' }
  }
  record.requestsThisHour++

  return { valid: true, record }
}

/**
 * Revoke an API key by ID.
 *
 * @param keyId - UUID of the key record to revoke.
 * @returns True if the key was found and revoked, false if not found.
 */
export function revokePartnerKey(keyId: string): boolean {
  for (const record of keyStore.values()) {
    if (record.id === keyId) {
      record.isRevoked = true
      return true
    }
  }
  return false
}

/**
 * List all partner key records (for admin dashboard).
 * Returns records with keyHash excluded and contactEmail preserved for display.
 *
 * @returns Array of partner key records without the keyHash field.
 */
export function listPartnerKeys(): Omit<PartnerKeyRecord, 'keyHash'>[] {
  return Array.from(keyStore.values()).map(({ keyHash: _kh, ...rest }) => rest)
}
