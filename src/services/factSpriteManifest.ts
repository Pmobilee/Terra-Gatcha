/**
 * Fact sprite availability manifest.
 * Fetches the list of approved fact IDs once per session, caches in memory.
 * FactArtwork.svelte checks this before attempting to render a sprite.
 *
 * The manifest is at /assets/fact-sprite-manifest.json, emitted by:
 *   node scripts/audit-fact-sprites.mjs --emit-manifest
 */

let manifestCache: Set<string> | null = null
let fetchPromise: Promise<Set<string>> | null = null

/**
 * Returns the set of fact IDs that have an approved 64×64 sprite.
 * Resolves immediately on subsequent calls (in-memory cache).
 */
export async function getFactSpriteManifest(): Promise<Set<string>> {
  if (manifestCache) return manifestCache
  if (fetchPromise)  return fetchPromise

  fetchPromise = fetch('/assets/fact-sprite-manifest.json')
    .then(r => (r.ok ? r.json() : []) as Promise<string[]>)
    .then((ids: string[]) => {
      manifestCache = new Set(ids)
      return manifestCache
    })
    .catch(() => {
      // Manifest not yet generated — return empty set; FactArtwork shows placeholders.
      manifestCache = new Set()
      return manifestCache
    })

  return fetchPromise
}

/** Synchronous availability check after manifest is loaded. */
export function hasSpriteSync(factId: string): boolean {
  return manifestCache?.has(factId) ?? false
}

/** Invalidate the in-memory cache (e.g., after a background sync). */
export function invalidateManifestCache(): void {
  manifestCache = null
  fetchPromise  = null
}
