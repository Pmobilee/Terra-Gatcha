import type { PlayerSave, ReviewState } from '../data/types'

/**
 * Compute a study score (0.0 to 1.0) from the player's learning habits.
 * Higher scores = more diligent study = better artifact rewards.
 */
export function computeStudyScore(save: PlayerSave): number {
  const totalLearned = save.learnedFacts.length
  if (totalLearned === 0) return 0.5 // New player, neutral score

  const now = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

  // Mastery ratio: facts with interval >= 21 days
  const masteredFacts = save.reviewStates.filter(
    (rs: ReviewState) => rs.interval >= 21,
  ).length
  const masteryRatio = masteredFacts / Math.max(totalLearned, 1)

  // Review debt: overdue facts
  const reviewedFacts = save.reviewStates.filter(
    (rs: ReviewState) => rs.repetitions > 0,
  )
  const overdueFacts = reviewedFacts.filter((rs: ReviewState) => {
    const nextReview = rs.lastReviewAt + rs.interval * 24 * 60 * 60 * 1000
    return nextReview < now
  }).length
  const totalDue = Math.max(reviewedFacts.length, 1)
  const debtRatio = 1 - Math.min(overdueFacts / totalDue, 1)

  // Recent study sessions (last 7 days)
  const timestamps = save.lastStudySessionTimestamps ?? []
  const recentSessions = timestamps.filter((t: number) => t > sevenDaysAgo).length
  const engagementRatio = Math.min(recentSessions / 5, 1)

  const score = masteryRatio * 0.3 + debtRatio * 0.4 + engagementRatio * 0.3
  return Math.max(0, Math.min(1, score))
}

/**
 * Returns a study tier label based on score and total learned facts.
 */
export function getStudyScoreTier(
  score: number,
  totalLearned: number,
): 'diligent' | 'average' | 'neglectful' | 'new_player' {
  if (totalLearned === 0) return 'new_player'
  if (score >= 0.7) return 'diligent'
  if (score >= 0.3) return 'average'
  return 'neglectful'
}
