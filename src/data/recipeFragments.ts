import type { MineralTier } from './types'

/** A recipe unlockable only by assembling all fragments. */
export interface FragmentRecipe {
  id: string
  name: string
  description: string
  icon: string
  /** Total fragments needed to assemble. */
  totalFragments: number
  /** Mineral cost to actually craft the item once fragments are assembled. */
  craftCost: Partial<Record<MineralTier, number>>
  /** Effect type and value applied permanently. */
  effect: { type: string; value: number }
  /** Minimum dive layer where fragments can drop. */
  minLayer: number
}

/** All known fragment recipes. */
export const FRAGMENT_RECIPES: FragmentRecipe[] = [
  {
    id: 'ancient_drill',
    name: 'Ancient Drill Protocol',
    description: 'Mine HardRock in 1 tap regardless of pickaxe tier.',
    icon: '⚙️',
    totalFragments: 3,
    craftCost: { crystal: 10, geode: 3 },
    effect: { type: 'hardrock_oneshot', value: 1 },
    minLayer: 8,
  },
  {
    id: 'resonance_lens',
    name: 'Resonance Lens',
    description: 'Quiz streak multiplier caps at ×5 instead of ×3.',
    icon: '🔮',
    totalFragments: 4,
    craftCost: { shard: 30, crystal: 5 },
    effect: { type: 'streak_cap_boost', value: 5 },
    minLayer: 12,
  },
  {
    id: 'temporal_shard',
    name: 'Temporal Shard Gauntlet',
    description: '+25 O2 restored on every correct quiz answer during a dive.',
    icon: '⏳',
    totalFragments: 5,
    craftCost: { geode: 5, essence: 1 },
    effect: { type: 'quiz_o2_regen', value: 25 },
    minLayer: 15,
  },
  {
    id: 'echo_compass',
    name: 'Echo Compass',
    description: 'Instantly locates descent shaft on the current layer.',
    icon: '🧭',
    totalFragments: 3,
    craftCost: { crystal: 8 },
    effect: { type: 'shaft_reveal', value: 1 },
    minLayer: 5,
  },
  {
    id: 'deep_pact',
    name: 'Deep Pact Seal',
    description: 'Offering altars always yield legendary-tier artifacts on tier-3 sacrifice.',
    icon: '🕯️',
    totalFragments: 4,
    craftCost: { geode: 8, essence: 2 },
    effect: { type: 'altar_boost', value: 1 },
    minLayer: 10,
  },
]

/**
 * Get a fragment recipe by id.
 * @param id - The recipe id to look up.
 */
export function getFragmentRecipe(id: string): FragmentRecipe | undefined {
  return FRAGMENT_RECIPES.find(r => r.id === id)
}

/**
 * Get all fragment recipes the player can find at a given layer (1-indexed).
 * @param layer - The 1-indexed mine layer number.
 */
export function getFragmentsForLayer(layer: number): FragmentRecipe[] {
  return FRAGMENT_RECIPES.filter(r => r.minLayer <= layer)
}
