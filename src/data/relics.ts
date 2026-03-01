import type { Relic } from './types'

// =========================================================
// Synergy System
// =========================================================

/** A bonus effect granted when two or more relics are combined. */
export interface RelicSynergy {
  id: string
  name: string
  description: string
  icon: string // emoji
  requiredRelics: string[] // relic IDs needed
  effect: SynergyEffect
}

export type SynergyEffect =
  | { type: 'oxygen_regen_boost'; amount: number }
  | { type: 'mineral_multiplier'; multiplier: number }
  | { type: 'hazard_immunity' }
  | { type: 'reveal_all_specials' }
  | { type: 'double_artifact_chance' }

/** All available relic synergies. */
export const SYNERGIES: RelicSynergy[] = [
  {
    id: 'survivors_kit',
    name: "Survivor's Kit",
    description: 'O2 heart + Tough Skin = Regenerate 2x faster',
    icon: '💪',
    requiredRelics: ['oxygen_heart', 'tough_skin'],
    effect: { type: 'oxygen_regen_boost', amount: 3 }, // +3 extra O2 per 10 blocks
  },
  {
    id: 'treasure_hunter',
    name: 'Treasure Hunter',
    description: 'Lucky Strike + Mineral Magnet = 1.5x mineral drops',
    icon: '💰',
    requiredRelics: ['lucky_strike', 'mineral_magnet'],
    effect: { type: 'mineral_multiplier', multiplier: 1.5 },
  },
  {
    id: 'deep_diver',
    name: 'Deep Diver',
    description: 'Deep Breath + Tough Skin = Immune to hazards',
    icon: '🌊',
    requiredRelics: ['deep_breath', 'tough_skin'],
    effect: { type: 'hazard_immunity' },
  },
  {
    id: 'scholars_blessing',
    name: "Scholar's Blessing",
    description: 'Quiz Master + Lucky Strike = Double artifact chances',
    icon: '📚',
    requiredRelics: ['quiz_master', 'lucky_strike'],
    effect: { type: 'double_artifact_chance' },
  },
]

/**
 * Check which synergies are active given collected relic IDs.
 *
 * @param relicIds - IDs of relics currently held
 */
export function getActiveSynergies(relicIds: string[]): RelicSynergy[] {
  return SYNERGIES.filter(syn =>
    syn.requiredRelics.every(req => relicIds.includes(req))
  )
}

// =========================================================
// Relic catalogue
// =========================================================

/** All relics available in the game */
export const RELICS: Relic[] = [
  {
    id: 'oxygen_heart',
    name: 'Oxygen Heart',
    description: 'Restores 3 O2 every 10 blocks mined',
    icon: '💚',
    effect: { type: 'oxygen_regen', amount: 3 },
  },
  {
    id: 'mineral_magnet',
    name: 'Mineral Magnet',
    description: 'Auto-collects minerals within 2 tiles',
    icon: '🧲',
    effect: { type: 'mineral_magnet', radius: 2 },
  },
  {
    id: 'tough_skin',
    name: 'Tough Skin',
    description: 'Reduces hazard oxygen costs by 5',
    icon: '🛡️',
    effect: { type: 'tough_skin', reduction: 5 },
  },
  {
    id: 'lucky_strike',
    name: 'Lucky Strike',
    description: '20% chance to double mineral drops',
    icon: '🍀',
    effect: { type: 'lucky_strike', chance: 0.20 },
  },
  {
    id: 'deep_breath',
    name: 'Deep Breath',
    description: '+25 maximum oxygen capacity',
    icon: '🫁',
    effect: { type: 'deep_breath', bonus: 25 },
  },
  {
    id: 'quiz_master',
    name: 'Quiz Master',
    description: '+5 bonus dust on correct quiz answers',
    icon: '🎓',
    effect: { type: 'quiz_master', bonus: 5 },
  },
]

/**
 * Pick a random relic the player doesn't already have this run.
 * Returns null if the player has collected all available relics.
 *
 * @param ownedRelicIds - IDs of relics already collected this run
 * @param rng - Seeded random number generator
 */
export function pickRandomRelic(ownedRelicIds: string[], rng: () => number): Relic | null {
  const available = RELICS.filter(r => !ownedRelicIds.includes(r.id))
  if (available.length === 0) return null
  return available[Math.floor(rng() * available.length)]
}
