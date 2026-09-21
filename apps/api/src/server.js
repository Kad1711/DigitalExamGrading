import "dotenv/config";

// Reloaded with database port 5433

import app from "./app.js";
import prisma from "./config/prisma.js";

const PORT = process.env.PORT || 5000;

import { bootstrapManagementAccounts } from "./bootstrap/management-accounts.js";

// Auto-ensure DB schema changes before starting HTTP listener
const schemaEnsureStatements = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "fullName" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT`,
  `ALTER TABLE "Exam" ALTER COLUMN "teacherId" DROP NOT NULL`,
  `ALTER TABLE "Exam" ALTER COLUMN "classId" DROP NOT NULL`,
  `ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "gradeId" TEXT`,
  `ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER DEFAULT 45`,
  `ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "sheetPreset" TEXT DEFAULT 'PRESET_TERM_50Q'`,
  `ALTER TABLE "AnswerSheetTemplate" ADD COLUMN IF NOT EXISTS "sheetPreset" TEXT DEFAULT 'PRESET_TERM_50Q'`,
  `CREATE TABLE IF NOT EXISTS "ExamClass" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamClass_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ExamClass_examId_classId_key" ON "ExamClass"("examId", "classId")`,
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PRINCIPAL'`,
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'VICE_PRINCIPAL'`,
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'EXAM_BOARD'`,
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ACADEMIC_BOARD'`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExamType') THEN CREATE TYPE "ExamType" AS ENUM ('REGULAR', 'MIN_15', 'MIN_45', 'MIN_60', 'MIN_90', 'MIDTERM', 'FINAL', 'OTHER'); END IF; END $$;`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PublicationApprovalStatus') THEN CREATE TYPE "PublicationApprovalStatus" AS ENUM ('NOT_REQUESTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'); END IF; END $$;`,
  `ALTER TYPE "ResultPublicationAction" ADD VALUE IF NOT EXISTS 'REQUESTED'`,
  `ALTER TYPE "ResultPublicationAction" ADD VALUE IF NOT EXISTS 'APPROVAL_REQUESTED'`,
  `ALTER TYPE "ResultPublicationAction" ADD VALUE IF NOT EXISTS 'APPROVED'`,
  `ALTER TYPE "ResultPublicationAction" ADD VALUE IF NOT EXISTS 'REJECTED'`,
  `ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "title" TEXT DEFAULT 'Giáo viên'`,
  `ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "primarySubjectId" TEXT`,
  `ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT`,
  `ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "examType" "ExamType" NOT NULL DEFAULT 'REGULAR'`,
  `ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "publicationApprovalStatus" "PublicationApprovalStatus" NOT NULL DEFAULT 'NOT_REQUESTED'`,
  `ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "publicationRequestedAt" TIMESTAMP(3)`,
  `ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "publicationRequestedByUserId" TEXT`,
  `ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "publicationApprovedAt" TIMESTAMP(3)`,
  `ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "publicationApprovedByUserId" TEXT`,
  `ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "publicationRejectionReason" TEXT`,
];
for (const sql of schemaEnsureStatements) {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (migErr) {
    console.warn(`[SERVER] DB ensure notice (${sql.slice(0, 40)}...):`, migErr.message);
  }
}
console.log("[SERVER] Database schema verified & updated successfully.");

try {
  await bootstrapManagementAccounts();
} catch (bootstrapErr) {
  console.warn("[SERVER] Management accounts bootstrap notice:", bootstrapErr.message);
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
