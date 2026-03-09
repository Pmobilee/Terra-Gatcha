import type { InterestConfig } from '../data/interestConfig'
import { computeFactWeights, weightedRandomSelect } from '../data/interestConfig'
import type { Biome } from '../data/biomes'
import { ALL_BIOMES } from '../data/biomes'
import { get } from 'svelte/store'
import { classroomStore } from '../ui/stores/classroomStore'

/** Biome-to-category affinity mapping (DD-V2-120). */
const BIOME_CATEGORY_AFFINITY: Record<string, string[]> = {
  crystalline_caves: ['Natural Sciences', 'Geography'],
  volcanic_depths: ['Natural Sciences', 'Geography'],
  limestone_caves: ['History', 'Human Body & Health'],
  sandstone_layers: ['History', 'Geography'],
  granite_depths: ['Natural Sciences', 'General Knowledge'],
  coral_reef_fossil: ['Animals & Wildlife', 'Natural Sciences'],
  glacial_caverns: ['Geography', 'Natural Sciences'],
  obsidian_flows: ['Natural Sciences', 'General Knowledge'],
  mushroom_grotto: ['Animals & Wildlife', 'Mythology & Folklore'],
  bioluminescent_depths: ['Human Body & Health', 'Natural Sciences'],
  ancient_riverbed: ['History', 'Geography'],
  petrified_forest: ['Animals & Wildlife', 'History'],
  sulfur_vents: ['Natural Sciences', 'General Knowledge'],
  magma_chambers: ['Natural Sciences', 'Geography'],
  crystal_cathedral: ['Natural Sciences', 'Art & Architecture'],
  deep_ocean_trench: ['Animals & Wildlife', 'Geography'],
  asteroid_impact: ['Natural Sciences', 'History'],
  geode_gallery: ['Natural Sciences', 'Art & Architecture'],
  iron_ore_veins: ['General Knowledge', 'Natural Sciences'],
  clay_deposits: ['Art & Architecture', 'History'],
  salt_flats: ['Geography', 'Natural Sciences'],
  diamond_pipes: ['Natural Sciences', 'General Knowledge'],
  tectonic_rift: ['Natural Sciences', 'Geography'],
  temporal_anomaly: ['History', 'Mythology & Folklore'],
  void_pocket: ['Space & Astronomy', 'Natural Sciences'],
}

/**
 * Returns a weighted biome selection pool that gives a ~30% weight boost to
 * biomes whose category affinity matches the player's active interests (DD-V2-120).
 * This is invisible to the player and non-configurable.
 */
export function pickBiomeWithInterestBias(
  interestConfig: InterestConfig,
  rng: () => number,
): Biome {
  const activeCategories = interestConfig.categories
    .filter(c => c.weight > 0)
    .map(c => c.category)

  const weights = ALL_BIOMES.map(biome => {
    const affinities = BIOME_CATEGORY_AFFINITY[biome.id] ?? []
    const hasAffinity = affinities.some(affCat => activeCategories.includes(affCat))
    return hasAffinity ? 1.3 : 1.0
  })

  return weightedRandomSelect(ALL_BIOMES, weights, rng) ?? ALL_BIOMES[0]
}

/**
 * Generates an interest-biased biome sequence for an entire dive run.
 * Layer 0 uses the default biome. Later layers use interest-biased selection.
 */
export function generateInterestBiasedBiomeSequence(
  rng: () => number,
  maxLayers: number,
  interestConfig: InterestConfig,
): Biome[] {
  const sequence: Biome[] = [ALL_BIOMES[0]]

  for (let layer = 1; layer < maxLayers; layer++) {
    const hasInterests = interestConfig.categories.some(c => c.weight > 0)
    if (!hasInterests) {
      sequence.push(ALL_BIOMES[Math.floor(rng() * ALL_BIOMES.length)])
    } else {
      sequence.push(pickBiomeWithInterestBias(interestConfig, rng))
    }
  }

  return sequence
}

/**
 * Selects a fact ID from the available fact pool using interest-weighted random selection.
 * If a teacher homework assignment is active, its category lock takes precedence over
 * the player's own interest lock (DD-V2-172).
 * If category lock is active and no facts match, falls back to the full pool.
 */
export function selectWeightedFact(
  factPool: Array<{ id: string; category: string[] }>,
  interestConfig: InterestConfig,
  rng: () => number,
): string | undefined {
  if (factPool.length === 0) return undefined

  // Phase 44: Teacher assignment overrides player interest lock.
  // The student's UI shows no indication of a teacher-assigned lock — it
  // appears identical to a player-set category focus (DD-V2-172).
  const classroom = get(classroomStore)
  if (classroom.activeAssignment) {
    const assignedCategories = classroom.activeAssignment.categories
    const locked = factPool.filter(f =>
      assignedCategories.some(cat => f.category.includes(cat)),
    )
    const pool = locked.length > 0 ? locked : factPool
    return weightedRandomSelect(pool, pool.map(() => 1.0), rng)?.id
  }

  let weights = computeFactWeights(factPool, interestConfig)
  const totalWeight = weights.reduce((s, w) => s + w, 0)

  // Fallback: if category lock eliminated all facts, use the full pool
  if (totalWeight === 0) {
    weights = factPool.map(() => 1.0)
  }

  const selected = weightedRandomSelect(factPool, weights, rng)
  return selected?.id
}
