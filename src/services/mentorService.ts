/**
 * Client-side mentor hint service.
 * Omniscient players can author hint cards for facts they struggled with.
 * Hints are surfaced to newer players who have failed the same fact 3+ times.
 * DD-V2-051: mentor mode.
 */

export interface MentorHint {
  id: string
  factId: string
  /** Anonymized on read (server strips to 'anonymous') */
  authorId: string
  /** Max 200 chars, sanitized */
  hintText: string
  upvotes: number
  createdAt: number
  status: 'pending' | 'approved' | 'rejected'
}

/**
 * Fetch the top-rated approved hint for a fact.
 * Returns null if none exist or the network is unavailable.
 *
 * @param factId - The fact ID to look up hints for.
 */
export async function fetchHintForFact(factId: string): Promise<MentorHint | null> {
  try {
    const res = await fetch(`/api/mentor-hints/${encodeURIComponent(factId)}`)
    if (!res.ok) return null
    const data = await res.json() as { hint?: MentorHint }
    return data.hint ?? null
  } catch {
    return null
  }
}

/**
 * Submit a new hint card. Only callable when player is omniscient.
 * The server validates authorship and sanitizes hintText.
 * Client-side truncates to 200 chars before sending.
 *
 * @param factId - The fact this hint describes.
 * @param hintText - The mnemonic text (max 200 chars).
 */
export async function submitHint(
  factId: string,
  hintText: string,
): Promise<{ success: boolean; hintId?: string }> {
  const trimmed = hintText.trim().slice(0, 200)
  if (!trimmed) return { success: false }
  try {
    const res = await fetch('/api/mentor-hints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factId, hintText: trimmed }),
    })
    if (!res.ok) return { success: false }
    return await res.json() as { success: boolean; hintId?: string }
  } catch {
    return { success: false }
  }
}

/**
 * Vote on a hint (upvote only). Duplicate votes are rejected by the server (409).
 * Network failures are swallowed silently (offline-safe).
 *
 * @param hintId - The hint to vote on.
 * @param vote - Vote direction (currently only 'up' is supported).
 */
export async function voteOnHint(hintId: string, vote: 'up'): Promise<void> {
  try {
    await fetch(`/api/mentor-hints/${hintId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote }),
    })
  } catch { /* offline — silent fail */ }
}
