import "dotenv/config";

// Reloaded with database port 5433

import app from "./app.js";
import prisma from "./config/prisma.js";

const PORT = process.env.PORT || 5000;

// Auto-ensure DB schema changes before starting HTTP listener
try {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "fullName" TEXT;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
  `);
  console.log("[SERVER] Database schema verified & updated successfully.");
} catch (migErr) {
  console.warn("[SERVER] Database schema ensure notice:", migErr.message);
}

const server = app.listen(PORT, async () => {
  console.log(`[SERVER] API running at http://localhost:${PORT}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || "development"}`);

  // Initialize BullMQ background queue worker
  try {
    const { initGradingWorker } = await import("./queue/grading.worker.js");
    initGradingWorker();
  } catch (err) {
    console.warn("[SERVER] BullMQ worker initialization skipped:", err.message);
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
