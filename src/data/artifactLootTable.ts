import type { MineralTier } from './types'

/** Reward types from cracking an artifact. */
export type ArtifactRewardType =
  | 'fact'
  | 'dust'
  | 'consumable'
  | 'fossil'
  | 'upgrade_token'
  | 'junk'

/** A single artifact reward result. */
export interface ArtifactReward {
  type: ArtifactRewardType
  amount?: number
  factId?: string
  itemId?: string
  dustTier?: MineralTier
  gaiaMessage: string
}

/** Data shape for an artifact pending analysis. */
export interface PendingArtifactData {
  factId: string
  rarity: string
  minedAt: number
}

// Loot table weights per rarity tier
const LOOT_TABLES: Record<
  string,
  Record<ArtifactRewardType, number>
> = {
  common: {
    junk: 25,
    dust: 30,
    fact: 25,
    consumable: 15,
    fossil: 5,
    upgrade_token: 0,
  },
  uncommon: {
    junk: 18,
    dust: 25,
    fact: 25,
    consumable: 20,
    fossil: 10,
    upgrade_token: 2,
  },
  rare: {
    junk: 10,
    dust: 20,
    fact: 25,
    consumable: 25,
    fossil: 15,
    upgrade_token: 5,
  },
  epic: {
    junk: 8,
    dust: 15,
    fact: 22,
    consumable: 25,
    fossil: 18,
    upgrade_token: 12,
  },
  legendary: {
    junk: 5,
    dust: 10,
    fact: 20,
    consumable: 20,
    fossil: 20,
    upgrade_token: 25,
  },
  mythic: {
    junk: 3,
    dust: 8,
    fact: 20,
    consumable: 19,
    fossil: 20,
    upgrade_token: 30,
  },
}

/**
 * Apply study score modifiers to the loot weight table.
 * Diligent players get fewer junk drops and more fact/upgrade rewards.
 */
function applyStudyModifiers(
  weights: Record<ArtifactRewardType, number>,
  score: number,
): Record<ArtifactRewardType, number> {
  const w = { ...weights }
  if (score < 0.3) {
    w.junk += 30
    w.fact -= 10
    w.upgrade_token = Math.max(0, w.upgrade_token - 5)
  } else if (score >= 0.7) {
    w.junk = Math.max(0, w.junk - 10)
    w.fact += 10
    w.consumable += 5
    w.fossil += 5
    w.upgrade_token += 5
  }
  // Clamp all to minimum 0
  for (const key of Object.keys(w) as ArtifactRewardType[]) {
    w[key] = Math.max(0, w[key])
  }
  return w
}

// GAIA messages per study tier and reward quality
const GAIA_MESSAGES: Record<string, Record<string, string[]>> = {
  diligent: {
    good: [
      'Your dedication paid off! The crystal resonated with your knowledge.',
      "A scholar's reward! Your study habits have sharpened the analyzer.",
      'Excellent find! Knowledge truly is the best catalyst.',
    ],
    neutral: [
      'A modest yield, but your knowledge keeps the odds in your favor.',
      "Not every crystal shines bright, but your habits will pay off.",
    ],
    bad: [
      'Even masters find duds sometimes. Your next one will shine.',
      "A misfire? Rare for someone so diligent. Don't let it discourage you.",
    ],
  },
  average: {
    good: [
      'A nice surprise! Imagine what regular study could yield.',
      'Not bad! A bit more review and these could be even better.',
    ],
    neutral: [
      'An average yield. Consistent study could tip the scales.',
      'Middle of the road. The analyzer responds to dedication.',
    ],
    bad: [
      'The crystal went dark. More study sessions might help recalibrate.',
      'Junk again. The analyzer works better when you review regularly.',
    ],
  },
  neglectful: {
    good: [
      'Lucky break! Imagine what you\'d find if you studied more...',
      'Fortune favors you today, but it won\'t last without study.',
    ],
    neutral: [
      'The analyzer struggles without a calibrated mind behind it.',
      'Mediocre result. Your overdue reviews are showing.',
    ],
    bad: [
      'The analyzer needs a knowledgeable operator. Your overdue reviews are... showing.',
      'Another dud. The crystals can sense neglect, you know.',
      'Junk. Study tip: even 5 minutes of review improves resonance.',
    ],
  },
}

