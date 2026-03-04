/**
 * PostgreSQL readiness module.
 *
 * Current state: SQLite (better-sqlite3) is the active database.
 * This module provides utilities for the planned PostgreSQL migration (DD-V2-209).
 *
 * Migration plan:
 * 1. Phase A: Dual-write (both SQLite and PostgreSQL, read from SQLite)
 * 2. Phase B: Dual-write (both, read from PostgreSQL)
 * 3. Phase C: PostgreSQL only
 *
 * The DATABASE_URL env var determines which driver to use.
 * When it starts with 'postgresql://', the app should use pg driver.
 */

/** Check if we should use PostgreSQL based on DATABASE_URL */
export function isPostgresUrl(url: string | undefined): boolean {
  return !!url && url.startsWith('postgresql://')
}

/** Placeholder for dual-write logic */
export function shouldDualWrite(): boolean {
  return false // Enable when migration begins
}

/** Placeholder for migration dry-run */
export function isDryRun(): boolean {
  return false
}
