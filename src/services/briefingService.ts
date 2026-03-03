import type { PlayerSave } from '../data/types'

/**
 * Returns true if the daily briefing should be shown.
 * Briefing shows once per calendar day.
 *
 * @param save - The current player save state.
 * @returns `true` if the briefing has not yet been shown today.
 */
export function shouldShowBriefing(save: PlayerSave): boolean {
  const today = new Date().toISOString().split('T')[0]
  return save.hubState.lastBriefingDate !== today
}
