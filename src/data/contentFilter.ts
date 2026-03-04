/**
 * Content filtering utilities — age-gates the fact pool before quiz/biome assembly.
 * DD-V2-180: Under-13 players only receive 'kid'-rated facts.
 * Teen players receive 'kid' and 'teen' facts.
 * Adult players receive all facts.
 */

import type { Fact, AgeRating } from './types'

/**
 * Filters the fact pool to only include facts appropriate for the given age rating.
 * Must be called before any biome-interest weighting so that age filtering takes
 * absolute precedence over interest and category filters.
 *
 * @param allFacts       - The full fact pool from the DB.
 * @param playerAgeRating - The player's age rating from their save data.
 * @returns A filtered array of facts eligible for the player.
 */
export function getEligibleFacts(allFacts: Fact[], playerAgeRating: AgeRating): Fact[] {
  if (playerAgeRating === 'kid') {
    return allFacts.filter(f => f.ageRating === 'kid')
  }
  if (playerAgeRating === 'teen') {
    return allFacts.filter(f => f.ageRating === 'kid' || f.ageRating === 'teen')
  }
  return allFacts
}
