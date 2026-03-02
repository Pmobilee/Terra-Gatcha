/**
 * @file syncService.ts
 * Coordinates local localStorage saves with the backend cloud save and
 * leaderboard endpoints via `apiClient`.
 *
 * Design goals:
 * - Silent failures: network/auth errors are logged to the console only — they
 *   must never interrupt gameplay.
 * - Debounced uploads: no more than one upload per `SYNC_DEBOUNCE_MS` window.
 * - Conflict resolution: the save with the higher `lastPlayedAt` timestamp wins.
 * - Leaderboard submissions: derived automatically from a PlayerSave on every
 *   successful push to the cloud.
 */

import { apiClient } from './apiClient'
import { load as loadLocalSave } from './saveService'
import type { PlayerSave } from '../data/types'

// ============================================================
// CONSTANTS
// ============================================================

/** Minimum milliseconds between successive upload attempts (30 seconds). */
const SYNC_DEBOUNCE_MS = 30_000

/** localStorage key used to persist the last-successful-sync timestamp. */
const LAST_SYNC_KEY = 'terra_last_sync_time'

// ============================================================
// LEADERBOARD CATEGORY EXTRACTORS
// ============================================================

/**
 * Maps a leaderboard category identifier to the corresponding numeric value
 * extracted from a `PlayerSave`.
 */
const LEADERBOARD_EXTRACTORS: Record<string, (s: PlayerSave) => number> = {
  deepest_layer: (s) => s.stats.deepestLayerReached,
  total_dives: (s) => s.stats.totalDivesCompleted,
  total_facts: (s) => s.stats.totalFactsLearned,
  total_blocks_mined: (s) => s.stats.totalBlocksMined,
  best_streak: (s) => s.stats.bestStreak,
}

// ============================================================
// SYNC SERVICE
// ============================================================

/**
 * Manages synchronisation between the local save stored in localStorage and
 * the authenticated user's cloud save on the backend.
 *
 * Use the exported `syncService` singleton — do not instantiate directly.
 *
 * @example
 * ```ts
 * import { syncService } from './syncService'
 *
 * // After each local save:
 * await syncService.syncAfterSave(updatedSave)
 *
 * // Manual pull at game launch:
 * const cloudSave = await syncService.pullFromCloud()
 * ```
 */
