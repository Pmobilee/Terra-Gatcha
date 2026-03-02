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

/** Known valid leaderboard categories. */
const VALID_CATEGORIES: Set<string> = new Set([
  "deepest_dive",
  "facts_mastered",
  "longest_streak",
  "total_dust",
]);

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

  // ── GET /:category — top 50 ─────────────────────────────────────────────────

  /**
   * GET /api/leaderboards/:category
   * Returns the top 50 entries for the given category.
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

      // Get top scores per user (best score per user, not per submission)
      // Use a subquery approach: for each user, take their max score.
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
        .limit(TOP_N)
        .all();

      // Deduplicate: keep only the best score per user
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

      return result;
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
      const id = crypto.randomUUID();

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

      await db.insert(leaderboards).values({
        id,
        userId,
        category,
        score: Math.floor(score),
        metadata: serialisedMeta,
        createdAt: now,
      });

      // Compute rank for the submitted score
      const higherCount = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${leaderboards.userId})` })
        .from(leaderboards)
        .where(
          sql`${leaderboards.category} = ${category} AND ${leaderboards.score} > ${Math.floor(score)}`
        )
        .get();

      const rank = (higherCount?.count ?? 0) + 1;

      const user = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, userId))
        .get();

      const result: LeaderboardEntry = {
        id,
        userId,
        displayName: user?.displayName ?? null,
        category,
        score: Math.floor(score),
        metadata: metadata ?? null,
        createdAt: now,
        rank,
      };
      return reply.status(201).send(result);
    }
  );
}
