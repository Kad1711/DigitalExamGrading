import "dotenv/config";
import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = Number(process.env.REDIS_PORT) || 6379;

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
      host: redisHost,
      port: redisPort,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
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
        host: redisHost,
        port: redisPort,
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });
    }

    redisClient.on("error", (err) => {
      // Avoid unhandled rejection crash when Redis is temporarily offline in local dev
      console.warn("[REDIS] Redis connection warning:", err.message);
    });
  }

  return redisClient;
}
