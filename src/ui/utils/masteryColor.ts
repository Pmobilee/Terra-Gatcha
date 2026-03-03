import type { ReviewState } from '../../data/types'
import { SM2_MASTERY_INTERVAL_GENERAL, SM2_MASTERY_INTERVAL_VOCAB } from '../../data/balance'

/**
 * Returns a CSS color string for the given fact's learning stage.
 *
 * - Grayscale (#888888): unseen or very early (repetitions < 2)
 * - Orange/autumn (#e07820): actively learning (repetitions >= 2, interval below mastery threshold)
 * - Green (#44bb44): mastered (interval >= mastery threshold)
 *
 * (DD-V2-099)
 *
 * @param state - The SM-2 review state for the fact, or null/undefined if never reviewed.
 * @param factType - Category of the fact; determines mastery interval threshold.
 * @returns CSS color hex string representing the learning stage.
 */
export function getMasteryColor(
  state: ReviewState | null | undefined,
  factType: string = 'fact',
): string {
  if (!state || state.repetitions < 2) return '#888888'  // grayscale — unseen/early

  const threshold =
    factType === 'vocabulary' || factType === 'grammar' || factType === 'phrase'
      ? SM2_MASTERY_INTERVAL_VOCAB
      : SM2_MASTERY_INTERVAL_GENERAL

  if (state.interval >= threshold) return '#44bb44'  // green — mastered
  return '#e07820'                                    // orange/autumn — learning
}
