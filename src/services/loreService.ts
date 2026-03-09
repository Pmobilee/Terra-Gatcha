import type { ReviewState } from '../data/types'
import { getCardTier } from './tierDerivation'

const STORAGE_KEY = 'card:loreState'

export interface LoreFragment {
  id: string
  title: string
  body: string
  unlockThreshold: number
}

export interface LoreState {
  unlockedLoreIds: string[]
  lastMilestoneReached: number
}

const DEFAULT_STATE: LoreState = {
  unlockedLoreIds: [],
  lastMilestoneReached: 0,
}

export const LORE_FRAGMENTS: LoreFragment[] = [
  {
    id: 'lore_10',
    title: 'The Alchemist\'s Dream',
    unlockThreshold: 10,
    body: 'Alchemists chased lead-to-gold for centuries. Modern physics proved it was possible, but only through nuclear transmutation at absurd cost. The dream was real; the economics were impossible.',
  },
  {
    id: 'lore_25',
    title: 'The Map That Lied',
    unlockThreshold: 25,
    body: 'Mercator gave sailors straight lines and gave the world distorted continents. Every map is a tradeoff between beauty, truth, and usefulness.',
  },
  {
    id: 'lore_50',
    title: 'The Unbroken Code',
    unlockThreshold: 50,
    body: 'The Navajo code talkers proved that human language can outpace machines. A living language became a wartime cipher no adversary could crack.',
  },
  {
    id: 'lore_100',
    title: 'The Library That Remembers',
    unlockThreshold: 100,
    body: 'Alexandria was not erased in a single night. It faded through neglect. Mastering 100 facts is an act of maintenance: you become the library that does not burn.',
  },
]

function readState(): LoreState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as LoreState
    if (!Array.isArray(parsed.unlockedLoreIds)) return DEFAULT_STATE
    return {
      unlockedLoreIds: parsed.unlockedLoreIds,
      lastMilestoneReached: typeof parsed.lastMilestoneReached === 'number'
        ? parsed.lastMilestoneReached
        : 0,
    }
  } catch {
    return DEFAULT_STATE
  }
}

function writeState(state: LoreState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage failures.
  }
}

export function getLoreState(): LoreState {
  return readState()
}

export function getMasteredFactCount(reviewStates: ReviewState[]): number {
  return reviewStates.filter((state) => getCardTier(state) === '3').length
}

export function syncLoreUnlock(totalMasteredFacts: number): { state: LoreState; newlyUnlocked: LoreFragment[] } {
  const previous = readState()
  const unlocked = new Set(previous.unlockedLoreIds)
  const newlyUnlocked: LoreFragment[] = []
  let lastMilestone = previous.lastMilestoneReached

  for (const fragment of LORE_FRAGMENTS) {
    if (totalMasteredFacts >= fragment.unlockThreshold && !unlocked.has(fragment.id)) {
      unlocked.add(fragment.id)
      newlyUnlocked.push(fragment)
      lastMilestone = Math.max(lastMilestone, fragment.unlockThreshold)
    }
  }

  const state: LoreState = {
    unlockedLoreIds: [...unlocked],
    lastMilestoneReached: lastMilestone,
  }

  writeState(state)
  return { state, newlyUnlocked }
}

export function getUnlockedLoreFragments(): LoreFragment[] {
  const state = readState()
  const unlocked = new Set(state.unlockedLoreIds)
  return LORE_FRAGMENTS.filter((fragment) => unlocked.has(fragment.id))
}
