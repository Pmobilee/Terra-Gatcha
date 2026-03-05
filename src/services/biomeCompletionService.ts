/**
 * Biome completion service.
 * Checks whether all facts tagged to a biome's categories are mastered.
 * Awards a cosmetic title and passive bonus on completion.
 * DD-V2-050: biome mastery track.
 */
import { get } from 'svelte/store'
import { playerSave, persistPlayer } from '../ui/stores/playerData'
import { BIOME_COMPLETION_MAP } from '../data/biomeCompletionConfig'
import { isMastered } from './sm2'
import type { PlayerSave } from '../data/types'
import { factsDB } from './factsDB'
import { analyticsService } from './analyticsService'
import type { BiomeId } from '../data/biomes'

/**
 * After a dive, check whether the dive's biome facts are now all mastered.
 * Only checks the dive's biome to avoid an O(n) full scan every dive.
 * Returns the BiomeId if a new completion occurred, or null.
 *
 * @param save - The current player save.
 * @param diveBiomeId - The biome ID of the dive just completed.
 */
export async function checkBiomeCompletion(
  save: PlayerSave,
  diveBiomeId: string,
): Promise<string | null> {
  const config = BIOME_COMPLETION_MAP.get(diveBiomeId as BiomeId)
  if (!config) return null
  if (save.completedBiomes?.includes(diveBiomeId)) return null

  // Fetch all facts matching the biome's categories via factsDB.getAll() + filter
  const allFacts = factsDB.getAll()
  const matchingFacts = allFacts.filter(f =>
    f.category.some(cat => config.requiredCategories.includes(cat))
    || (f.categoryL1 !== undefined && config.requiredCategories.includes(f.categoryL1))
    || (f.categoryL2 !== undefined && config.requiredCategories.includes(f.categoryL2))
  )

  if (matchingFacts.length < config.minimumFacts) return null

  const reviewMap = new Map(save.reviewStates.map(rs => [rs.factId, rs]))
  const allMastered = matchingFacts.every(f => {
    const rs = reviewMap.get(f.id)
    return rs ? isMastered(rs, f.type) : false
  })

  if (!allMastered) return null

  // Award completion
  const updatedSave: PlayerSave = {
    ...save,
    completedBiomes: [...(save.completedBiomes ?? []), diveBiomeId],
    titles: save.titles.includes(config.titleId)
      ? save.titles
      : [...save.titles, config.titleId],
  }
  playerSave.set(updatedSave)
  persistPlayer()

  analyticsService.track({ name: 'biome_completed', properties: { biome_id: diveBiomeId } })
  return diveBiomeId
}

/**
 * Returns the cumulative passive bonus for all completed biomes.
 * Used by MineGenerator and MineScene on dive start.
 *
 * @param save - The player save to compute bonuses for.
 */
export function getCumulativeBiomeBonus(save: PlayerSave): {
  mineralYieldMultiplier: number
  hazardO2Reduction: number
} {
  const completed = save.completedBiomes ?? []
  return completed.reduce(
    (acc, biomeId) => {
      const cfg = BIOME_COMPLETION_MAP.get(biomeId as BiomeId)
      if (!cfg) return acc
      return {
        mineralYieldMultiplier: acc.mineralYieldMultiplier * cfg.passiveBonus.mineralYieldMultiplier,
        hazardO2Reduction: acc.hazardO2Reduction + cfg.passiveBonus.hazardO2Reduction,
      }
    },
    { mineralYieldMultiplier: 1.0, hazardO2Reduction: 0 },
  )
}
