import "dotenv/config";
import { Redis } from "ioredis";

const isProduction = process.env.NODE_ENV === "production";
const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST;
const redisPort = Number(process.env.REDIS_PORT) || 6379;

/**
 * Checks whether a Redis connection is explicitly configured.
 * In production (e.g. Render), REDIS_URL must be explicitly provided.
 */
export function isRedisConfigured() {
  if (redisUrl && redisUrl.trim()) return true;
  if (redisHost && redisHost.trim()) return true;
  // In local development, allow default 127.0.0.1
  if (!isProduction) return true;
  return false;
}

/**
 * Common Redis connection options for BullMQ
 * BullMQ requires maxRetriesPerRequest to be null
 */
export const redisConnectionOptions = redisUrl
  ? {
      url: redisUrl,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    }
  : {
      host: redisHost || "127.0.0.1",
      port: redisPort,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => {
        // In production without Redis, stop retrying immediately
        if (isProduction && !redisUrl && !redisHost) {
          return null;
        }
        if (times > 3) {
          return null; // Stop retrying after 3 attempts
        }
        return Math.min(times * 1000, 3000);
      },
    };

let redisClient = null;

export function getRedisClient() {
  if (!redisClient) {
    if (redisUrl) {
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });
    } else {
      redisClient = new Redis({
        host: redisHost || "127.0.0.1",
        port: redisPort,
        maxRetriesPerRequest: null,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (isProduction && !redisUrl && !redisHost) {
            return null;
          }
          if (times > 3) return null;
          return Math.min(times * 1000, 3000);
        },
      });
    }

    redisClient.on("error", (err) => {
      // Avoid spamming log on Render when Redis is not configured
      if (!isRedisConfigured()) return;
      console.warn("[REDIS] Redis connection warning:", err.message);
    });
  }

  return redisClient;
}

/**
 * Asynchronously verifies that Redis connection is active and responsive.
 * Used for fail-fast readiness checks before accepting or staging bulk uploads.
 *
 * @returns {Promise<boolean>}
 */
export async function checkRedisHealth() {
  if (!isRedisConfigured()) {
    return false;
  }
  try {
    const client = getRedisClient();
    if (client.status === "wait" || client.status === "close") {
      await client.connect().catch(() => {});
    }
    const pong = await client.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

