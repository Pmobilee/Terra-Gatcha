/**
 * Migration runner for the Terra Gacha database.
 * Applies all pending Drizzle ORM migrations to the SQLite database.
 *
 * Run via: npm run migrate
 * This file is safe to import — it only runs migrations when invoked directly.
 */

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as path from "path";
import * as url from "url";
import { db, sqliteDb } from "./index.js";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsFolder = path.resolve(__dirname, "../../drizzle");

/**
 * Initialise the database tables directly from the inline schema DDL.
 * Idempotent — uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.
 * Called at server startup when Drizzle migration files are not yet present.
 */
export function initSchema(): void {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saves (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      save_data TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leaderboards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      score INTEGER NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_saves_user_id ON saves(user_id);
    CREATE INDEX IF NOT EXISTS idx_saves_created_at ON saves(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_leaderboards_category ON leaderboards(category);
    CREATE INDEX IF NOT EXISTS idx_leaderboards_score ON leaderboards(score DESC);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
  `);
  console.log("[db] Schema initialised.");
}

/**
 * Run all pending Drizzle ORM migrations from the drizzle/ folder.
 * Safe to run multiple times; already-applied migrations are skipped.
 * Closes the database connection after completing or on failure.
 */
async function runMigrations(): Promise<void> {
  console.log(`[migrate] Running migrations from: ${migrationsFolder}`);
  try {
    migrate(db, { migrationsFolder });
    console.log("[migrate] All migrations applied successfully.");
  } catch (err) {
    console.error("[migrate] Migration failed:", err);
    process.exit(1);
  } finally {
    sqliteDb.close();
  }
}

// Only execute when this file is the direct entry point (not when imported).
// Detect by comparing the resolved file path to process.argv[1].
const isMain =
  process.argv[1] !== undefined &&
  (path.resolve(process.argv[1]) === __filename ||
    // Also handle the compiled dist/ path
    path.resolve(process.argv[1]) === __filename.replace("/src/", "/dist/").replace(".ts", ".js"));

if (isMain) {
  runMigrations().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
