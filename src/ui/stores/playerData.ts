import { get, writable } from 'svelte/store'
import type { AgeRating, MineralTier, PlayerSave, ReviewState } from '../../data/types'
import { createNewPlayer, load, save as saveFn } from '../../services/saveService'
import { createReviewState, isDue, reviewFact } from '../../services/sm2'

/** The active player save data. */
export const playerSave = writable<PlayerSave | null>(null)

/**
 * Initializes player data from storage or creates a fresh save.
 *
 * @param ageRating - Age rating to use when creating a new save.
 * @returns The loaded or newly created player save.
 */
export function initPlayer(ageRating: AgeRating = 'teen'): PlayerSave {
  let save = load()

  if (!save) {
    save = createNewPlayer(ageRating)
    saveFn(save)
  }

  playerSave.set(save)
  return save
}

/**
 * Persists the current player data to localStorage.
 */
export function persistPlayer(): void {
  const current = get(playerSave)

  if (!current) {
    return
  }

  const updated: PlayerSave = {
    ...current,
    lastPlayedAt: Date.now(),
  }

  playerSave.set(updated)
  saveFn(updated)
}

/**
 * Adds a fact ID to learned facts and creates its review state.
 *
 * @param factId - Fact identifier to add to the learned list.
 */
export function addLearnedFact(factId: string): void {
  playerSave.update((save) => {
    if (!save || save.learnedFacts.includes(factId)) {
      return save
    }

    return {
      ...save,
      learnedFacts: [...save.learnedFacts, factId],
      reviewStates: [...save.reviewStates, createReviewState(factId)],
      stats: {
        ...save.stats,
        totalFactsLearned: save.stats.totalFactsLearned + 1,
      },
    }
  })

  persistPlayer()
}

/**
 * Sells a learned fact for mineral rewards.
 *
 * @param factId - Fact identifier to sell.
 * @param mineralReward - Dust reward granted for this sale.
 */
export function sellFact(factId: string, mineralReward: number): void {
  playerSave.update((save) => {
    if (!save) {
      return save
    }

    return {
      ...save,
      soldFacts: [...save.soldFacts, factId],
      learnedFacts: save.learnedFacts.filter((id) => id !== factId),
      reviewStates: save.reviewStates.filter((state) => state.factId !== factId),
      minerals: {
        ...save.minerals,
        dust: save.minerals.dust + mineralReward,
      },
      stats: {
        ...save.stats,
        totalFactsSold: save.stats.totalFactsSold + 1,
      },
    }
  })

  persistPlayer()
}

/**
 * Updates SM-2 review state and quiz stats after one answer.
 *
 * @param factId - Fact identifier whose review state should change.
 * @param correct - Whether the submitted answer was correct.
 */
export function updateReviewState(factId: string, correct: boolean): void {
  playerSave.update((save) => {
    if (!save) {
      return save
    }

    return {
      ...save,
      reviewStates: save.reviewStates.map((state) =>
        state.factId === factId ? reviewFact(state, correct) : state,
      ),
      stats: {
        ...save.stats,
        totalQuizCorrect: correct ? save.stats.totalQuizCorrect + 1 : save.stats.totalQuizCorrect,
        totalQuizWrong: correct ? save.stats.totalQuizWrong : save.stats.totalQuizWrong + 1,
      },
    }
  })

  persistPlayer()
}

/**
 * Returns review states that are currently due.
 *
 * @returns Array of review states due for study.
 */
export function getDueReviews(): ReviewState[] {
  const save = get(playerSave)

  if (!save) {
    return []
  }

  return save.reviewStates.filter((state) => isDue(state))
}

/**
 * Adds minerals earned from gameplay.
 *
 * @param tier - Mineral tier to increment.
 * @param amount - Amount to add.
 */
export function addMinerals(tier: MineralTier, amount: number): void {
  playerSave.update((save) => {
    if (!save) {
      return save
    }

    return {
      ...save,
      minerals: {
        ...save.minerals,
        [tier]: save.minerals[tier] + amount,
      },
    }
  })

  persistPlayer()
}

/**
 * Records a completed dive in player statistics.
 *
 * @param deepestLayer - Deepest layer reached in the dive.
 * @param blocksMined - Number of blocks mined during the dive.
 */
export function recordDiveComplete(deepestLayer: number, blocksMined: number): void {
  playerSave.update((save) => {
    if (!save) {
      return save
    }

    return {
      ...save,
      stats: {
        ...save.stats,
        totalDivesCompleted: save.stats.totalDivesCompleted + 1,
        totalBlocksMined: save.stats.totalBlocksMined + blocksMined,
        deepestLayerReached:
          deepestLayer > save.stats.deepestLayerReached
            ? deepestLayer
            : save.stats.deepestLayerReached,
      },
    }
  })

  persistPlayer()
}
