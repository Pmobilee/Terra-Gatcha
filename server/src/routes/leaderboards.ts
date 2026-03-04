/**
 * Leaderboard routes for the Terra Gacha server.
 * Supports fetching top-50 per category and submitting scores.
 * Score submission and "my rankings" require JWT authentication.
 */

import type {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  RouteShorthandOptions,
} from "fastify";
import * as crypto from "crypto";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { leaderboards, users } from "../db/schema.js";
import { requireAuth, getAuthUser } from "../middleware/auth.js";
import type {
  LeaderboardEntry,
  LeaderboardCategory,
  MyRanking,
} from "../types/index.js";

/** Maximum entries returned for a category leaderboard. */
const TOP_N = 50;

/** Maximum entries stored in the in-memory LRU cache per category. */
const CACHE_TOP_N = 100;

/** LRU cache TTL in milliseconds (60 seconds). */
const CACHE_TTL_MS = 60_000;

/** Known valid leaderboard categories. */
const VALID_CATEGORIES: Set<string> = new Set([
  "deepest_dive",
  "facts_mastered",
  "longest_streak",
  "total_dust",
]);

// ── In-memory LRU cache ───────────────────────────────────────────────────────

/**
 * A single cache entry holding the cached result and its expiry timestamp.
 */
interface CacheEntry {
  data: LeaderboardEntry[];
  expiresAt: number;
}

/**
 * Minimal LRU cache for top-100 leaderboard results per category.
 * Evicts the least-recently-used entry when the capacity is exceeded.
 * Each entry expires after CACHE_TTL_MS milliseconds.
 *
 * Using a Map preserves insertion order; moving an accessed key to the end
 * (delete + re-insert) implements the LRU eviction policy in O(1).
 */
class LeaderboardLruCache {
  private readonly capacity: number;
  private readonly store = new Map<string, CacheEntry>();

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  /** Retrieve a cached result for `category`, or null if missing/expired. */
  get(category: string): LeaderboardEntry[] | null {
    const entry = this.store.get(category);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(category);
      return null;
    }
    // Move to most-recently-used position
    this.store.delete(category);
    this.store.set(category, entry);
    return entry.data;
  }

  /** Store a result for `category`. Evicts the LRU entry if at capacity. */
  set(category: string, data: LeaderboardEntry[]): void {
    if (this.store.has(category)) {
      this.store.delete(category);
    } else if (this.store.size >= this.capacity) {
      // Evict the oldest (first) key
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) this.store.delete(firstKey);
    }
    this.store.set(category, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  /** Invalidate the cache entry for `category` (call after a score upsert). */
  invalidate(category: string): void {
    this.store.delete(category);
  }
}

/** Singleton cache — shared across all requests in this process. */
const leaderboardCache = new LeaderboardLruCache(VALID_CATEGORIES.size + 10);

const withAuth: RouteShorthandOptions = { preHandler: requireAuth };

/**
 * Validate a leaderboard category string.
 * Allows known categories and rejects unknown ones to prevent spam.
 *
 * @param category - The category string from the URL parameter.
 * @returns True if the category is valid.
 */
function isValidCategory(category: string): boolean {
  return VALID_CATEGORIES.has(category);
}

/**
 * Safely parse a JSON string, returning null on failure.
 *
 * @param str - A string that may contain JSON.
 * @returns The parsed value, or null if parsing fails.
 */
