/**
 * Data Disc definitions — collectible items found during dives that unlock themed fact packs.
 * Each disc corresponds to a category of facts and grants the player access to more
 * content in their Knowledge Tree.
 */

export interface DataDisc {
  id: string
  name: string
  description: string
  icon: string
  /** Category path prefix to match facts — e.g., 'Natural Sciences' */
  categoryFilter: string
  /** How many facts this disc unlocks access to */
  factCount: number
  /** Rarity of the disc (affects drop rate) */
  rarity: 'common' | 'uncommon' | 'rare'
}

/** All available Data Discs in the game */
export const DATA_DISCS: DataDisc[] = [
  {
    id: 'disc_space',
    name: 'Stellar Archives',
    description: 'Data on stars, planets, and cosmic phenomena',
    icon: '🌟',
    categoryFilter: 'Natural Sciences',
    factCount: 10,
    rarity: 'common',
  },
  {
    id: 'disc_life',
    name: 'Bioscan Records',
    description: 'Documentation of Earth\'s living organisms',
    icon: '🧬',
    categoryFilter: 'Life Sciences',
    factCount: 10,
    rarity: 'common',
  },
  {
    id: 'disc_history',
    name: 'Chronicle Fragments',
    description: 'Records of human civilization and events',
    icon: '📜',
    categoryFilter: 'History',
    factCount: 10,
    rarity: 'uncommon',
  },
  {
    id: 'disc_tech',
    name: 'Tech Blueprints',
    description: 'Schematics and documentation of ancient technology',
    icon: '⚙️',
    categoryFilter: 'Technology',
    factCount: 10,
    rarity: 'uncommon',
  },
  {
    id: 'disc_geo',
    name: 'Geological Survey',
    description: 'Mapping data of Earth\'s geography and geology',
    icon: '🗺️',
    categoryFilter: 'Geography',
    factCount: 10,
    rarity: 'uncommon',
  },
  {
    id: 'disc_culture',
    name: 'Cultural Memory Bank',
    description: 'Art, music, and traditions of past civilizations',
    icon: '🎭',
    categoryFilter: 'Culture',
    factCount: 10,
    rarity: 'rare',
  },
]

/**
 * Picks a random unowned Data Disc, weighted by rarity (common > uncommon > rare).
 * Returns null if the player already owns all discs.
 *
 * @param unlockedIds - Array of disc IDs the player already owns
 * @param rng - Seeded random number generator returning values in [0, 1)
 */
export function pickRandomDisc(unlockedIds: string[], rng: () => number): DataDisc | null {
  const available = DATA_DISCS.filter(d => !unlockedIds.includes(d.id))
  if (available.length === 0) return null

  // Weight by rarity: common=3, uncommon=2, rare=1
  const weighted = available.flatMap(d => {
    const w = d.rarity === 'common' ? 3 : d.rarity === 'uncommon' ? 2 : 1
    return Array<DataDisc>(w).fill(d)
  })

  return weighted[Math.floor(rng() * weighted.length)]
}
