/**
 * Feature flag service (Phase 41.1).
 * Resolves flag values per-user with rollout-percentage bucketing.
 *
 * Bucketing algorithm: SHA-256(userId + flagKey) → first 4 bytes as uint32 →
 * modulo 100 → compare against rolloutPct.  This is stable across server
 * restarts and never changes for a given user/flag pair.
 */

import * as crypto from 'crypto'
import { db } from '../db/index.js'
import { featureFlags, featureFlagOverrides } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'

export interface FlagResolution {
  key: string
  enabled: boolean
  source: 'override' | 'rollout' | 'disabled'
}

/**
 * Resolve a single feature flag for a specific user.
 * Returns false immediately if the flag does not exist in the database.
 *
 * @param flagKey - The flag's unique key string.
 * @param userId  - The authenticated user's UUID.
 */
export async function resolveFlag(flagKey: string, userId: string): Promise<FlagResolution> {
  // 1. Check for an explicit user override
  const override = await db
    .select()
    .from(featureFlagOverrides)
    .where(and(eq(featureFlagOverrides.flagKey, flagKey), eq(featureFlagOverrides.userId, userId)))
    .get()

  if (override) {
    return { key: flagKey, enabled: override.value === 1, source: 'override' }
  }

  // 2. Look up the flag definition
  const flag = await db.select().from(featureFlags).where(eq(featureFlags.key, flagKey)).get()

  if (!flag || !flag.enabled) {
    return { key: flagKey, enabled: false, source: 'disabled' }
  }

  // 3. Apply rollout percentage via stable hash bucketing
  const bucket = stableBucket(userId, flagKey)
  const inRollout = bucket < flag.rolloutPct

  return { key: flagKey, enabled: inRollout, source: 'rollout' }
}

/**
 * Resolve all flags for a user in one pass (used by the client SDK bootstrap
 * endpoint so the client receives all flag values in a single request on login).
 *
 * @param userId - The authenticated user's UUID.
 * @returns Map of flagKey → boolean
 */
export async function resolveAllFlags(userId: string): Promise<Record<string, boolean>> {
  const flags = await db.select().from(featureFlags).all()
  const overrides = await db
    .select()
    .from(featureFlagOverrides)
    .where(eq(featureFlagOverrides.userId, userId))
    .all()

  const overrideMap = new Map(overrides.map((o) => [o.flagKey, o.value === 1]))

  const result: Record<string, boolean> = {}
  for (const flag of flags) {
    if (overrideMap.has(flag.key)) {
      result[flag.key] = overrideMap.get(flag.key)!
    } else if (!flag.enabled) {
      result[flag.key] = false
    } else {
      result[flag.key] = stableBucket(userId, flag.key) < flag.rolloutPct
    }
  }
  return result
}

/**
 * Compute a stable bucket value (0–99) for a (userId, flagKey) pair.
 * Uses the first 4 bytes of SHA-256(userId + "|" + flagKey) as uint32,
 * then modulo 100.
 */
function stableBucket(userId: string, flagKey: string): number {
  const hash = crypto.createHash('sha256').update(`${userId}|${flagKey}`).digest()
  const uint32 = hash.readUInt32BE(0)
  return uint32 % 100
}

/**
 * Admin helper: upsert a flag definition.
 * Idempotent — safe to call on server startup to seed known flags.
 *
 * @param key         - Unique flag key identifier.
 * @param description - Human-readable description of what the flag controls.
 * @param enabled     - Whether the flag is globally enabled.
 * @param rolloutPct  - Rollout percentage 0–100.
 */
export async function upsertFlag(
  key: string,
  description: string,
  enabled: boolean,
  rolloutPct: number
): Promise<void> {
  const now = Date.now()
  await db
    .insert(featureFlags)
    .values({ key, description, enabled: enabled ? 1 : 0, rolloutPct, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: featureFlags.key,
      set: { description, enabled: enabled ? 1 : 0, rolloutPct, updatedAt: now },
    })
}