function tryParseJson(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Register leaderboard routes on the Fastify instance.
 * All routes are prefixed with /api/leaderboards by the calling index.ts.
 *
 * @param fastify - The Fastify application instance.
 */
export async function leaderboardRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /me — user's own rankings ───────────────────────────────────────────

  /**
   * GET /api/leaderboards/me
   * Returns the authenticated user's best score and rank in every category.
   * Route registered before /:category to avoid the param catching "me".
   */
  fastify.get(
    "/me",
    withAuth,
    async (request: FastifyRequest): Promise<MyRanking[]> => {
      const { sub: userId } = getAuthUser(request);

      const results: MyRanking[] = [];

      for (const category of VALID_CATEGORIES) {
        // Get this user's best score in the category
        const myBest = await db
          .select({ score: leaderboards.score })
          .from(leaderboards)
          .where(
            sql`${leaderboards.userId} = ${userId} AND ${leaderboards.category} = ${category}`
          )
          .orderBy(desc(leaderboards.score))
          .limit(1)
          .get();

        if (!myBest) {
          results.push({ category, score: 0, rank: null });
          continue;
        }

        // Count how many distinct users have a higher score
        const higherCount = await db
          .select({ count: sql<number>`COUNT(DISTINCT ${leaderboards.userId})` })
          .from(leaderboards)
          .where(
            sql`${leaderboards.category} = ${category} AND ${leaderboards.score} > ${myBest.score}`
          )
          .get();

        const rank = (higherCount?.count ?? 0) + 1;

        results.push({ category, score: myBest.score, rank });
      }

      return results;
    }
  );

  // ── GET /:category — top 50 (cached) ────────────────────────────────────────

  /**
   * GET /api/leaderboards/:category
   * Returns the top 50 entries for the given category.
   * Results are served from an in-memory LRU cache (60-second TTL, top-100
   * entries per category) to reduce database load under read traffic.
   * Public endpoint — no authentication required.
   */
  fastify.get(
    "/:category",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { category: string };
      const { category } = params;

      if (!isValidCategory(category)) {
        return reply.status(400).send({
          error: `Unknown category. Valid: ${[...VALID_CATEGORIES].join(", ")}`,
          statusCode: 400,
        });
      }

      // Try the LRU cache first (avoids a DB query for 60 seconds after each write)
      const cached = leaderboardCache.get(category);
      if (cached !== null) {
        // Slice to TOP_N in case the cache holds the full CACHE_TOP_N
        return cached.slice(0, TOP_N);
      }

      // Cache miss — query the database.
      // Fetch CACHE_TOP_N rows so the cache can serve any slice up to that limit.
      const rows = await db
        .select({
          id: leaderboards.id,
          userId: leaderboards.userId,
          displayName: users.displayName,
          category: leaderboards.category,
          score: leaderboards.score,
          metadata: leaderboards.metadata,
          createdAt: leaderboards.createdAt,
        })
        .from(leaderboards)
        .leftJoin(users, eq(leaderboards.userId, users.id))
        .where(eq(leaderboards.category, category as LeaderboardCategory))
        .orderBy(desc(leaderboards.score))
        .limit(CACHE_TOP_N)
        .all();

      // Deduplicate: keep only the best score per user (one row per user_id
      // guaranteed by the upsert on write, but guard here for legacy data).
      const seen = new Set<string>();
      const deduped: typeof rows = [];
      for (const row of rows) {
        if (!seen.has(row.userId)) {
          seen.add(row.userId);
          deduped.push(row);
        }
      }

      const result: LeaderboardEntry[] = deduped.map((row, index) => ({
        id: row.id,
        userId: row.userId,
        displayName: row.displayName ?? null,
        category: row.category,
        score: row.score,
        metadata: row.metadata ? tryParseJson(row.metadata) : null,
        createdAt: row.createdAt,
        rank: index + 1,
      }));

      // Populate the cache for subsequent requests
      leaderboardCache.set(category, result);

      return result.slice(0, TOP_N);
    }
  );

  // ── POST /:category — submit score ──────────────────────────────────────────

  /**
   * POST /api/leaderboards/:category
   * Submit a new score for the authenticated user in the given category.
   * Body: { score: number, metadata?: object }
   */
  fastify.post(
    "/:category",
    withAuth,
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { category: string };
      const { category } = params;
      const { sub: userId } = getAuthUser(request);

      const body = request.body as Record<string, unknown> | null | undefined;
      const score = body?.score;
      const metadata = body?.metadata;

      if (!isValidCategory(category)) {
        return reply.status(400).send({
          error: `Unknown category. Valid: ${[...VALID_CATEGORIES].join(", ")}`,
          statusCode: 400,
        });
      }

      if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
        return reply.status(400).send({
          error: "score must be a non-negative finite number",
          statusCode: 400,
        });
      }

      if (
        metadata !== undefined &&
        (typeof metadata !== "object" ||
          Array.isArray(metadata) ||
          metadata === null)
      ) {
        return reply.status(400).send({
          error: "metadata must be a JSON object if provided",
          statusCode: 400,
        });
      }

      const now = Date.now();
      const flooredScore = Math.floor(score);

      let serialisedMeta: string | null = null;
      if (metadata !== undefined) {
        try {
          serialisedMeta = JSON.stringify(metadata);
        } catch {
          return reply.status(400).send({
            error: "metadata is not serialisable",
            statusCode: 400,
          });
        }
      }

      // ── Upsert: one row per (userId, category) ────────────────────────────
      // Check if the user already has an entry for this category.
      // If they do, update only when the new score is strictly higher.
      // This prevents duplicate leaderboard entries and keeps the best score.
      //
      // SQLite equivalent of INSERT ... ON CONFLICT DO UPDATE SET ...
      // We implement this with a manual check+update rather than raw SQL so
      // that Drizzle's type system stays intact.
      const existingEntry = await db
        .select({ id: leaderboards.id, score: leaderboards.score })
        .from(leaderboards)
        .where(
          sql`${leaderboards.userId} = ${userId} AND ${leaderboards.category} = ${category}`
        )
        .get();

      let entryId: string;
      let entryCreatedAt: number;

      if (existingEntry) {
        entryId = existingEntry.id;
        // Only update if the new score is strictly higher (keep personal best)
        if (flooredScore > existingEntry.score) {
          await db
            .update(leaderboards)
            .set({ score: flooredScore, metadata: serialisedMeta })
            .where(eq(leaderboards.id, existingEntry.id));
          // Invalidate the cache so the next read reflects the updated score
          leaderboardCache.invalidate(category);
        }
        entryCreatedAt = now;
      } else {
        // New entry — insert fresh row
        entryId = crypto.randomUUID();
        entryCreatedAt = now;
        await db.insert(leaderboards).values({
          id: entryId,
          userId,
          category,
          score: flooredScore,
          metadata: serialisedMeta,
          createdAt: now,
        });
        // Invalidate the cache for this category
        leaderboardCache.invalidate(category);
      }

      // Compute rank for the submitted score
      const higherCount = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${leaderboards.userId})` })
        .from(leaderboards)
        .where(
          sql`${leaderboards.category} = ${category} AND ${leaderboards.score} > ${flooredScore}`
        )
        .get();

      const rank = (higherCount?.count ?? 0) + 1;

      const user = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, userId))
        .get();

      // Return the effective score (the actual best stored, which may be unchanged)
      const effectiveScore = existingEntry && existingEntry.score > flooredScore
        ? existingEntry.score
        : flooredScore;

      const result: LeaderboardEntry = {
        id: entryId,
        userId,
        displayName: user?.displayName ?? null,
        category,
        score: effectiveScore,
        metadata: metadata ?? null,
        createdAt: entryCreatedAt,
        rank,
      };
      return reply.status(201).send(result);
    }
  );
}
