import type { FactDomain } from '../data/card-types'
import type { PlayerSave, ReviewState } from '../data/types'

export const EARLY_BOOST_RUN_LIMIT = 3
export const RUN_ACCURACY_BONUS_STABILITY_DAYS = 2

export function getCompletedRunsForDomain(save: PlayerSave, domain: FactDomain): number {
  return save.domainRunCounts[domain] ?? 0
}

export function getRunNumberForDomain(save: PlayerSave, domain: FactDomain): number {
  return getCompletedRunsForDomain(save, domain) + 1
}

export function isEarlyBoostActiveForDomain(save: PlayerSave, domain: FactDomain): boolean {
  return getRunNumberForDomain(save, domain) <= EARLY_BOOST_RUN_LIMIT
}

export function incrementDomainRunCount(save: PlayerSave, domain: FactDomain): PlayerSave {
  return {
    ...save,
    domainRunCounts: {
      ...save.domainRunCounts,
      [domain]: (save.domainRunCounts[domain] ?? 0) + 1,
    },
  }
}

export function applyStabilityBonusToFacts(
  reviewStates: ReviewState[],
  factIds: Iterable<string>,
  bonusDays: number = RUN_ACCURACY_BONUS_STABILITY_DAYS,
): ReviewState[] {
  const target = new Set(factIds)
  if (target.size === 0) return reviewStates
  return reviewStates.map((state) => {
    if (!target.has(state.factId)) return state
    const stability = Math.max(0, state.stability ?? state.interval ?? 0)
    return {
      ...state,
      stability: stability + bonusDays,
      interval: Math.max(state.interval, state.interval + bonusDays),
      retrievability: Math.min(1, (state.retrievability ?? 1) + 0.04),
    }
  })
}
