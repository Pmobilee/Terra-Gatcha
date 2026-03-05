/**
 * Challenge mode service — session-scoped streak tracking and prestige point awards.
 * DD-V2-052: post-mastery challenge mode.
 */
import { get } from 'svelte/store'
import { playerSave, persistPlayer } from '../ui/stores/playerData'
import { BALANCE } from '../data/balance'
import type { ReviewState } from '../data/types'
import { analyticsService } from './analyticsService'

/** Available challenge quiz modes. */
export type ChallengeMode = 'speed' | 'no_hint' | 'reverse'

/**
 * Session-scoped challenge mode service.
 * Tracks consecutive correct answers and awards prestige points at milestones.
 */
class ChallengeService {
  private _streak = 0
  private _sessionPoints = 0

  /** Current challenge streak (consecutive correct answers across all modes). */
  get streak(): number {
    return this._streak
  }

  /**
   * Called on a correct challenge answer.
   * Increments streak, checks for milestone, awards prestige points.
   *
   * @param mode - The challenge mode that was just answered correctly.
   * @returns Prestige points awarded at a milestone (0 if no milestone hit).
   */
  onCorrect(mode: ChallengeMode): number {
    this._streak++
    const milestones = BALANCE.CHALLENGE_STREAK_MILESTONES as readonly number[]
    const milestone = milestones.find(m => m === this._streak)

    analyticsService.track({
      name: 'challenge_mode_result',
      properties: { mode, correct: true, streak: this._streak },
    })

    if (milestone !== undefined) {
      const points = (BALANCE.CHALLENGE_STREAK_PRESTIGE_POINTS as Record<number, number>)[milestone] ?? 0
      this._sessionPoints += points
      this._awardPrestigePoints(points)
      return points
    }
    return 0
  }

  /**
   * Called on a wrong or timed-out challenge answer.
   * Resets streak to 0.
   *
   * @param mode - The challenge mode that was just failed.
   */
  onWrong(mode: ChallengeMode): void {
    analyticsService.track({
      name: 'challenge_mode_result',
      properties: { mode, correct: false, streak: this._streak },
    })
    this._streak = 0
  }

  /**
   * Selects the hardest mastered fact for a ChallengeGate (lowest easeFactor, interval >= 30).
   * Returns null if no mastered facts are available.
   *
   * @param reviewStates - The player's full review state array.
   */
  selectHardestMasteredFact(reviewStates: ReviewState[]): ReviewState | null {
    const mastered = reviewStates.filter(rs => rs.interval >= 30)
    if (mastered.length === 0) return null
    return mastered.reduce((a, b) => a.easeFactor < b.easeFactor ? a : b)
  }

  /** Reset streak to 0 (e.g., on dive end or session boundary). */
  resetStreak(): void {
    this._streak = 0
    this._sessionPoints = 0
  }

  private _awardPrestigePoints(points: number): void {
    const save = get(playerSave)
    if (!save) return
    playerSave.set({
      ...save,
      mentorPrestigePoints: (save.mentorPrestigePoints ?? 0) + points,
    })
    persistPlayer()
  }
}

export const challengeService = new ChallengeService()
