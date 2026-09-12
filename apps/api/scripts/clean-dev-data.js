import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import prisma from "../src/config/prisma.js";
import { LocalStorageService } from "../src/services/storage/local-storage.service.js";

async function cleanDevData() {
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

  try {
    const parsed = new URL(dbUrl);
    const host = parsed.hostname.toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (!isLocal) {
      console.error(`SAFETY ERROR: Refusing to clean non-local database host ("${host}").`);
      process.exit(1);
    }
    const dbName = parsed.pathname.replace(/^\//, "").split("?")[0].toLowerCase();
    if (dbName.includes("prod")) {
      console.error(`SAFETY ERROR: Database name "${dbName}" contains "prod". Aborting.`);
      process.exit(1);
    }
    console.log(`Target Development Database: ${dbName} on ${host}`);
  } catch {
    console.error("ERROR: Invalid DATABASE_URL format.");
    process.exit(1);
  }

  // 3. Guard: Explicit confirmation flag
  const args = process.argv.slice(2);
  if (!args.includes("--confirm-clean-dev-data")) {
    console.error("SAFETY REFUSAL: Missing required flag --confirm-clean-dev-data");
    console.error("Usage: node scripts/clean-dev-data.js --confirm-clean-dev-data");
    process.exit(1);
  }

  try {
    // 4. Counts BEFORE deletion
    console.log("\n--- RECORD COUNTS BEFORE CLEANUP ---");
    const beforeAdmin = await prisma.user.count({ where: { role: "ADMIN" } });
    const beforeTeacherUser = await prisma.user.count({ where: { role: "TEACHER" } });
    const beforeStudentUser = await prisma.user.count({ where: { role: "STUDENT" } });
    const beforeTeacher = await prisma.teacher.count();
    const beforeStudent = await prisma.student.count();
    const beforeExam = await prisma.exam.count();
    const beforeCandidate = await prisma.examCandidate.count();
    const beforeSubmission = await prisma.examSubmission.count();
    const beforeAnswer = await prisma.submissionAnswer.count();
    const beforeAuditLog = await prisma.examSubmissionAuditLog.count();
    const beforePubLog = await prisma.examResultPublicationLog.count();
    const beforeAnswerKey = await prisma.answerKey.count();
    const beforeExamCode = await prisma.examCode.count();
    const beforeTemplate = await prisma.answerSheetTemplate.count();
    const beforeRefreshTokens = await prisma.refreshToken.count();

    console.log(`- ADMIN users: ${beforeAdmin}`);
    console.log(`- TEACHER users: ${beforeTeacherUser}`);
    console.log(`- STUDENT users: ${beforeStudentUser}`);
    console.log(`- Teacher profiles: ${beforeTeacher}`);
    console.log(`- Student profiles: ${beforeStudent}`);
    console.log(`- Exams: ${beforeExam}`);
    console.log(`- Exam Candidates: ${beforeCandidate}`);
    console.log(`- Exam Submissions: ${beforeSubmission}`);
    console.log(`- Submission Answers: ${beforeAnswer}`);
    console.log(`- Submission Audit Logs: ${beforeAuditLog}`);
    console.log(`- Result Publication Logs: ${beforePubLog}`);
    console.log(`- Answer Keys: ${beforeAnswerKey}`);
    console.log(`- Exam Codes: ${beforeExamCode}`);
    console.log(`- Answer Sheet Templates: ${beforeTemplate}`);
    console.log(`- Refresh Tokens: ${beforeRefreshTokens}`);

    // Verify ADMIN account exists
    const adminUser = await prisma.user.findFirst({
      where: { email: "admin@digitalexam.local", role: "ADMIN" },
    });
    if (!adminUser) {
      console.error('ERROR: Required admin account "admin@digitalexam.local" was not found in DB! Aborting.');
      process.exit(1);
    }
    console.log(`Verified Admin Account Preserved: ${adminUser.email} (ID: ${adminUser.id}, Status: ${adminUser.status})`);

    // 5. Transactional Cleanup
    console.log("\nExecuting safe transactional cleanup in foreign-key dependency order...");

    await prisma.$transaction(async (tx) => {
      // Step A: Exam candidate & submission results
      await tx.examCandidate.deleteMany({});
      await tx.submissionAnswer.deleteMany({});
      await tx.examSubmissionAuditLog.deleteMany({});
      await tx.examSubmission.deleteMany({});
      await tx.examResultPublicationLog.deleteMany({});

      // Step B: Exam structure
      await tx.answerKey.deleteMany({});
      await tx.answerSheetTemplate.deleteMany({});
      await tx.examCode.deleteMany({});
      await tx.exam.deleteMany({});

      // Step C: Student profiles and enrollments
      await tx.studentEnrollment.deleteMany({});
      await tx.student.deleteMany({});

      // Step D: Teacher profiles and assignments
      await tx.teachingAssignment.deleteMany({});
      await tx.teacher.deleteMany({});

      // Step E: Clean up non-admin refresh tokens and users
      await tx.refreshToken.deleteMany({
        where: { user: { role: { not: "ADMIN" } } },
      });
      await tx.user.deleteMany({
        where: { role: { not: "ADMIN" } },
      });

      // Step F: Clean duplicate unaccented semesters ("Hoc ky 1", "Hoc ky 2") if any
      await tx.semester.deleteMany({
        where: { name: { in: ["Hoc ky 1", "Hoc ky 2"] } },
      });
    });

    console.log("Database transaction committed successfully.");

    // 6. Storage cleanup: Clean submissions directory
    const storageService = new LocalStorageService();
    const storageRoot = storageService.getStorageRoot();
    const submissionsDir = path.join(storageRoot, "submissions");

    if (fs.existsSync(submissionsDir)) {
      console.log(`Cleaning orphan submission storage in: ${submissionsDir}`);
      const entries = await fs.promises.readdir(submissionsDir);
      for (const entry of entries) {
        const entryPath = path.join(submissionsDir, entry);
        await fs.promises.rm(entryPath, { recursive: true, force: true });
        console.log(`- Removed storage entry: submissions/${entry}`);
      }
    }

    // 7. Counts AFTER cleanup
    console.log("\n--- RECORD COUNTS AFTER CLEANUP ---");
    const afterAdmin = await prisma.user.count({ where: { role: "ADMIN" } });
    const afterTeacherUser = await prisma.user.count({ where: { role: "TEACHER" } });
    const afterStudentUser = await prisma.user.count({ where: { role: "STUDENT" } });
    const afterTeacher = await prisma.teacher.count();
    const afterStudent = await prisma.student.count();
    const afterExam = await prisma.exam.count();
    const afterCandidate = await prisma.examCandidate.count();
    const afterSubmission = await prisma.examSubmission.count();
    const afterAnswer = await prisma.submissionAnswer.count();
    const afterAuditLog = await prisma.examSubmissionAuditLog.count();
    const afterPubLog = await prisma.examResultPublicationLog.count();
    const afterAnswerKey = await prisma.answerKey.count();
    const afterExamCode = await prisma.examCode.count();
    const afterTemplate = await prisma.answerSheetTemplate.count();

    const academicYears = await prisma.academicYear.count();
    const semesters = await prisma.semester.count();
    const grades = await prisma.grade.count();
    const classes = await prisma.class.count();
    const subjects = await prisma.subject.count();

    console.log(`- ADMIN users: ${afterAdmin}`);
    console.log(`- TEACHER users: ${afterTeacherUser}`);
    console.log(`- STUDENT users: ${afterStudentUser}`);
    console.log(`- Teacher profiles: ${afterTeacher}`);
    console.log(`- Student profiles: ${afterStudent}`);
    console.log(`- Exams: ${afterExam}`);
    console.log(`- Exam Candidates: ${afterCandidate}`);
    console.log(`- Exam Submissions: ${afterSubmission}`);
    console.log(`- Submission Answers: ${afterAnswer}`);
    console.log(`- Submission Audit Logs: ${afterAuditLog}`);
    console.log(`- Result Publication Logs: ${afterPubLog}`);
    console.log(`- Answer Keys: ${afterAnswerKey}`);
    console.log(`- Exam Codes: ${afterExamCode}`);
    console.log(`- Answer Sheet Templates: ${afterTemplate}`);

    console.log("\n--- PRESERVED MASTER / REFERENCE DATA ---");
    console.log(`- Academic Years: ${academicYears}`);
    console.log(`- Semesters: ${semesters}`);
    console.log(`- Grades: ${grades}`);
    console.log(`- Classes: ${classes}`);
    console.log(`- Subjects: ${subjects}`);

    if (
      afterAdmin === 1 &&
      afterTeacherUser === 0 &&
      afterStudentUser === 0 &&
      afterTeacher === 0 &&
      afterStudent === 0 &&
      afterExam === 0 &&
      afterCandidate === 0 &&
      afterSubmission === 0 &&
      afterAnswer === 0
    ) {
      console.log("\n>>> DEVELOPMENT DATA CLEANUP COMPLETED PERFECTLY! <<<");
    } else {
      console.error("\nWARNING: Some counts did not match expected zero baseline.");
      process.exit(1);
    }
  } catch (err) {
    console.error("Clean dev data failed:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDevData();
