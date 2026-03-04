/**
 * achievementTiers.ts
 *
 * Achievement Gallery tier system (DD-V2-045).
 * Maps painting rarity to a player-facing tier with badge visuals.
 *
 * Tier  | Rarity mapping        | Badge color | Border color
 * ------|-----------------------|-------------|-------------
 * bronze | common               | #cd7f32     | #8b5a1a
 * silver | uncommon, rare       | #c0c0c0     | #888888
 * gold   | epic, legendary      | #ffd700     | #b8860b
 * platinum | mythic             | #e5e4e2     | #9c9b99
 */

import type { Rarity } from './types'

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface TierVisuals {
  tier: AchievementTier
  label: string
  badgeColor: string
  borderColor: string
  glowColor: string
  /** CSS animation class for the reveal wash */
  revealClass: string
  /** Duration of the paint-reveal animation in ms */
  revealDurationMs: number
}

export const TIER_VISUALS: Record<AchievementTier, TierVisuals> = {
  bronze: {
    tier: 'bronze',
    label: 'Bronze',
    badgeColor: '#cd7f32',
    borderColor: '#8b5a1a',
    glowColor: 'rgba(205,127,50,0.5)',
    revealClass: 'reveal-bronze',
    revealDurationMs: 1200,
  },
  silver: {
    tier: 'silver',
    label: 'Silver',
    badgeColor: '#c0c0c0',
    borderColor: '#888888',
    glowColor: 'rgba(192,192,192,0.5)',
    revealClass: 'reveal-silver',
    revealDurationMs: 1600,
  },
  gold: {
    tier: 'gold',
    label: 'Gold',
    badgeColor: '#ffd700',
    borderColor: '#b8860b',
    glowColor: 'rgba(255,215,0,0.6)',
    revealClass: 'reveal-gold',
    revealDurationMs: 2400,
  },
  platinum: {
    tier: 'platinum',
    label: 'Platinum',
    badgeColor: '#e5e4e2',
    borderColor: '#9c9b99',
    glowColor: 'rgba(229,228,226,0.7)',
    revealClass: 'reveal-platinum',
    revealDurationMs: 3600,
  },
}

/** Map Rarity → AchievementTier */
export function rarityToTier(rarity: Rarity): AchievementTier {
  switch (rarity) {
    case 'common':    return 'bronze'
    case 'uncommon':
    case 'rare':      return 'silver'
    case 'epic':
    case 'legendary': return 'gold'
    case 'mythic':    return 'platinum'
    default:          return 'bronze'
  }
}

/** Ordered tiers from lowest to highest for progress display */
export const TIER_ORDER: AchievementTier[] = ['bronze', 'silver', 'gold', 'platinum']

/** Count how many paintings exist per tier */
export function getPaintingCountByTier(): Record<AchievementTier, number> {
  // Imported lazily to avoid circular deps; callers provide the paintings array
  return { bronze: 3, silver: 5, gold: 7, platinum: 5 }
}
