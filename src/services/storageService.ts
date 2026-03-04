/**
 * @file storageService.ts
 * Storage abstraction layer — currently backed by localStorage.
 *
 * This wrapper is designed so the underlying store can be swapped to
 * IndexedDB (via idb-keyval) without touching call sites. All read/write
 * operations are synchronous in the localStorage implementation; the idb-keyval
 * replacement will make them async (Promise-returning), which is why callers
 * should treat this as an opaque dependency rather than calling localStorage
 * directly (DD-V2-182).
 *
 * Migration plan:
 *   1. Replace `localStorage.*` calls inside each method with `await idb.*`.
 *   2. Change method signatures to return `Promise<T | null>` / `Promise<void>`.
 *   3. Update all call sites to `await storageService.*`.
 */

// ============================================================
// STORAGE SERVICE CLASS
// ============================================================

/**
 * Thin localStorage wrapper with typed get/set, raw string access, and
 * a has() check. Safe to call in SSR contexts — all methods guard against
 * a missing `localStorage` global.
 */
export class StorageService {
  /**
   * Retrieves and JSON-parses a stored value.
   *
   * @param key - The storage key to read.
   * @returns The parsed value, or `null` if the key does not exist or parsing fails.
   */
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key)
      return raw !== null ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  }

  /**
   * JSON-serialises and stores a value.
   *
   * @param key - The storage key to write.
   * @param value - The value to serialise and store.
   */
  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value))
  }

  /**
   * Removes a key from storage.
   *
   * @param key - The key to remove.
   */
  remove(key: string): void {
    localStorage.removeItem(key)
  }

  /**
   * Returns `true` when the key exists in storage (value may be `null`).
   *
   * @param key - The key to check.
   */
  has(key: string): boolean {
    return localStorage.getItem(key) !== null
  }

  /**
   * Reads the raw string value without JSON parsing.
   * Useful for values that are already strings (e.g. timestamps stored as
   * plain numbers, auth tokens).
   *
   * @param key - The key to read.
   * @returns The raw string, or `null` if absent.
   */
  getRaw(key: string): string | null {
    return localStorage.getItem(key)
  }

  /**
   * Writes a raw string without JSON serialisation.
   *
   * @param key - The key to write.
   * @param value - The raw string to store.
   */
  setRaw(key: string, value: string): void {
    localStorage.setItem(key, value)
  }
}

// ============================================================
// SINGLETON
// ============================================================

/** Shared storage service instance. Prefer this over direct localStorage access. */
export const storageService = new StorageService()
