import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sqliteDb } from "../db/index.js";
import { config } from "../config.js";

interface InviteCodeRow {
  code: string;
  enabled: number;
  max_uses: number | null;
  used_count: number;
  expires_at: number | null;
  created_at: number;
}

function ensureInviteTable(): void {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_invite_enabled ON invite_codes(enabled);
    CREATE INDEX IF NOT EXISTS idx_invite_expires_at ON invite_codes(expires_at);
  `);
}

function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

function isInviteActive(row: InviteCodeRow, now: number): boolean {
  if (row.enabled !== 1) return false;
  if (row.expires_at != null && row.expires_at > 0 && row.expires_at < now) return false;
  if (row.max_uses != null && row.max_uses >= 0 && row.used_count >= row.max_uses) return false;
  return true;
}

export async function inviteRoutes(fastify: FastifyInstance): Promise<void> {
  ensureInviteTable();

  // Validate invite code (and optionally consume one use).
  fastify.post(
    "/validate",
    async (
      request: FastifyRequest<{ Body: { code?: string; consume?: boolean } }>,
      reply: FastifyReply,
    ) => {
      const now = Date.now();
      const activeCount = sqliteDb
        .prepare(
          `SELECT COUNT(*) as count
           FROM invite_codes
           WHERE enabled = 1
             AND (expires_at IS NULL OR expires_at = 0 OR expires_at > ?)`,
        )
        .get(now) as { count: number };

      // If no active invite codes are configured, soft launch is open.
      if ((activeCount.count ?? 0) === 0) {
        return reply.send({ accepted: true, reason: "open_launch" });
      }

      const rawCode = typeof request.body?.code === "string" ? request.body.code : "";
      const code = normalizeCode(rawCode);
      if (!code) {
        return reply.status(400).send({ accepted: false, reason: "code_required" });
      }

      const row = sqliteDb
        .prepare(
          `SELECT code, enabled, max_uses, used_count, expires_at, created_at
           FROM invite_codes
           WHERE code = ?
           LIMIT 1`,
        )
        .get(code) as InviteCodeRow | undefined;

      if (!row || !isInviteActive(row, now)) {
        return reply.send({ accepted: false, reason: "invalid_or_expired" });
      }

      if (request.body?.consume === true) {
        sqliteDb.prepare(`UPDATE invite_codes SET used_count = used_count + 1 WHERE code = ?`).run(code);
      }

      return reply.send({
        accepted: true,
        reason: "valid",
        code,
        remainingUses: row.max_uses == null ? null : Math.max(0, row.max_uses - (row.used_count + (request.body?.consume ? 1 : 0))),
      });
    },
  );

  // Admin create/update invite code.
  fastify.post(
    "/create",
    async (
      request: FastifyRequest<{ Body: { code?: string; maxUses?: number | null; expiresAt?: number | null; enabled?: boolean } }>,
      reply: FastifyReply,
    ) => {
      if (request.headers["x-admin-key"] !== config.adminApiKey) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const codeRaw = typeof request.body?.code === "string" ? request.body.code : "";
      const code = normalizeCode(codeRaw);
      if (!code || code.length < 4 || code.length > 32) {
        return reply.status(400).send({ error: "Code must be 4-32 alphanumeric characters." });
      }
      if (!/^[A-Z0-9_-]+$/.test(code)) {
        return reply.status(400).send({ error: "Code contains invalid characters." });
      }

      const maxUses = request.body?.maxUses == null ? null : Math.max(1, Math.floor(request.body.maxUses));
      const expiresAt = request.body?.expiresAt == null ? null : Math.max(0, Math.floor(request.body.expiresAt));
      const enabled = request.body?.enabled === false ? 0 : 1;
      const now = Date.now();

      sqliteDb
        .prepare(
          `INSERT INTO invite_codes (code, enabled, max_uses, used_count, expires_at, created_at)
           VALUES (?, ?, ?, 0, ?, ?)
           ON CONFLICT(code) DO UPDATE SET
             enabled = excluded.enabled,
             max_uses = excluded.max_uses,
             expires_at = excluded.expires_at`,
        )
        .run(code, enabled, maxUses, expiresAt, now);

      return reply.status(201).send({ code, enabled: enabled === 1, maxUses, expiresAt });
    },
  );

  // Admin list invite codes.
  fastify.get(
    "/list",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.headers["x-admin-key"] !== config.adminApiKey) {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const items = sqliteDb
        .prepare(
          `SELECT code, enabled, max_uses as maxUses, used_count as usedCount, expires_at as expiresAt, created_at as createdAt
           FROM invite_codes
           ORDER BY created_at DESC`,
        )
        .all();
      return reply.send({ items });
    },
  );
}
