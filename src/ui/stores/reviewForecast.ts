import { writable } from 'svelte/store'

/** Aggregated count of cards due in upcoming time windows. */
export interface ReviewForecast {
  today: number
  tomorrow: number
  thisWeek: number
}

/** Reactive store holding the current review forecast. */
export const reviewForecast = writable<ReviewForecast>({
  today: 0,
  tomorrow: 0,
  thisWeek: 0,
})

/**
 * Refreshes the review forecast based on current review states.
 * Call when entering the dome or on app startup.
 *
 * - `today`: cards due within the next 24 hours
 * - `tomorrow`: cards due within the next 48 hours
 * - `thisWeek`: cards due within the next 7 days
 *
 * @param reviewStates - Array of objects with a `nextReviewAt` timestamp (ms since epoch).
 */
export function refreshReviewForecast(reviewStates: Array<{ nextReviewAt: number }>): void {
  const now = Date.now()
  const DAY = 86400000

  const today = reviewStates.filter(rs => rs.nextReviewAt <= now + DAY).length
  const tomorrow = reviewStates.filter(rs => rs.nextReviewAt <= now + 2 * DAY).length
  const thisWeek = reviewStates.filter(rs => rs.nextReviewAt <= now + 7 * DAY).length

  reviewForecast.set({ today, tomorrow, thisWeek })
}
