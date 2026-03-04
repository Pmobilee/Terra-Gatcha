/**
 * @file saveSubDocs.ts
 * Splits a PlayerSave into 5 logical sub-documents for more efficient cloud sync.
 *
 * Sub-documents are keyed by domain: core, knowledge, inventory, dome, analytics.
 * Each carries its own version and updatedAt timestamp so the sync layer can
 * diff individual documents rather than pushing the entire save on every change.
 *
 * The primary save/load path in saveService.ts continues to use a single
 * localStorage key. These helpers are designed for future use with idb-keyval
 * per-document storage and field-level cloud sync (DD-V2-182).
 */

import type { PlayerSave } from '../data/types'

// ============================================================
// VERSION MIXIN
// ============================================================

interface SubDocVersion {
  /** Schema version for this sub-document. Increment on breaking shape changes. */
  version: number
  /** Unix timestamp (ms) of when this sub-document was last written. */
  updatedAt: number
}

// ============================================================
// SUB-DOCUMENT INTERFACES
// ============================================================

/** Core player identity, session counters, and oxygen. */
export interface CoreSubDoc extends SubDocVersion {
  playerId: string
  ageRating: string
  createdAt: number
  lastPlayedAt: number
  oxygen: number
  tutorialComplete: boolean
  tutorialStep: number
  diveCount: number
  selectedInterests: string[]
  interestWeights: Record<string, number>
}

/** Spaced-repetition learning state and knowledge economy. */
export interface KnowledgeSubDoc extends SubDocVersion {
  learnedFacts: string[]
  reviewStates: unknown[]
  soldFacts: string[]
  knowledgePoints: number
  purchasedKnowledgeItems: string[]
  studySessionsCompleted: number
}

/** Minerals, crafted items, consumables, cosmetics, and disc collection. */
export interface InventorySubDoc extends SubDocVersion {
  minerals: Record<string, number>
  craftedItems: Record<string, number>
  craftCounts: Record<string, number>
  activeConsumables: string[]
  consumables: Record<string, number>
  ownedCosmetics: string[]
  equippedCosmetic: string | null
  unlockedDiscs: string[]
  premiumMaterials: Record<string, number>
  purchasedDeals: string[]
  lastDealDate?: string
}

/** Dome state: rooms, hub, farm, fossils, active companion/fossil. */
export interface DomeSubDoc extends SubDocVersion {
  unlockedRooms: string[]
  hubState: unknown
  farm: unknown
  fossils: Record<string, unknown>
  activeCompanion: string | null
  activeFossil: string | null
}

/** Stats, streaks, titles, interest config, and addictiveness-pass fields. */
export interface AnalyticsSubDoc extends SubDocVersion {
  stats: unknown
  streakFreezes: number
  lastStreakMilestone: number
  claimedMilestones: number[]
  streakProtected: boolean
  titles: string[]
  activeTitle: string | null
  interestConfig: unknown
  behavioralSignals: unknown
  archetypeData: unknown
  engagementData: unknown
  loginCalendarDay?: number
  loginCalendarLastClaimed?: number
  lastLoginDate?: number
  longestStreak?: number
  gracePeriodUsedAt?: number
  weeklyChallenge?: unknown
}

// ============================================================
// AGGREGATE INTERFACE
// ============================================================

/** The five sub-documents that together represent a complete PlayerSave. */
export interface SaveSubDocuments {
  core: CoreSubDoc
  knowledge: KnowledgeSubDoc
  inventory: InventorySubDoc
  dome: DomeSubDoc
  analytics: AnalyticsSubDoc
}

// ============================================================
// SPLIT
// ============================================================

/**
 * Splits a full `PlayerSave` into 5 logical sub-documents.
 *
 * Each sub-document receives version=1 and updatedAt=Date.now() so the sync
 * layer can detect which documents have changed since the last push.
 *
 * @param save - The complete player save to split.
 * @returns Five domain-grouped sub-documents.
 */
