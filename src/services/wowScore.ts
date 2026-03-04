/**
 * Kid Wow Score — maps SM-2 review state to a 1–5 star rating shown in Kid Mode.
 * Adults see the raw interval/repetition numbers; kids see stars and an encouraging label.
 *
 * Mapping (DD-V2-180):
 *   1 star  — Just discovered (repetitions === 0)
 *   2 stars — Getting there   (repetitions 1–2)
 *   3 stars — Pretty good     (repetitions 3–4)
 *   4 stars — Awesome         (repetitions 5–6)
 *   5 stars — EXPERT!         (repetitions >= 7 OR interval >= 21 days)
 */

import type { ReviewState } from '../data/types'

export type WowLevel = 1 | 2 | 3 | 4 | 5

export interface WowScore {
  /** 1–5 stars */
  level: WowLevel
  /** Short display label shown beneath the stars */
  label: string
  /** CSS colour class for the star fill — used in KidWowStars.svelte */
  colorClass: 'wow-1' | 'wow-2' | 'wow-3' | 'wow-4' | 'wow-5'
}

const WOW_LABELS: Record<WowLevel, string> = {
  1: 'Just found it!',
  2: 'Getting there!',
  3: 'Pretty good!',
  4: 'Awesome!',
  5: 'EXPERT!',
}

/**
 * Computes the Wow Score for a single review state.
 * Safe to call with undefined (returns level 1 — not yet reviewed).
 */
export function getWowScore(state: ReviewState | undefined): WowScore {
  const reps = state?.repetitions ?? 0
  const interval = state?.interval ?? 0

  let level: WowLevel
  if (reps === 0) {
    level = 1
  } else if (reps <= 2) {
    level = 2
  } else if (reps <= 4) {
    level = 3
  } else if (reps <= 6) {
    level = 4
  } else {
    level = 5
  }

  // Interval fast-track: if spaced repetition has already pushed this out 3+ weeks,
  // the fact is truly mastered regardless of repetition count.
  if (interval >= 21) level = 5

  return {
    level,
    label: WOW_LABELS[level],
    colorClass: `wow-${level}` as WowScore['colorClass'],
  }
}

/**
 * Returns the Wow Score label for a given level, suitable for aria-label strings.
 */
export function wowLevelAriaLabel(level: WowLevel): string {
  return `${level} out of 5 stars — ${WOW_LABELS[level]}`
}
