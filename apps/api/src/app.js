import express from "express";
import cors from "cors";
import helmet from "helmet";

import apiRouter from "./routes/index.js";
import { notFoundHandler, globalErrorHandler } from "./middlewares/error.middleware.js";
import { createCorsMiddleware } from "./config/cors.config.js";
import { generalApiLimiter } from "./config/rate-limit.config.js";
import prisma from "./config/prisma.js";

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

app.use("/api", generalApiLimiter);

// =====================================================
// API ROUTES
// =====================================================

app.use("/api", apiRouter);

// =====================================================
// ERROR HANDLING
// =====================================================

app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;