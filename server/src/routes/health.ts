/**
 * Health check route for the Terra Gacha server.
 * Returns basic liveness information; used by Docker healthcheck and
 * monitoring systems to verify the server is running.
 */

import type { FastifyInstance } from "fastify";

const SERVER_START_TIME = Date.now();
const SERVER_VERSION = "1.0.0";

/**
 * Register the health check route on the Fastify instance.
 *
 * @param fastify - The Fastify application instance.
 */
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /health
   * Returns server status, version, and uptime in seconds.
   * No authentication required.
   */
  fastify.get(
    "/health",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              version: { type: "string" },
              uptime: { type: "number" },
            },
          },
        },
      },
    },
    async (_request, _reply) => {
      return {
        status: "ok",
        version: SERVER_VERSION,
        uptime: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
      };
    }
  );
}
