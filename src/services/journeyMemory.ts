import type { PlayerSave } from '../data/types'
import { getMasteryLevel } from './sm2'
import { factsDB } from './factsDB'

/**
 * Derived GAIA journey memory variables computed from the player's full save state.
 * Used to populate {{variable}} placeholders in memory-themed GAIA dialogue lines.
 */
export interface JourneyMemoryVars {
  totalFacts: number
  masteredFacts: number
  totalDives: number
  currentStreak: number
  bestStreak: number
  favoriteCategory: string
  strongestCategoryCount: number
  recentFactStatement: string
  nextMilestone: number
  factsToNextMilestone: number
  deepestLayer: number
}

/** Ordered milestone checkpoints used to compute the next learning goal. */
const FACT_MILESTONES = [10, 25, 50, 100, 150, 200, 300, 500, 1000]

/**
 * Derives journey memory variables from a player save for use in GAIA dialogue.
 *
 * Returns null when the player has fewer than 5 learned facts — not enough history
 * to produce meaningful commentary.
 *
 * @param save - The full player save document.
 * @returns Populated JourneyMemoryVars or null if insufficient data.
 */
export function deriveJourneyMemoryVars(save: PlayerSave): JourneyMemoryVars | null {
  if (save.learnedFacts.length < 5) return null

  const totalFacts = save.learnedFacts.length

  // Count mastered facts using the SM-2 getMasteryLevel helper.
  const masteredFacts = save.reviewStates.filter(
    rs => getMasteryLevel(rs) === 'mastered'
  ).length

  // Build category frequency map by looking up each fact in the DB.
  const categoryCount: Record<string, number> = {}
  for (const factId of save.learnedFacts) {
    const fact = factsDB.getById(factId)
    if (fact && fact.category.length > 0) {
      const cat = fact.category[0]
      categoryCount[cat] = (categoryCount[cat] ?? 0) + 1
    }
  }

  // Determine the category the player has learned the most facts in.
  let favoriteCategory = 'General'
  let strongestCategoryCount = 0
  for (const [cat, count] of Object.entries(categoryCount)) {
    if (count > strongestCategoryCount) {
      strongestCategoryCount = count
      favoriteCategory = cat
    }
  }

  // Most recently learned fact statement (last element of learnedFacts array).
  const recentFactId = save.learnedFacts[save.learnedFacts.length - 1]
  const recentFact = factsDB.getById(recentFactId)
  const recentFactStatement = recentFact?.statement ?? 'an unknown discovery'

  // Find the next milestone above the current total.
  let nextMilestone = FACT_MILESTONES[FACT_MILESTONES.length - 1]
  for (const milestone of FACT_MILESTONES) {
    if (milestone > totalFacts) {
      nextMilestone = milestone
      break
    }
  }
  const factsToNextMilestone = Math.max(0, nextMilestone - totalFacts)

  return {
    totalFacts,
    masteredFacts,
    totalDives: save.stats.totalDivesCompleted,
    currentStreak: save.stats.currentStreak,
    bestStreak: save.stats.bestStreak,
    favoriteCategory,
    strongestCategoryCount,
    recentFactStatement,
    nextMilestone,
    factsToNextMilestone,
    deepestLayer: save.stats.deepestLayerReached,
  }
}
