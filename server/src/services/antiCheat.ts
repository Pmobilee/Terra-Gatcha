/**
 * Anti-Cheat Service (DD-V2-225)
 *
 * Server-side plausibility checks for save data.
 * Flags anomalous saves for soft review — never auto-bans.
 */

/** Minimum ticks required per block mined (with best pickaxe) */
const MIN_TICKS_PER_BLOCK = 1

/** Maximum reasonable blocks mined per dive */
const MAX_BLOCKS_PER_DIVE = 500

/**
 * Check if save data looks plausible.
 * Runs lightweight heuristics against the player's stats and mineral amounts.
 * Never throws — always returns a result object.
 *
 * @param saveData - The raw save data object submitted by the client.
 * @returns An object containing a `plausible` flag and an array of `flags`.
 */
export function checkSavePlausibility(saveData: Record<string, unknown>): {
  plausible: boolean
  flags: string[]
} {
  const flags: string[] = []
  const stats = saveData.stats as Record<string, number> | undefined

  if (stats) {
    // Check blocks per dive ratio
    if (stats.totalDives > 0 && stats.totalBlocksMined > 0) {
      const blocksPerDive = stats.totalBlocksMined / stats.totalDives
      if (blocksPerDive > MAX_BLOCKS_PER_DIVE) {
        flags.push(`Suspicious blocks/dive ratio: ${blocksPerDive.toFixed(1)}`)
      }
    }

    // Check deepest layer vs total dives
    if (stats.deepestLayerReached > 20) {
      flags.push(`Layer ${stats.deepestLayerReached} exceeds max 20`)
    }

    // Check streak sanity
    if (stats.bestStreak > 365) {
      flags.push(`Streak ${stats.bestStreak} exceeds 365`)
    }
  }

  // Check mineral amounts
  const minerals = saveData.minerals as Record<string, number> | undefined
  if (minerals) {
    for (const [tier, amount] of Object.entries(minerals)) {
      if (amount > 999999) {
        flags.push(`${tier} amount ${amount} suspiciously high`)
      }
    }
  }

  // Suppress the unused variable warning for MIN_TICKS_PER_BLOCK — it will be
  // used in future tick-based validation once the server receives tick logs.
  void MIN_TICKS_PER_BLOCK

  return { plausible: flags.length === 0, flags }
}

/**
 * Log anti-cheat flags for soft review.
 * Never auto-bans; emits a structured warning for manual inspection.
 *
 * @param userId - The user's UUID.
 * @param flags  - Array of flag strings from `checkSavePlausibility`.
 */
export function logAntiCheatFlags(userId: string, flags: string[]): void {
  if (flags.length > 0) {
    console.warn(`[anti-cheat] User ${userId} flagged:`, flags)
  }
}
