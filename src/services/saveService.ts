import { BALANCE } from '../data/balance'
import type {
  AgeRating,
  MineralTier,
  PlayerSave,
  PlayerStats,
  ReviewState,
} from '../data/types'

export const SAVE_KEY = 'terra-gacha-save'
export const SAVE_VERSION = 1

const EMPTY_MINERALS: Record<MineralTier, number> = {
  dust: 0,
  shard: 0,
  crystal: 0,
  coreFragment: 0,
  primordialEssence: 0,
}

const EMPTY_STATS: PlayerStats = {
  totalBlocksMined: 0,
  totalDivesCompleted: 0,
  deepestLayerReached: 0,
  totalFactsLearned: 0,
  totalFactsSold: 0,
  totalQuizCorrect: 0,
  totalQuizWrong: 0,
  currentStreak: 0,
  bestStreak: 0,
}

/**
 * Stores player save data in localStorage.
 */
export function save(data: PlayerSave): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data))
}

/**
 * Loads player save data from localStorage.
 *
 * Returns null when no save exists or the stored JSON is invalid.
 */
export function load(): PlayerSave | null {
  const raw = localStorage.getItem(SAVE_KEY)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as PlayerSave
  } catch {
    return null
  }
}

/**
 * Creates a fresh player save with default resources and stats.
 */
export function createNewPlayer(ageRating: AgeRating): PlayerSave {
  const now = Date.now()
  const reviewStates: ReviewState[] = []

  return {
    version: SAVE_VERSION,
    playerId: typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    ageRating,
    createdAt: now,
    lastPlayedAt: now,
    oxygen: BALANCE.STARTING_OXYGEN_TANKS,
    minerals: { ...EMPTY_MINERALS },
    learnedFacts: [],
    reviewStates,
    soldFacts: [],
    stats: { ...EMPTY_STATS },
  }
}

/**
 * Deletes the current player save from localStorage.
 */
export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY)
}
