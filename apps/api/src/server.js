import "dotenv/config";

// Reloaded with database port 5433

import app from "./app.js";
import prisma from "./config/prisma.js";

const PORT = process.env.PORT || 5000;

import { bootstrapManagementAccounts } from "./bootstrap/management-accounts.js";



try {
  await bootstrapManagementAccounts();
} catch (bootstrapErr) {
  console.warn("[SERVER] Management accounts bootstrap notice:", bootstrapErr.message);
}


const server = app.listen(PORT, async () => {
  console.log(`[SERVER] API running at http://localhost:${PORT}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || "development"}`);

  // Initialize BullMQ background queue worker only if Redis is configured
  try {
    const { isRedisConfigured } = await import("./config/redis.config.js");
    if (isRedisConfigured()) {
      const { initGradingWorker } = await import("./queue/grading.worker.js");
      initGradingWorker();
    } else {
      console.log(
        "[QUEUE] REDIS_URL not configured. Running without queue worker (set REDIS_URL if batch queue is needed)."
      );
    }
  } catch (err) {
    console.warn("[SERVER] BullMQ worker initialization skipped:", err.message);
  }

  // Safe startup cleanup of stale temporary staging files older than 24 hours
  try {
    const { cleanupStaleStaging } = await import("./services/storage/storage.service.js");
    await cleanupStaleStaging(24 * 60 * 60 * 1000);
  } catch (stagingErr) {
    console.warn("[SERVER] Startup staging cleaner notice:", stagingErr.message);
  }
});

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

async function shutdown(signal) {
  console.log(`\n[SERVER] Received ${signal}. Shutting down gracefully...`);

  try {
    const { closeGradingWorker } = await import("./queue/grading.worker.js");
    await closeGradingWorker();
  } catch {
    // Ignore
  }

  server.close(async () => {
    console.log("[SERVER] HTTP server closed.");

    try {
      await prisma.$disconnect();
      console.log("[SERVER] Prisma disconnected.");
    } catch (err) {
      console.error("[SERVER] Error disconnecting Prisma:", err.message);
    }

    process.exit(0);
  });

  // Force exit neu server khong dong trong 10s
  setTimeout(() => {
    console.error("[SERVER] Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
