import type { CardTier, FactDomain } from '../data/card-types'
import type { Fact, ReviewState } from '../data/types'
import { resolveDomain } from './domainResolver'
import { getCardTier } from './tierDerivation'

export type LibraryTierFilter = 'all' | CardTier | 'unseen'
export type LibrarySortBy = 'name' | 'tier' | 'accuracy' | 'lastReview'

export interface LibraryDomainSummary {
  domain: FactDomain
  totalFacts: number
  encounteredFacts: number
  tier1Count: number
  tier2aCount: number
  tier2bCount: number
  tier3Count: number
  completionPercent: number
  masteryPercent: number
}

export interface LibraryFactEntry {
  fact: Fact
  state: ReviewState | null
  tier: CardTier | 'unseen'
  accuracy: number
}

const TIER_ORDER: Record<LibraryFactEntry['tier'], number> = {
  unseen: 0,
  '1': 1,
  '2a': 2,
  '2b': 3,
  '3': 4,
}

function toAccuracy(state: ReviewState | null): number {
  if (!state) return 0
  const attempts = state.totalAttempts ?? 0
  if (attempts <= 0) return 0
  return Math.round(((state.totalCorrect ?? 0) / attempts) * 100)
}

function toEntry(fact: Fact, state: ReviewState | null): LibraryFactEntry {
  return {
    fact,
    state,
    tier: state ? getCardTier(state) : 'unseen',
    accuracy: toAccuracy(state),
  }
}

export function buildDomainSummaries(facts: Fact[], reviewStates: ReviewState[]): LibraryDomainSummary[] {
  const stateByFact = new Map(reviewStates.map((state) => [state.factId, state]))

  const domainMap = new Map<FactDomain, Fact[]>()
  for (const fact of facts) {
    const domain = resolveDomain(fact)
    const current = domainMap.get(domain)
    if (current) current.push(fact)
    else domainMap.set(domain, [fact])
  }

  const summaries: LibraryDomainSummary[] = []
  for (const [domain, domainFacts] of domainMap.entries()) {
    const entries = domainFacts.map((fact) => toEntry(fact, stateByFact.get(fact.id) ?? null))
    const encountered = entries.filter((entry) => entry.state !== null)

    const tier1Count = entries.filter((entry) => entry.tier === '1').length
    const tier2aCount = entries.filter((entry) => entry.tier === '2a').length
    const tier2bCount = entries.filter((entry) => entry.tier === '2b').length
    const tier3Count = entries.filter((entry) => entry.tier === '3').length

    summaries.push({
      domain,
      totalFacts: domainFacts.length,
      encounteredFacts: encountered.length,
      tier1Count,
      tier2aCount,
      tier2bCount,
      tier3Count,
      completionPercent: Math.round((tier3Count / Math.max(1, domainFacts.length)) * 100),
      masteryPercent: encountered.length > 0
        ? Math.round(((tier2aCount + tier2bCount + tier3Count) / encountered.length) * 100)
        : 0,
    })
  }

  return summaries.sort((a, b) => a.domain.localeCompare(b.domain))
}

export function buildDomainEntries(
  domain: FactDomain,
  facts: Fact[],
  reviewStates: ReviewState[],
  filter: LibraryTierFilter = 'all',
  sortBy: LibrarySortBy = 'tier',
): LibraryFactEntry[] {
  const stateByFact = new Map(reviewStates.map((state) => [state.factId, state]))

  const entries = facts
    .filter((fact) => resolveDomain(fact) === domain)
    .map((fact) => toEntry(fact, stateByFact.get(fact.id) ?? null))
    .filter((entry) => filter === 'all' || entry.tier === filter)

  entries.sort((a, b) => {
    if (sortBy === 'name') return a.fact.statement.localeCompare(b.fact.statement)
    if (sortBy === 'accuracy') return b.accuracy - a.accuracy
    if (sortBy === 'lastReview') return (b.state?.lastReview ?? 0) - (a.state?.lastReview ?? 0)
    return TIER_ORDER[b.tier] - TIER_ORDER[a.tier]
  })

  return entries
}
