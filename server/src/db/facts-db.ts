/**
 * Separate SQLite connection for the facts content database.
 * Kept separate from the user/saves database so facts can be
 * deployed, updated, and backed up independently.
 */

import Database, { type Database as BetterSqliteDatabase } from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";
import * as url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FACTS_DB_PATH = path.resolve(__dirname, "../../data/facts.db");

fs.mkdirSync(path.dirname(FACTS_DB_PATH), { recursive: true });

/**
 * Raw better-sqlite3 Database instance for the facts content database.
 * Use this for all facts-related database operations throughout the application.
 */
export const factsDb: BetterSqliteDatabase = new Database(FACTS_DB_PATH);
factsDb.pragma("journal_mode = WAL");
factsDb.pragma("foreign_keys = ON");
