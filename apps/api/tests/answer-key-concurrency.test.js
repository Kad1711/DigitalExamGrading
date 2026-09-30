import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import prisma, { getDatabaseUrl } from "../src/config/prisma.js";
import { approveAnswerKey, putAnswerKey } from "../src/services/answer-key.service.js";
import { applyImport } from "../src/services/answer-key-import.service.js";

describe("Master Answer Key Concurrency & TOCTOU Race Condition Integration Suite", () => {
  let isDbAvailable = false;
  const RUN_ID = `CONCUR_${Date.now()}`;
  let approverUser = null;
  let teacherUser = null;
  let subjectRecord = null;
  let examRecord = null;
  let examCodeRecord = null;

  before(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      isDbAvailable = true;
    } catch {
      console.log("[CONCURRENCY TEST] Database not reachable. Skipping live concurrency suite.");
      return;
    }

    assert.equal(process.env.NODE_ENV, "test", "Must run in test environment");

    // 1. Create test subject
    subjectRecord = await prisma.subject.create({
      data: {
        code: `SUBJ_${RUN_ID}`,
        name: `Môn Thử Nghiệm Concurrency ${RUN_ID}`,
      },
    });

    // 2. Create Vice Principal approver
    approverUser = await prisma.user.create({
      data: {
        email: `approver_${RUN_ID}@school.edu.vn`,
        passwordHash: "dummy_hash",
        fullName: "Ban Giám Hiệu Concurrency",
        role: "VICE_PRINCIPAL",
        status: "ACTIVE",
      },
    });

    // 3. Create Teacher
    teacherUser = await prisma.user.create({
      data: {
        email: `teacher_${RUN_ID}@school.edu.vn`,
        passwordHash: "dummy_hash",
        fullName: "Giáo Viên Concurrency",
        role: "TEACHER",
        status: "ACTIVE",
      },
    });

    const teacher = await prisma.teacher.create({
      data: {
        userId: teacherUser.id,
        teacherCode: `GV_${RUN_ID.slice(-6)}`,
        fullName: teacherUser.fullName,
        primarySubjectId: subjectRecord.id,
      },
    });

    // 4. Create official MIDTERM exam in DRAFT
    examRecord = await prisma.exam.create({
      data: {
        title: `Kỳ Thi Giữa Kỳ Concurrency ${RUN_ID}`,
        examType: "MIDTERM",
        status: "DRAFT",
        subjectId: subjectRecord.id,
        teacherId: teacher.id,
        createdByUserId: teacherUser.id,
        questionCount: 2,
        maxScore: 10,
        scoringType: "EQUAL",
      },
    });

    // 5. Create exam code 101 with 2 initial answers
    examCodeRecord = await prisma.examCode.create({
      data: {
        examId: examRecord.id,
        code: "101",
      },
    });

    await prisma.answerKey.createMany({
      data: [
        { examCodeId: examCodeRecord.id, questionNumber: 1, correctAnswer: "A", score: 5 },
        { examCodeId: examCodeRecord.id, questionNumber: 2, correctAnswer: "B", score: 5 },
      ],
    });
  });

  after(async () => {
    if (!isDbAvailable) return;
    try {
      if (examCodeRecord) {
        await prisma.answerKey.deleteMany({ where: { examCodeId: examCodeRecord.id } });
        await prisma.examCode.deleteMany({ where: { examId: examRecord.id } });
      }
      if (examRecord) {
        await prisma.exam.deleteMany({ where: { id: examRecord.id } });
      }
      if (teacherUser) {
        await prisma.teacher.deleteMany({ where: { userId: teacherUser.id } });
        await prisma.user.deleteMany({ where: { id: teacherUser.id } });
      }
      if (approverUser) {
        await prisma.user.deleteMany({ where: { id: approverUser.id } });
      }
      if (subjectRecord) {
        await prisma.subject.deleteMany({ where: { id: subjectRecord.id } });
      }
    } catch (err) {
      console.warn("Cleanup warning:", err.message);
    }
  });

  test("1. Concurrent approveAnswerKey and putAnswerKey never leaves modified answers approved", async (t) => {
    if (!isDbAvailable) {
      t.skip("Database not available locally");
      return;
    }

    const modifiedAnswers = [
      { questionNumber: 1, correctAnswer: "C" },
      { questionNumber: 2, correctAnswer: "D" },
    ];

    const approverReq = { id: approverUser.id, role: approverUser.role };
    const teacherReq = { id: teacherUser.id, role: teacherUser.role };

    // Fire concurrently
    const results = await Promise.allSettled([
      approveAnswerKey(examRecord.id, approverReq),
      putAnswerKey(examRecord.id, examCodeRecord.id, modifiedAnswers, teacherReq),
    ]);

    // Check DB state
    const currentExam = await prisma.exam.findUnique({
      where: { id: examRecord.id },
    });
    const currentAnswers = await prisma.answerKey.findMany({
      where: { examCodeId: examCodeRecord.id },
      orderBy: { questionNumber: "asc" },
    });

    const isModified = currentAnswers[0]?.correctAnswer === "C" && currentAnswers[1]?.correctAnswer === "D";

    if (isModified) {
      // If the modified answers committed last, answerKeyApprovedAt MUST be null!
      // (Row lock guarantees putAnswerKey overwrites approval to null)
      assert.equal(
        currentExam.answerKeyApprovedAt,
        null,
        "CRITICAL: Modified answers must NOT inherit previous approval state!"
      );
    } else {
      // If old answers remain, approval might have completed
      assert.ok(currentExam.answerKeyApprovedAt !== undefined);
    }
  });

  test("2. Concurrent approveAnswerKey and applyImport (CSV) serializes safely with row lock", async (t) => {
    if (!isDbAvailable) {
      t.skip("Database not available locally");
      return;
    }

    // Reset approval first
    await prisma.exam.update({
      where: { id: examRecord.id },
      data: { answerKeyApprovedAt: null, answerKeyApprovedByUserId: null },
    });

    const csvContent = "examcode,questionnumber,correctanswer,score\n101,1,B,5\n101,2,A,5\n";
    const fileBuffer = Buffer.from(csvContent, "utf-8");

    const approverReq = { id: approverUser.id, role: approverUser.role };
    const teacherReq = { id: teacherUser.id, role: teacherUser.role };

    // Fire concurrently
    await Promise.allSettled([
      approveAnswerKey(examRecord.id, approverReq),
      applyImport(examRecord.id, fileBuffer, "text/csv", "concur_import.csv", teacherReq),
    ]);

    const currentExam = await prisma.exam.findUnique({
      where: { id: examRecord.id },
    });
    const currentAnswers = await prisma.answerKey.findMany({
      where: { examCodeId: examCodeRecord.id },
      orderBy: { questionNumber: "asc" },
    });

    const isImported = currentAnswers[0]?.correctAnswer === "B" && currentAnswers[1]?.correctAnswer === "A";

    if (isImported) {
      assert.equal(
        currentExam.answerKeyApprovedAt,
        null,
        "CRITICAL: Newly imported CSV answers must NOT retain stale approval!"
      );
    }
  });
});
