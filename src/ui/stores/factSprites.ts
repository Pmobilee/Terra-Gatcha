/**
 * Fact sprite mastery store.
 * Computes the mastery visual stage from SM-2 review state for FactArtwork.svelte.
 *
 * DD-V2-034: Every approved fact gets a pixel-art illustration.
 * Mastery stages: 0=greyscale, 1=sepia, 2=partial-color, 3=full-color, 4=golden.
 */

import { get } from 'svelte/store'
import { playerSave } from './playerData'
import type { ReviewState } from '../../data/types'

/** Mastery visual stage (0-4). */
export type MasteryStage = 0 | 1 | 2 | 3 | 4

/**
 * Derives the mastery stage for a single fact ID from its SM-2 repetitions.
 * Called per-card render — reads synchronously from the playerData store.
 */
export function getMasteryStage(factId: string): MasteryStage {
  const save = get(playerSave)
  if (!save) return 0
  const reviewStatesArr: ReviewState[] = save.reviewStates
  const state = reviewStatesArr.find((s) => s.factId === factId)
  if (!state) return 0
  const reps = state.repetitions ?? 0
  if (reps === 0) return 0
  if (reps <= 2)  return 1
  if (reps === 3) return 2
  if (reps <= 5)  return 3
  return 4
}

/**
 * Returns the CSS filter string for the given mastery stage.
 * Phase 57.4: Updated greyscale-to-color progression:
 *   0 = fully grey, 1 = partial color, 2 = nearly full, 3 = full, 4 = vivid golden
 */
export function masteryFilter(stage: MasteryStage): string {
  switch (stage) {
    case 0: return 'grayscale(1)'
    case 1: return 'grayscale(0.6) saturate(0.5)'
    case 2: return 'grayscale(0.1) saturate(1.2)'
    case 3: return 'grayscale(0) saturate(1.5)'
    case 4: return 'grayscale(0) saturate(1.5) brightness(1.1)'  // base; shimmer added via overlay
  }
}

/** Returns the human-readable mastery stage label. */
export function masteryLabel(stage: MasteryStage): string {
  return ['Unseen', 'Glimpsed', 'Familiar', 'Learned', 'Mastered'][stage]
}
