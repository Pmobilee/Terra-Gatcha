/**
 * Environment configuration for the Terra Gacha server.
 * Reads values from process.env (populated via dotenv at startup).
 * All fields are validated and typed; missing required values throw at boot.
 */

import "dotenv/config";

/** Parsed and validated server configuration. */
export interface Config {
  /** TCP port the Fastify server listens on. */
  port: number;
  /** Node environment ("development" | "production" | "test"). */
  nodeEnv: string;
  /** Secret used to sign and verify JWTs. Must be long and random in prod. */
  jwtSecret: string;
  /** Expiry string for access tokens (e.g. "15m"). */
  jwtExpiry: string;
  /** Expiry string for refresh tokens (e.g. "7d"). */
  refreshExpiry: string;
  /** Database connection string. SQLite path for dev, postgres:// URL for prod. */
  databaseUrl: string;
  /** Allowed CORS origin(s). Comma-separated list or single origin. */
  corsOrigin: string | string[];
  /** True when running in production mode. */
  isProduction: boolean;
  /** Admin API key for fact management endpoints. */
  adminApiKey: string;
  /** Anthropic API key for LLM features (dedup, categorization, generation). */
  anthropicApiKey: string;
  /** ComfyUI server URL for pixel art generation. */
  comfyuiUrl: string;
  /** Minimum confidence score for a distractor to be served (default 0.7). */
  distractorConfidenceThreshold: number;
}

/**
 * Read a required environment variable, throwing if it is absent or empty.
 *
 * @param key - The environment variable name.
 * @param fallback - Optional default value; if omitted the variable is required.
 * @returns The resolved string value.
 */
function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Read an environment variable with a fallback, allowing empty string result.
 * Used for optional keys like ANTHROPIC_API_KEY that default to empty in dev.
 *
 * @param key - The environment variable name.
 * @param fallback - Default value if the variable is not set.
 * @returns The resolved string value (may be empty string).
 */
function envOptional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

const rawCors = env("CORS_ORIGIN", "http://localhost:5173");

/** Singleton configuration object populated from environment variables. */
export const config: Config = {
  port: parseInt(env("PORT", "3001"), 10),
  nodeEnv: env("NODE_ENV", "development"),
  jwtSecret: env("JWT_SECRET", "dev-secret-change-me"),
  jwtExpiry: env("JWT_EXPIRY", "15m"),
  refreshExpiry: env("REFRESH_EXPIRY", "7d"),
  databaseUrl: env("DATABASE_URL", "./data/terra-gacha.db"),
  corsOrigin: rawCors.includes(",")
    ? rawCors.split(",").map((s) => s.trim())
    : rawCors,
  isProduction: env("NODE_ENV", "development") === "production",
  adminApiKey: env("ADMIN_API_KEY", "dev-admin-key-change-me"),
  anthropicApiKey: envOptional("ANTHROPIC_API_KEY", ""),
  comfyuiUrl: env("COMFYUI_URL", "http://localhost:8188"),
  distractorConfidenceThreshold: parseFloat(
    env("DISTRACTOR_CONFIDENCE_THRESHOLD", "0.7")
  ),
};
