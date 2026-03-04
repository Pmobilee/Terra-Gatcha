/**
 * Data Deletion Service (DD-V2-229)
 *
 * Implements GDPR Article 17: Right to Erasure.
 * 30-day soft-delete period, then permanent purge.
 *
 * Design notes:
 * - Soft-delete sets `is_deleted=1` and `deleted_at` on the user row.
 * - Leaderboard entries are anonymised immediately on deletion request so no
 *   personal data is ever visible to other players after account deletion.
 * - Full purge (hard-delete) runs asynchronously; call `purgeDeletedUsers` from
 *   a scheduled job (e.g. cron or a startup background task).
 */

/** Number of milliseconds in 30 days — the soft-delete grace period. */
const SOFT_DELETE_GRACE_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Anonymise a user's public-facing leaderboard data immediately on deletion.
 * Sets `display_name` inside the `metadata` JSON column to "Deleted User" so
 * that the entry is still counted in rankings but is no longer identifiable.
 *
 * @param db     - The raw better-sqlite3 Database instance.
 * @param userId - The user's UUID.
 */
export function anonymizeLeaderboardEntries(db: unknown, userId: string): void {
  const database = db as {
    prepare: (sql: string) => { run: (...args: unknown[]) => void }
  }
  database
    .prepare(
      `UPDATE leaderboards
          SET metadata = json_set(COALESCE(metadata, '{}'), '$.display_name', 'Deleted User')
        WHERE user_id = ?`
    )
    .run(userId)
}

/**
 * Permanently purge all users that were soft-deleted more than 30 days ago.
 * Deletes all associated saves, leaderboard entries, refresh tokens, and
 * analytics events before removing the user row itself.
 *
 * Safe to call at any time — performs a no-op if no users are due for purge.
 *
 * @param db - The raw better-sqlite3 Database instance.
 * @returns The number of user accounts permanently deleted.
 */
export function purgeDeletedUsers(db: unknown): { purgedCount: number } {
  const database = db as {
    prepare: (sql: string) => {
      run: (...args: unknown[]) => { changes: number }
      all: (...args: unknown[]) => Array<Record<string, unknown>>
    }
  }
  const cutoff = Date.now() - SOFT_DELETE_GRACE_MS

  // Find users past the grace period
  const deletedUsers = database
    .prepare(`SELECT id FROM users WHERE is_deleted = 1 AND deleted_at < ?`)
    .all(cutoff) as Array<{ id: string }>

  if (deletedUsers.length === 0) return { purgedCount: 0 }

  for (const user of deletedUsers) {
    // Delete child records in dependency order before removing the user row.
    database.prepare('DELETE FROM saves WHERE user_id = ?').run(user.id)
    database.prepare('DELETE FROM leaderboards WHERE user_id = ?').run(user.id)
    database.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(user.id)
    // Analytics events reference user_id via the properties JSON blob.
    // Delete events where the serialised properties contain the user's ID.
    database
      .prepare(
        `DELETE FROM analytics_events
          WHERE session_id IN (
            SELECT session_id FROM analytics_events
             WHERE properties LIKE ?
          )`
      )
      .run(`%"user_id":"${user.id}"%`)
    // Finally remove the user record itself.
    database.prepare('DELETE FROM users WHERE id = ?').run(user.id)
  }

  return { purgedCount: deletedUsers.length }
}

/**
 * Return the deletion status for a user, including the projected purge date.
 *
 * @param db     - The raw better-sqlite3 Database instance.
 * @param userId - The user's UUID.
 * @returns Status object with `isDeleted`, `deletedAt`, and `purgeDate` fields.
 */
export function getDeletionStatus(
  db: unknown,
  userId: string
): { isDeleted: boolean; deletedAt: number | null; purgeDate: number | null } {
  const database = db as {
    prepare: (sql: string) => {
      get: (...args: unknown[]) => Record<string, unknown> | undefined
    }
  }
  const user = database
    .prepare('SELECT is_deleted, deleted_at FROM users WHERE id = ?')
    .get(userId)

  if (!user) return { isDeleted: false, deletedAt: null, purgeDate: null }

  const isDeleted = user.is_deleted === 1
  const deletedAt = user.deleted_at as number | null
  const purgeDate = deletedAt ? deletedAt + SOFT_DELETE_GRACE_MS : null

  return { isDeleted, deletedAt, purgeDate }
}
