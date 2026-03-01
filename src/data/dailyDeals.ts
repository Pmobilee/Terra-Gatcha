import type { MineralTier } from './types'

export interface DailyDeal {
  id: string
  name: string
  description: string
  icon: string
  category: 'mineral_pack' | 'oxygen_boost' | 'recipe_discount' | 'cosmetic_discount' | 'mystery_box'
  cost: Partial<Record<MineralTier, number>>
  reward: DealReward
}

export type DealReward =
  | { type: 'minerals'; tier: MineralTier; amount: number }
  | { type: 'oxygen_tanks'; amount: number }
  | { type: 'recipe_discount'; recipeId: string; discountPercent: number }
  | { type: 'random_minerals'; minDust: number; maxDust: number }
  | { type: 'cosmetic_unlock'; cosmeticId: string }

/** All possible deals that can rotate in */
const DEAL_POOL: DailyDeal[] = [
  {
    id: 'shard_bundle',
    name: 'Shard Bundle',
    description: '5 shards at a discount',
    icon: '💎',
    category: 'mineral_pack',
    cost: { dust: 150 },
    reward: { type: 'minerals', tier: 'shard', amount: 5 },
  },
  {
    id: 'crystal_special',
    name: 'Crystal Special',
    description: '2 crystals for shards',
    icon: '🔮',
    category: 'mineral_pack',
    cost: { shard: 15 },
    reward: { type: 'minerals', tier: 'crystal', amount: 2 },
  },
  {
    id: 'oxygen_surplus',
    name: 'Oxygen Surplus',
    description: '+1 oxygen tank',
    icon: '🫧',
    category: 'oxygen_boost',
    cost: { dust: 300, shard: 5 },
    reward: { type: 'oxygen_tanks', amount: 1 },
  },
  {
    id: 'mystery_minerals',
    name: 'Mystery Cache',
    description: 'Random mineral windfall',
    icon: '❓',
    category: 'mystery_box',
    cost: { dust: 100 },
    reward: { type: 'random_minerals', minDust: 50, maxDust: 250 },
  },
  {
    id: 'geode_deal',
    name: 'Geode Deal',
    description: '1 geode at a steal',
    icon: '🪨',
    category: 'mineral_pack',
    cost: { crystal: 8 },
    reward: { type: 'minerals', tier: 'geode', amount: 1 },
  },
  {
    id: 'dust_sale',
    name: 'Dust Clearance',
    description: 'Bulk dust cheap',
    icon: '✨',
    category: 'mineral_pack',
    cost: { shard: 3 },
    reward: { type: 'minerals', tier: 'dust', amount: 200 },
  },
  {
    id: 'bomb_discount',
    name: 'Bomb Kit Sale',
    description: 'Bomb kit at 50% off',
    icon: '💣',
    category: 'recipe_discount',
    cost: { dust: 150, shard: 5 },
    reward: { type: 'recipe_discount', recipeId: 'bomb_kit', discountPercent: 50 },
  },
  {
    id: 'tank_deal',
    name: 'Tank Upgrade Sale',
    description: 'Reinforced tank at 40% off',
    icon: '🫧',
    category: 'recipe_discount',
    cost: { dust: 120, shard: 3 },
    reward: { type: 'recipe_discount', recipeId: 'reinforced_tank', discountPercent: 40 },
  },
]

/**
 * Generate today's 3 deals using the date as seed.
 * Same deals for everyone on the same day.
 */
export function getTodaysDeals(): DailyDeal[] {
  const today = new Date()
  const seed =
    today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  // Simple seeded shuffle to pick 3
  const shuffled = [...DEAL_POOL]
  let s = seed
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, 3)
}

/** Get hours remaining until deals reset (midnight) */
export function getTimeUntilReset(): { hours: number; minutes: number } {
  const now = new Date()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const diff = tomorrow.getTime() - now.getTime()
  return {
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
  }
}
