import express from "express";
import cors from "cors";
import helmet from "helmet";

import prisma from "./config/prisma.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Digital Exam Grading API is running"
  });
});

app.post("/api/test-db", async (req, res) => {
  try {
    const record = await prisma.testConnection.create({
      data: {
        message: req.body.message || "Prisma connected to PostgreSQL successfully"
      }
    });

    res.status(201).json({
      success: true,
      data: record
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Database test failed"
    });
  }
});

app.get("/api/test-db", async (req, res) => {
  try {
    const records = await prisma.testConnection.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });

    res.status(200).json({
      success: true,
      data: records
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Database test failed"
    });
  }
});

export default app;