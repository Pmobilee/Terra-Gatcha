import { writable, derived } from 'svelte/store'
import { profileService } from '../../services/profileService'
import type { PlayerProfile } from '../../data/profileTypes'

const _profiles = writable<PlayerProfile[]>(profileService.getProfiles())
const _activeId = writable<string | null>(profileService.getActiveId())

/**
 * Reactive store for all player profiles on the device.
 * Use `profileStore.refresh()` after any mutation via profileService to sync state.
 */
export const profileStore = {
  subscribe: _profiles.subscribe,
  activeId: { subscribe: _activeId.subscribe },

  /** Re-reads profiles and activeId from profileService and updates the store. */
  refresh() {
    _profiles.set(profileService.getProfiles())
    _activeId.set(profileService.getActiveId())
  },

  /** Sets the active profile and updates the store. */
  setActive(id: string) {
    profileService.setActiveProfile(id)
    _activeId.set(id)
  },
}

/** Derived store: the currently active PlayerProfile, or null. */
export const activeProfile = derived(
  [_profiles, _activeId],
  ([$profiles, $id]) => $profiles.find(p => p.id === $id) ?? null,
)

/** Derived store: true when at least one profile exists. */
export const hasProfiles = derived(_profiles, ($p) => $p.length > 0)
