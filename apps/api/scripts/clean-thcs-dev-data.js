import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import Redis from "ioredis";
import prisma from "../src/config/prisma.js";
import { LocalStorageService } from "../src/services/storage/local-storage.service.js";

async function cleanThcsDevData() {
  // 1. Guard: Check NODE_ENV
  if (process.env.NODE_ENV === "production") {
    console.error("CRITICAL SAFETY ERROR: Refusing to clean database when NODE_ENV is production.");
    process.exit(1);
  }

  // 2. Guard: Check DB host & target name
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("ERROR: DATABASE_URL is not set.");
    process.exit(1);
  }

  // 3. Guard: Explicit confirmation flag
  const args = process.argv.slice(2);
  const allowTestDb = args.includes("--allow-test-db");

  try {
    const parsed = new URL(dbUrl);
    const host = parsed.hostname.toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (!isLocal) {
      console.error(`SAFETY ERROR: Refusing to clean non-local database host ("${host}").`);
      process.exit(1);
    }
    const dbName = parsed.pathname.replace(/^\//, "").split("?")[0].toLowerCase();
    const isTargetDb = dbName === "exam_grading_db" || (allowTestDb && dbName === "exam_grading_test");
    if (!isTargetDb) {
      console.error(`SAFETY ERROR: Database name "${dbName}" is not allowed. Aborting.`);
      process.exit(1);
    }
    console.log(`Target Database: ${dbName} on ${host}`);
  } catch {
    console.error("ERROR: Invalid DATABASE_URL format.");
    process.exit(1);
  }

  if (!args.includes("--confirm-thcs-reset")) {
    console.error("SAFETY REFUSAL: Missing required flag --confirm-thcs-reset");
    console.error("Usage: node scripts/clean-thcs-dev-data.js --confirm-thcs-reset");
    process.exit(1);
  }

  try {
    // 4. Counts BEFORE deletion
    console.log("\n--- RECORD COUNTS BEFORE THCS RESET ---");
    const beforeUsers = await prisma.user.count();
    const beforeTeachers = await prisma.teacher.count();
    const beforeStudents = await prisma.student.count();
    const beforeExams = await prisma.exam.count();
    const beforeSubmissions = await prisma.examSubmission.count();
    const beforeAnswers = await prisma.submissionAnswer.count();
    const beforeAuditLogs = await prisma.examSubmissionAuditLog.count();
    const beforeCandidates = await prisma.examCandidate.count();
    const beforePubLogs = await prisma.examResultPublicationLog.count();
    const beforeClasses = await prisma.class.count();
    const beforeGrades = await prisma.grade.count();

    console.log(`- Users: ${beforeUsers}`);
    console.log(`- Teachers: ${beforeTeachers}`);
    console.log(`- Students: ${beforeStudents}`);
    console.log(`- Exams: ${beforeExams}`);
    console.log(`- Submissions: ${beforeSubmissions}`);
    console.log(`- Answers: ${beforeAnswers}`);
    console.log(`- Audit Logs: ${beforeAuditLogs}`);
    console.log(`- Candidates: ${beforeCandidates}`);
    console.log(`- Publication Logs: ${beforePubLogs}`);
    console.log(`- Classes: ${beforeClasses}`);
    console.log(`- Grades: ${beforeGrades}`);

    // 5. Transactional Cleanup in reverse FK dependency order
    console.log("\nExecuting safe transactional cleanup in reverse FK dependency order...");

    await prisma.$transaction(async (tx) => {
      // Step A: Submissions and candidates
      await tx.examSubmissionAuditLog.deleteMany({});
      await tx.submissionAnswer.deleteMany({});
      await tx.examSubmission.deleteMany({});
      await tx.examCandidate.deleteMany({});
      await tx.examResultPublicationLog.deleteMany({});

      // Step B: Exam structures
      await tx.answerKey.deleteMany({});
      await tx.answerSheetTemplate.deleteMany({});
      await tx.examCode.deleteMany({});
      await tx.examClass.deleteMany({});
      await tx.exam.deleteMany({});

      // Step C: Enrollments and assignments
      await tx.studentEnrollment.deleteMany({});
      await tx.teachingAssignment.deleteMany({});

      // Step D: Profiles
      await tx.student.deleteMany({});
      await tx.teacher.deleteMany({});

      // Step E: Auth tokens and users (including obsolete ACADEMIC_BOARD)
      await tx.refreshToken.deleteMany({});
      await tx.user.deleteMany({});

      // Step F: Classes and non-THCS grades (remove 10, 11, 12)
      await tx.class.deleteMany({});
      await tx.grade.deleteMany({
        where: {
          level: {
            notIn: [6, 7, 8, 9],
          },
        },
      });
    });

    console.log("Database transaction committed successfully.");

    // 6. Redis Batch Queue Cleanup
    const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    try {
      console.log(`\nConnecting to Redis to clear BullMQ queues (${redisUrl})...`);
      const redis = new Redis(redisUrl, { lazyConnect: true });
      await redis.connect();
      const keys = await redis.keys("bull:omr-grading:*");
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`- Cleared ${keys.length} Redis queue keys matching bull:omr-grading:*`);
      } else {
        console.log("- No leftover bull:omr-grading:* keys in Redis.");
      }
      redis.disconnect();
    } catch (redisErr) {
      console.warn("Warning: Could not clear Redis keys (is Redis running?):", redisErr.message);
    }

    // 7. Storage cleanup
    try {
      const storageService = new LocalStorageService();
      const storageRoot = storageService.getStorageRoot();
      const submissionsDir = path.join(storageRoot, "submissions");

      if (fs.existsSync(submissionsDir)) {
        console.log(`Cleaning orphan submission storage in: ${submissionsDir}`);
        const entries = await fs.promises.readdir(submissionsDir);
        for (const entry of entries) {
          const entryPath = path.join(submissionsDir, entry);
          await fs.promises.rm(entryPath, { recursive: true, force: true });
        }
        console.log(`- Cleaned ${entries.length} storage folders.`);
      }
    } catch (storageErr) {
      console.warn("Warning: Storage cleanup encountered issue:", storageErr.message);
    }

    // 8. Counts AFTER cleanup
    console.log("\n--- RECORD COUNTS AFTER THCS RESET ---");
    const afterUsers = await prisma.user.count();
    const afterTeachers = await prisma.teacher.count();
    const afterStudents = await prisma.student.count();
    const afterExams = await prisma.exam.count();
    const afterSubmissions = await prisma.examSubmission.count();
    const afterClasses = await prisma.class.count();
    const remainingGrades = await prisma.grade.findMany({ select: { level: true, name: true } });

    console.log(`- Users: ${afterUsers}`);
    console.log(`- Teachers: ${afterTeachers}`);
    console.log(`- Students: ${afterStudents}`);
    console.log(`- Exams: ${afterExams}`);
    console.log(`- Submissions: ${afterSubmissions}`);
    console.log(`- Classes: ${afterClasses}`);
    console.log(`- Remaining Grades: ${remainingGrades.map((g) => `${g.name} (${g.level})`).join(", ") || "None"}`);

    console.log("\n>>> THCS DEV DATA RESET COMPLETE. READY FOR RE-SEED. <<<");
  } catch (err) {
    console.error("clean-thcs-dev-data failed:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanThcsDevData();
