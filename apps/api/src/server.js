import "dotenv/config";

import app from "./app.js";
import prisma from "./config/prisma.js";

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`[SERVER] API running at http://localhost:${PORT}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || "development"}`);
});

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

async function shutdown(signal) {
  console.log(`\n[SERVER] Received ${signal}. Shutting down gracefully...`);

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
