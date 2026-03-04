/** Rolling engagement data — tracked per-day for 7-day average. */
export interface DailyEngagementSnapshot {
  date: string
  quizAccuracy: number
  diveCount: number
  avgLayerReached: number
}

/** Engagement tracking data stored in PlayerSave (never shown to player directly). */
export interface EngagementData {
  /** Last 7 daily snapshots (oldest to newest). Max 7 entries. */
  dailySnapshots: DailyEngagementSnapshot[]
  /** Last computed engagement score (0–100). Updated after each dive. */
  currentScore: number
  /** 'nurture' | 'normal' | 'challenge' based on currentScore thresholds. */
  mode: 'nurture' | 'normal' | 'challenge'
}

/** Default engagement data for new players. */
export const DEFAULT_ENGAGEMENT_DATA: EngagementData = {
  dailySnapshots: [],
  currentScore: 50,
  mode: 'normal',
}

/** Engagement score below this = nurture mode (easier distractors, more hints). */
const NURTURE_THRESHOLD = 50

/** Engagement score above this = challenge mode (harder distractors, fewer hints). */
const CHALLENGE_THRESHOLD = 85

/** Maximum number of daily snapshots to retain. */
const SNAPSHOT_WINDOW = 7

/**
 * Computes the weighted engagement score from a set of daily snapshots.
 * Three axes contribute equally (33% each):
 *  - Quiz accuracy: 7-day rolling average accuracy (0–1) × 100
 *  - Session frequency: avg dives/day relative to baseline of 2 dives/day
 *  - Depth progression: avg layer reached / 20 (max layers) × 100
 */
export function computeEngagementScore(snapshots: DailyEngagementSnapshot[]): number {
  if (snapshots.length === 0) return 50

  const avgAccuracy = snapshots.reduce((s, d) => s + d.quizAccuracy, 0) / snapshots.length
  const avgDives = snapshots.reduce((s, d) => s + d.diveCount, 0) / snapshots.length
  const avgLayer = snapshots.reduce((s, d) => s + d.avgLayerReached, 0) / snapshots.length

  const accuracyScore = Math.min(avgAccuracy * 100, 100)
  const frequencyScore = Math.min((avgDives / 2) * 100, 100)
  const depthScore = Math.min((avgLayer / 20) * 100, 100)

  return Math.round((accuracyScore + frequencyScore + depthScore) / 3)
}

/**
 * Determines engagement mode from a score.
 */
export function scoreToMode(score: number): 'nurture' | 'normal' | 'challenge' {
  if (score < NURTURE_THRESHOLD) return 'nurture'
  if (score > CHALLENGE_THRESHOLD) return 'challenge'
  return 'normal'
}

/**
 * Updates engagement data after a dive completes.
 * Upserts today's snapshot (accumulates if multiple dives per day).
 * Trims to last SNAPSHOT_WINDOW days.
 */
export function updateEngagementAfterDive(
  current: EngagementData,
  todayStr: string,
  diveAccuracy: number,
  layerReached: number,
): EngagementData {
  const snapshots = [...current.dailySnapshots]
  const todayIdx = snapshots.findIndex(s => s.date === todayStr)

  if (todayIdx >= 0) {
    const existing = snapshots[todayIdx]
    const newDiveCount = existing.diveCount + 1
    snapshots[todayIdx] = {
      date: todayStr,
      quizAccuracy: (existing.quizAccuracy * existing.diveCount + diveAccuracy) / newDiveCount,
      diveCount: newDiveCount,
      avgLayerReached: (existing.avgLayerReached * existing.diveCount + layerReached) / newDiveCount,
    }
  } else {
    snapshots.push({
      date: todayStr,
      quizAccuracy: diveAccuracy,
      diveCount: 1,
      avgLayerReached: layerReached,
    })
  }

  const trimmed = snapshots
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-SNAPSHOT_WINDOW)

  const newScore = computeEngagementScore(trimmed)
  return {
    dailySnapshots: trimmed,
    currentScore: newScore,
    mode: scoreToMode(newScore),
  }
}

/**
 * Returns the distractor difficulty tier to use for quiz question generation.
 */
export function getDistractorDifficulty(
  engagementData: EngagementData,
): 'easy' | 'medium' | 'hard' {
  switch (engagementData.mode) {
    case 'nurture': return 'easy'
    case 'challenge': return 'hard'
    default: return 'medium'
  }
}

/**
 * Returns a GAIA observation comment triggered when the player's mode changes.
 * Returns null if no significant change occurred.
 */
export function getEngagementGaiaComment(
  previousMode: 'nurture' | 'normal' | 'challenge',
  currentMode: 'nurture' | 'normal' | 'challenge',
): string | null {
  if (previousMode === currentMode) return null

  if (currentMode === 'challenge') {
    return "You're really getting the hang of this! The planet's archives are opening up."
  }
  if (currentMode === 'normal' && previousMode === 'nurture') {
    return "Solid progress. Your recall is sharpening."
  }
  if (currentMode === 'nurture') {
    return "Let's slow down a bit. Better to know a few things well than rush everything."
  }
  return null
}