export class SyncService {
  private _isSyncing: boolean = false
  private _lastSyncTime: number | null = null
  private _lastUploadAttempt: number = 0
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this._lastSyncTime = this.readLastSyncTime()
  }

  // ----------------------------------------------------------
  // PUBLIC ACCESSORS
  // ----------------------------------------------------------

  /** `true` while an upload or download is in progress. */
  get isSyncing(): boolean {
    return this._isSyncing
  }

  /**
   * Unix timestamp (ms) of the last successful cloud sync, or `null` if a
   * sync has never completed in this browser context.
   */
  get lastSyncTime(): number | null {
    return this._lastSyncTime
  }

  /**
   * `true` when `navigator.onLine` reports an active network connection.
   * Always returns `true` in environments where `navigator` is unavailable
   * (e.g. unit-test runtimes), so the call site should handle offline
   * gracefully rather than hard-blocking on this flag.
   */
  get isOnline(): boolean {
    if (typeof navigator === 'undefined') return true
    return navigator.onLine
  }

  // ----------------------------------------------------------
  // AUTO-SYNC
  // ----------------------------------------------------------

  /**
   * Schedules a cloud upload after a local save, honouring the debounce window.
   *
   * Call this immediately after every `save()` from `saveService`. If the user
   * is not logged in or is offline the call is a no-op. Errors are swallowed
   * so gameplay is never interrupted.
   *
   * @param localSave - The just-persisted `PlayerSave` object.
   */
  async syncAfterSave(localSave: PlayerSave): Promise<void> {
    if (!apiClient.isLoggedIn() || !this.isOnline) return

    const now = Date.now()
    const msSinceLastAttempt = now - this._lastUploadAttempt

    if (msSinceLastAttempt < SYNC_DEBOUNCE_MS) {
      // Debounce: schedule a deferred upload for when the window expires.
      if (this._debounceTimer !== null) {
        clearTimeout(this._debounceTimer)
      }
      const delay = SYNC_DEBOUNCE_MS - msSinceLastAttempt
      this._debounceTimer = setTimeout(() => {
        this._debounceTimer = null
        void this.performUpload(localSave)
      }, delay)
      return
    }

    await this.performUpload(localSave)
  }

  // ----------------------------------------------------------
  // MANUAL SYNC
  // ----------------------------------------------------------

  /**
   * Pulls the cloud save and returns it (or `null` if none exists).
   *
   * The caller is responsible for deciding whether to apply the cloud save
   * (e.g. by comparing `lastPlayedAt` against the local save). Errors are
   * swallowed — the method returns `null` on any failure so callers do not
   * need to handle exceptions.
   *
   * @returns The cloud `PlayerSave`, or `null` on failure/no save.
   */
  async pullFromCloud(): Promise<PlayerSave | null> {
    if (!apiClient.isLoggedIn()) return null
    if (!this.isOnline) return null

    this._isSyncing = true
    try {
      const remote = await apiClient.downloadSave()
      return remote
    } catch (err) {
      console.warn('[SyncService] pullFromCloud failed:', err)
      return null
    } finally {
      this._isSyncing = false
    }
  }

  /**
   * Reads the current local save from localStorage and uploads it to the cloud.
   *
   * Errors are swallowed and logged to the console only.
   */
  async pushToCloud(): Promise<void> {
    if (!apiClient.isLoggedIn()) return
    if (!this.isOnline) return

    const localSave = loadLocalSave()
    if (localSave === null) return

    await this.performUpload(localSave)
  }

  // ----------------------------------------------------------
  // CONFLICT RESOLUTION
  // ----------------------------------------------------------

  /**
   * Chooses the authoritative save when local and remote copies differ.
   *
   * **Rule**: whichever save has the higher `lastPlayedAt` value wins. In the
   * case of a tie the local save is preferred to avoid unnecessary writes.
   *
   * @param local - The save currently stored in localStorage.
   * @param remote - The save downloaded from the cloud.
   * @returns The save that should be treated as the source of truth.
   */
  async resolveConflict(local: PlayerSave, remote: PlayerSave): Promise<PlayerSave> {
    if (remote.lastPlayedAt > local.lastPlayedAt) {
      return remote
    }
    return local
  }

  // ----------------------------------------------------------
  // INTERNALS
  // ----------------------------------------------------------

  /**
   * Uploads `saveData` to the cloud and submits derived leaderboard scores.
   * Sets `_lastUploadAttempt` before the network call so the debounce window
   * is respected even when the request fails.
   *
   * @param saveData - The `PlayerSave` to upload.
   */
  private async performUpload(saveData: PlayerSave): Promise<void> {
    this._lastUploadAttempt = Date.now()
    this._isSyncing = true

    try {
      await apiClient.uploadSave(saveData)
      this._lastSyncTime = Date.now()
      this.writeLastSyncTime(this._lastSyncTime)
      await this.submitLeaderboardScores(saveData)
    } catch (err) {
      console.warn('[SyncService] performUpload failed:', err)
    } finally {
      this._isSyncing = false
    }
  }

  /**
   * Iterates over all known leaderboard categories and submits the player's
   * current score for each one. Failures are logged and do not propagate.
   *
   * @param saveData - The `PlayerSave` to extract scores from.
   */
  private async submitLeaderboardScores(saveData: PlayerSave): Promise<void> {
    for (const [category, extractor] of Object.entries(LEADERBOARD_EXTRACTORS)) {
      try {
        const score = extractor(saveData)
        if (score > 0) {
          await apiClient.submitScore(category, score)
        }
      } catch (err) {
        console.warn(`[SyncService] submitScore(${category}) failed:`, err)
      }
    }
  }

  /**
   * Reads the last-sync timestamp from localStorage.
   * Returns `null` when no timestamp has ever been stored.
   */
  private readLastSyncTime(): number | null {
    const raw = localStorage.getItem(LAST_SYNC_KEY)
    if (raw === null) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }

  /**
   * Persists the last-sync timestamp to localStorage.
   *
   * @param time - Unix timestamp in milliseconds.
   */
  private writeLastSyncTime(time: number): void {
    localStorage.setItem(LAST_SYNC_KEY, String(time))
  }
}

// ============================================================
// SINGLETON
// ============================================================

/** Shared sync service instance. Import and use this directly in components and GameManager. */
export const syncService = new SyncService()
