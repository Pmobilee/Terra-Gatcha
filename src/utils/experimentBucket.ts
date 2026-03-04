/**
 * Deterministic variant assignment (Phase 41.2).
 * Uses djb2 hash of (sessionId + experimentKey) to pick a variant index.
 * Pure function — no side effects, safe to call in tests.
 */

/**
 * Assign a variant deterministically for a given session and experiment.
 * The same (sessionId, experimentKey) pair always returns the same variant.
 *
 * @param sessionId     - The current session identifier (stable per device).
 * @param experimentKey - The experiment's unique key string.
 * @param variants      - Array of variant labels; first is always the control.
 * @returns The assigned variant label string.
 */
export function assignVariant(sessionId: string, experimentKey: string, variants: string[]): string {
  const seed = `${sessionId}:${experimentKey}`
  let hash = 5381
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash) ^ seed.charCodeAt(i)
    hash = hash >>> 0 // keep uint32
  }
  return variants[hash % variants.length] ?? variants[0]!
}
