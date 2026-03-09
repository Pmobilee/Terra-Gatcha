import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import * as crypto from "crypto";
import { sqliteDb } from "../db/index.js";
import { config } from "../config.js";

function ensureFeedbackTable(): void {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS feedback_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_id TEXT,
      feedback_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback_entries(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_feedback_account_id ON feedback_entries(account_id);
  `);
}

export async function feedbackRoutes(fastify: FastifyInstance): Promise<void> {
  ensureFeedbackTable();

  fastify.post(
    "/",
    async (
      request: FastifyRequest<{ Body: { userId?: string; accountId?: string | null; feedback?: string; timestamp?: number } }>,
      reply: FastifyReply,
    ) => {
      const body = request.body ?? {};
      const userId = typeof body.userId === "string" && body.userId.trim().length > 0 ? body.userId.trim() : "anonymous";
      const accountId = typeof body.accountId === "string" && body.accountId.trim().length > 0 ? body.accountId.trim() : null;
      const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
      if (feedback.length < 3) {
        return reply.status(400).send({ error: "Feedback must be at least 3 characters." });
      }
      if (feedback.length > 1200) {
        return reply.status(400).send({ error: "Feedback too long (max 1200 characters)." });
      }

      const id = crypto.randomUUID();
      const createdAt = typeof body.timestamp === "number" && Number.isFinite(body.timestamp)
        ? Math.max(0, Math.floor(body.timestamp))
        : Date.now();

      sqliteDb
        .prepare(
          `INSERT INTO feedback_entries (id, user_id, account_id, feedback_text, status, created_at)
           VALUES (?, ?, ?, ?, 'new', ?)`,
        )
        .run(id, userId, accountId, feedback, createdAt);

      return reply.status(201).send({ id, accepted: true });
    },
  );

  fastify.get(
    "/",
    async (
      request: FastifyRequest<{ Querystring: { limit?: string } }>,
      reply: FastifyReply,
    ) => {
      if (request.headers["x-admin-key"] !== config.adminApiKey) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const limitRaw = Number.parseInt(request.query?.limit ?? "100", 10);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;
      const rows = sqliteDb
        .prepare(
          `SELECT id, user_id as userId, account_id as accountId, feedback_text as feedback, status, created_at as createdAt
           FROM feedback_entries
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .all(limit);
      return reply.send({ items: rows });
    },
  );
}
