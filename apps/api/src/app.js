import express from "express";
import cors from "cors";
import helmet from "helmet";

import apiRouter from "./routes/index.js";
import { notFoundHandler, globalErrorHandler } from "./middlewares/error.middleware.js";
import { createCorsMiddleware } from "./config/cors.config.js";
import { generalApiLimiter } from "./config/rate-limit.config.js";
import prisma from "./config/prisma.js";

import { getAvatarController } from "./controllers/profile.controller.js";

const app = express();

// =====================================================
// GLOBAL MIDDLEWARES
// =====================================================

app.use(helmet());
app.use(createCorsMiddleware());
app.use(express.json({ limit: "1mb" }));

// =====================================================
// HEALTH & MONITORING
// =====================================================

app.get("/api/health", async (req, res) => {
  let dbStatus = "connected";
  let dbLatencyMs = 0;
  try {
    const start = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Math.round((performance.now() - start) * 10) / 10;

    // Auto-ensure DB columns if not yet present
    for (const sql of [
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT`,
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "fullName" TEXT`,
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT`,
    ]) {
      await prisma.$executeRawUnsafe(sql).catch(() => {});
    }
  } catch {
    dbStatus = "disconnected";
  }

  const mem = process.memoryUsage();
  res.status(200).json({
    success: true,
    message: "Digital Exam Grading API is running",
    status: dbStatus === "connected" ? "healthy" : "degraded",
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      memory: {
        heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
        rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      },
      timestamp: new Date().toISOString(),
    },
  });
});

app.all("/api/health/db-sync", async (req, res) => {
  const statements = [
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "fullName" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT`,
  ];
  const results = [];
  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
      results.push({ sql, status: "ok" });
    } catch (err) {
      results.push({ sql, status: "error", message: err.message });
    }
  }
  return res.json({ success: true, timestamp: new Date().toISOString(), results });
});

app.use("/api", generalApiLimiter);

// =====================================================
// API ROUTES
// =====================================================

// Backward compatibility route for legacy avatar URLs lacking /api prefix
app.get("/profile/avatar/:filename", getAvatarController);

app.use("/api", apiRouter);

// =====================================================
// ERROR HANDLING
// =====================================================

app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;