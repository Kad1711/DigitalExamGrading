import express from "express";
import cors from "cors";
import helmet from "helmet";

import apiRouter from "./routes/index.js";
import { notFoundHandler, globalErrorHandler } from "./middlewares/error.middleware.js";

const app = express();

// =====================================================
// GLOBAL MIDDLEWARES
// =====================================================

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Digital Exam Grading API is running",
  });
});

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