export function splitSave(save: PlayerSave): SaveSubDocuments {
  const now = Date.now()
  return {
    core: {
      version: 1,
      updatedAt: now,
      playerId: save.playerId,
      ageRating: save.ageRating,
      createdAt: save.createdAt,
      lastPlayedAt: save.lastPlayedAt,
      oxygen: save.oxygen,
      tutorialComplete: save.tutorialComplete,
      tutorialStep: save.tutorialStep ?? 0,
      diveCount: save.diveCount ?? 0,
      selectedInterests: save.selectedInterests ?? [],
      interestWeights: save.interestWeights ?? {},
    },
    knowledge: {
      version: 1,
      updatedAt: now,
      learnedFacts: save.learnedFacts,
      reviewStates: save.reviewStates,
      soldFacts: save.soldFacts ?? [],
      knowledgePoints: save.knowledgePoints ?? 0,
      purchasedKnowledgeItems: save.purchasedKnowledgeItems ?? [],
      studySessionsCompleted: save.studySessionsCompleted ?? 0,
    },
    inventory: {
      version: 1,
      updatedAt: now,
      minerals: save.minerals as Record<string, number>,
      craftedItems: save.craftedItems ?? {},
      craftCounts: save.craftCounts ?? {},
      activeConsumables: save.activeConsumables ?? [],
      consumables: save.consumables ?? {},
      ownedCosmetics: save.ownedCosmetics ?? [],
      equippedCosmetic: save.equippedCosmetic ?? null,
      unlockedDiscs: save.unlockedDiscs ?? [],
      premiumMaterials: save.premiumMaterials ?? {},
      purchasedDeals: save.purchasedDeals ?? [],
      lastDealDate: save.lastDealDate,
    },
    dome: {
      version: 1,
      updatedAt: now,
      unlockedRooms: save.unlockedRooms ?? [],
      hubState: save.hubState,
      farm: save.farm,
      fossils: save.fossils ?? {},
      activeCompanion: save.activeCompanion ?? null,
      activeFossil: save.activeFossil ?? null,
    },
    analytics: {
      version: 1,
      updatedAt: now,
      stats: save.stats,
      streakFreezes: save.streakFreezes ?? 0,
      lastStreakMilestone: save.lastStreakMilestone ?? 0,
      claimedMilestones: save.claimedMilestones ?? [],
      streakProtected: save.streakProtected ?? false,
      titles: save.titles ?? [],
      activeTitle: save.activeTitle ?? null,
      interestConfig: save.interestConfig,
      behavioralSignals: save.behavioralSignals,
      archetypeData: save.archetypeData,
      engagementData: save.engagementData,
      loginCalendarDay: save.loginCalendarDay,
      loginCalendarLastClaimed: save.loginCalendarLastClaimed,
      lastLoginDate: save.lastLoginDate,
      longestStreak: save.longestStreak,
      gracePeriodUsedAt: save.gracePeriodUsedAt,
      weeklyChallenge: save.weeklyChallenge,
    },
  }
}

// ============================================================
// MERGE
// ============================================================

/**
 * Merges 5 sub-documents back into a partial `PlayerSave` shape.
 *
 * The returned object can be spread over a base save or passed to the save
 * service after being cast. Fields that may be undefined in sub-documents
 * are preserved as-is so backward-compatibility logic in `saveService.load()`
 * can apply its usual defaults.
 *
 * @param docs - The five sub-documents to merge.
 * @returns A partial PlayerSave containing all sub-document fields.
 */
export function mergeSave(docs: SaveSubDocuments): Partial<PlayerSave> {
  // Strip the sub-doc metadata fields before merging
  const { version: _cv, updatedAt: _cu, ...coreFields } = docs.core
  const { version: _kv, updatedAt: _ku, ...knowledgeFields } = docs.knowledge
  const { version: _iv, updatedAt: _iu, ...inventoryFields } = docs.inventory
  const { version: _dv, updatedAt: _du, ...domeFields } = docs.dome
  const { version: _av, updatedAt: _au, ...analyticsFields } = docs.analytics

  return {
    ...coreFields,
    ...knowledgeFields,
    ...inventoryFields,
    ...domeFields,
    ...analyticsFields,
  } as Partial<PlayerSave>
}
