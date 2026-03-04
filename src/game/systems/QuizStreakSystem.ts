/**
 * Tracks the current in-dive quiz answer streak and computes reward multipliers.
 * Integrates with QuizManager answer callbacks. (DD-V2-021, Phase 35.2)
 */
export class QuizStreakSystem {
  private streak = 0
  private readonly THRESHOLDS = [0, 3, 6, 10] as const  // answers needed for ×1, ×1.5, ×2, ×3
  private readonly MULTIPLIERS = [1, 1.5, 2, 3] as const

  /**
   * Call after every correct in-mine quiz answer.
   * @returns The current reward multiplier after incrementing.
   */
  onCorrect(): number {
    this.streak++
    return this.getMultiplier()
  }

  /**
   * Call after every wrong in-mine quiz answer.
   * @returns 1 (multiplier reset to base).
   */
  onWrong(): number {
    this.streak = 0
    return 1
  }

  /**
   * Returns the current reward multiplier based on the streak count.
   */
  getMultiplier(): number {
    for (let i = this.THRESHOLDS.length - 1; i >= 0; i--) {
      if (this.streak >= this.THRESHOLDS[i]) return this.MULTIPLIERS[i]
    }
    return 1
  }

  /**
   * Returns the current consecutive correct answer count.
   */
  getStreak(): number { return this.streak }

  /**
   * Reset the streak counter. Call on layer change or dive end.
   */
  reset(): void { this.streak = 0 }
}
