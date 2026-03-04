/**
 * Analytics ingestion routes for the Terra Gacha server.
 * Accepts batched event payloads from game clients and persists them
 * to the analytics_events table for later querying.
 *
 * No authentication is required — events are identified by session ID only.
 * The route performs strict validation to reject malformed or oversized batches.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as crypto from "crypto";
import { db } from "../db/index.js";
import { analyticsEvents } from "../db/schema.js";

// ── Constants ──────────────────────────────────────────────────────────────────

/** Event names that the server will accept. Any other name is rejected. */
const ALLOWED_EVENTS = new Set([
  "app_open",
  "tutorial_step_complete",
  "first_dive_complete",
  "quiz_answered",
  "fact_mastered",
  "fossil_revived",
  "session_end",
  "purchase_initiated",
  "churn_signal",
  "engagement_score_change",
]);

/** Property keys that must never appear in analytics payloads (PII). */
const PII_FIELDS = new Set([
  "email",
  "password",
  "displayname",
  "name",
]);

/** Maximum number of events allowed in a single POST request. */
const MAX_BATCH_SIZE = 50;

/** UUID v4 validation regex. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── Types ──────────────────────────────────────────────────────────────────────

/** Shape of an individual analytics event from the client. */
interface IncomingEvent {
  name: string;
  properties: Record<string, unknown>;
}

/** Shape of the POST /events request body. */
interface AnalyticsBody {
  sessionId: string;
  events: IncomingEvent[];
}

// ── Route plugin ───────────────────────────────────────────────────────────────

/**
 * Register analytics ingestion routes on the Fastify instance.
 * All routes are prefixed with /api/analytics by the calling index.ts.
 *
 * @param fastify - The Fastify application instance.
 */
export async function analyticsRoutes(
  fastify: FastifyInstance
): Promise<void> {
  /**
   * POST /api/analytics/events
   *
   * Accepts a batch of client-side analytics events and persists them.
   * Validates:
   *   - sessionId is a valid UUID v4
   *   - events is a non-empty array of at most MAX_BATCH_SIZE items
   *   - each event.name is in the ALLOWED_EVENTS whitelist
   *   - no event properties contain PII field keys
   *
   * Returns: { accepted: number } — count of events stored.
   */
  fastify.post(
    "/events",
    async (
      request: FastifyRequest<{ Body: AnalyticsBody }>,
      reply: FastifyReply
    ) => {
      const body = request.body as Partial<AnalyticsBody> | null | undefined;
      const { sessionId, events } = body ?? {};

      // ── Validate sessionId ───────────────────────────────────────────────────
      if (!sessionId || !UUID_RE.test(sessionId)) {
        return reply
          .status(400)
          .send({ error: "Invalid sessionId — must be UUID v4" });
      }

      // ── Validate events array ─────────────────────────────────────────────────
      if (!Array.isArray(events) || events.length === 0) {
        return reply
          .status(400)
          .send({ error: "events must be a non-empty array" });
      }
      if (events.length > MAX_BATCH_SIZE) {
        return reply
          .status(400)
          .send({ error: `Max ${MAX_BATCH_SIZE} events per batch` });
      }

      // ── Validate individual events ────────────────────────────────────────────
      for (const event of events) {
        if (typeof event.name !== "string" || !ALLOWED_EVENTS.has(event.name)) {
          return reply
            .status(400)
            .send({ error: `Unknown event name: ${String(event.name)}` });
        }

        if (event.properties && typeof event.properties === "object") {
          for (const key of Object.keys(event.properties)) {
            if (PII_FIELDS.has(key.toLowerCase())) {
              return reply
                .status(400)
                .send({ error: `PII field "${key}" not allowed in analytics` });
            }
          }
        }
      }

      // ── Persist events ────────────────────────────────────────────────────────
      const now = Date.now();
      // Extract platform / app_version from the first event when available.
      const firstProps = events[0]?.properties as
        | Record<string, unknown>
        | undefined;
      const platform =
        typeof firstProps?.platform === "string" ? firstProps.platform : null;
      const appVersion =
        typeof firstProps?.app_version === "string"
          ? firstProps.app_version
          : null;

      for (const event of events) {
        await db.insert(analyticsEvents).values({
          id: crypto.randomUUID(),
          sessionId,
          eventName: event.name,
          properties: JSON.stringify(event.properties ?? {}),
          platform,
          appVersion,
          createdAt: now,
        });
      }

      return reply.status(200).send({ accepted: events.length });
    }
  );
}