/** Pick a GAIA message based on study tier and reward quality. */
function pickGaiaMessage(
  studyTier: string,
  rewardQuality: string,
  rng: () => number,
): string {
  const pool =
    GAIA_MESSAGES[studyTier]?.[rewardQuality] ??
    GAIA_MESSAGES.average.neutral
  return pool[Math.floor(rng() * pool.length)]
}

/** Map a reward type to a quality label. */
function getRewardQuality(type: ArtifactRewardType): string {
  if (
    type === 'upgrade_token' ||
    type === 'fossil' ||
    type === 'fact'
  )
    return 'good'
  if (type === 'junk') return 'bad'
  return 'neutral'
}

/**
 * Roll a reward for a pending artifact based on its rarity and the player's study score.
 *
 * @param artifact - The pending artifact data (rarity, factId, minedAt).
 * @param studyScore - Study score from 0.0 to 1.0.
 * @param rng - Random number generator (0..1).
 * @returns The rolled artifact reward.
 */
export function rollArtifactReward(
  artifact: PendingArtifactData,
  studyScore: number,
  rng: () => number,
): ArtifactReward {
  const tierKey =
    artifact.rarity in LOOT_TABLES ? artifact.rarity : 'common'
  const baseWeights = LOOT_TABLES[tierKey]
  const weights = applyStudyModifiers(baseWeights, studyScore)

  // Weighted random roll
  const totalWeight = Object.values(weights).reduce(
    (a, b) => a + b,
    0,
  )
  let roll = rng() * totalWeight
  let selectedType: ArtifactRewardType = 'junk'
  for (const [type, weight] of Object.entries(weights)) {
    roll -= weight
    if (roll <= 0) {
      selectedType = type as ArtifactRewardType
      break
    }
  }

  const studyTier =
    studyScore >= 0.7
      ? 'diligent'
      : studyScore >= 0.3
        ? 'average'
        : 'neglectful'
  const quality = getRewardQuality(selectedType)
  const gaiaMessage = pickGaiaMessage(studyTier, quality, rng)

  // Generate reward details
  switch (selectedType) {
    case 'fact':
      return { type: 'fact', factId: artifact.factId, gaiaMessage }
    case 'dust': {
      const dustAmounts: Record<
        string,
        [MineralTier, number, number]
      > = {
        common: ['dust', 5, 15],
        uncommon: ['dust', 10, 25],
        rare: ['shard', 3, 8],
        epic: ['shard', 5, 15],
        legendary: ['crystal', 2, 6],
        mythic: ['crystal', 4, 10],
      }
      const [tier, min, max] = dustAmounts[tierKey] ?? [
        'dust',
        5,
        15,
      ]
      return {
        type: 'dust',
        dustTier: tier,
        amount: min + Math.floor(rng() * (max - min + 1)),
        gaiaMessage,
      }
    }
    case 'consumable': {
      const consumables = [
        'bomb',
        'o2_tank',
        'scanner_charge',
        'shield',
      ]
      return {
        type: 'consumable',
        itemId:
          consumables[Math.floor(rng() * consumables.length)],
        amount: 1,
        gaiaMessage,
      }
    }
    case 'fossil':
      return {
        type: 'fossil',
        itemId: `fossil_${Math.floor(rng() * 10)}`,
        amount: 1,
        gaiaMessage,
      }
    case 'upgrade_token':
      return {
        type: 'upgrade_token',
        amount: 1,
        gaiaMessage,
      }
    case 'junk':
    default:
      return {
        type: 'junk',
        dustTier: 'dust',
        amount: 1 + Math.floor(rng() * 5),
        gaiaMessage,
      }
  }
}
