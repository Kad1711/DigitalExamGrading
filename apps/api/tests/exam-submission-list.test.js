import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import prisma from "../src/config/prisma.js";
import * as submissionListService from "../src/services/submission-list.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures setup
// ─────────────────────────────────────────────────────────────────────────────

async function setupListContext() {
  const teacherUserA = await prisma.user.findFirst({
    where: { role: "TEACHER" },
    include: { teacher: true },
  });
  if (!teacherUserA?.teacher) throw new Error("No Teacher A found");

  // Teacher B (cross-teacher security)
  let teacherUserB = await prisma.user.findFirst({
    where: { role: "TEACHER", id: { not: teacherUserA.id } },
    include: { teacher: true },
  });
  if (!teacherUserB?.teacher) {
    teacherUserB = await prisma.user.create({
      data: {
        email: `list_test_teacher_b_${Date.now()}@digitalexam.local`,
        passwordHash: "dummyhash",
        role: "TEACHER",
        status: "ACTIVE",
        teacher: {
          create: {
            teacherCode: `LTB_${Date.now().toString().slice(-6)}`,
            fullName: "List Test Teacher B",
          },
        },
      },
      include: { teacher: true },
    });
  }

  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!adminUser) throw new Error("No Admin user found");

  const subject = await prisma.subject.findFirst();
  const cls = await prisma.class.findFirst();
  if (!subject || !cls) throw new Error("No subject or class found");

  // Create a test exam owned by Teacher A
  const exam = await prisma.exam.create({
    data: {
      title: `List Test Exam ${Date.now()}`,
      teacherId: teacherUserA.teacher.id,
      subjectId: subject.id,
      classId: cls.id,
      questionCount: 10,
      maxScore: new Prisma.Decimal("10.0000"),
      scoringType: "EQUAL",
      status: "CLOSED",
    },
  });

  const examCode = await prisma.examCode.create({
    data: { examId: exam.id, code: "001" },
  });

  for (let q = 1; q <= 10; q++) {
    await prisma.answerKey.create({
      data: {
        examCodeId: examCode.id,
        questionNumber: q,
        correctAnswer: "A",
        score: new Prisma.Decimal("1.0000"),
      },
    });
  }

  const template = await prisma.answerSheetTemplate.create({
    data: {
      examId: exam.id,
      version: 1,
      layoutJson: {},
    },
  });

  // Create 3 test submissions:
  // sub1: FINAL, SBD 100001, examCode 001
  const sub1 = await prisma.examSubmission.create({
    data: {
      examId: exam.id,
      examCodeId: examCode.id,
      answerSheetTemplateId: template.id,
      gradedByUserId: teacherUserA.id,
      status: "FINAL",
      detectedStudentNumber: "100001",
      candidateStudentNumber: "100001",
      studentNumberOmrStatus: "DETECTED",
      resolvedStudentNumber: "100001",
      identityNeedsReview: false,
      originalImageStorageKey: `test-list/${Date.now()}/original.jpg`,
      originalImageSha256: `sha256_list_sub1_${Date.now()}`,
      originalImageMimeType: "image/jpeg",
      originalImageSizeBytes: 1000,
      omrOverallStatus: "OK",
      questionCountSnapshot: 10,
      maxScoreSnapshot: new Prisma.Decimal("10.0000"),
      scoringTypeSnapshot: "EQUAL",
      examCodeSnapshot: "001",
      correctCount: 8,
      incorrectCount: 2,
      blankCount: 0,
      unresolvedCount: 0,
      finalScore: new Prisma.Decimal("8.0000"),
      finalizedAt: new Date(),
    },
  });

  // sub2: PROVISIONAL, SBD 100002, needsReview = true, examCode 001
  const sub2 = await prisma.examSubmission.create({
    data: {
      examId: exam.id,
      examCodeId: examCode.id,
      answerSheetTemplateId: template.id,
      gradedByUserId: teacherUserA.id,
      status: "PROVISIONAL",
      detectedStudentNumber: "100002",
      candidateStudentNumber: "100002",
      studentNumberOmrStatus: "DETECTED",
      resolvedStudentNumber: null,
      identityNeedsReview: true,
      originalImageStorageKey: `test-list/${Date.now()}/original.jpg`,
      originalImageSha256: `sha256_list_sub2_${Date.now()}`,
      originalImageMimeType: "image/jpeg",
      originalImageSizeBytes: 1000,
      omrOverallStatus: "OK",
      questionCountSnapshot: 10,
      maxScoreSnapshot: new Prisma.Decimal("10.0000"),
      scoringTypeSnapshot: "EQUAL",
      examCodeSnapshot: "001",
      correctCount: 5,
      incorrectCount: 3,
      blankCount: 0,
      unresolvedCount: 2,
      provisionalScore: new Prisma.Decimal("5.0000"),
    },
  });

  // sub3: FINAL, SBD 100001 (duplicate confirmed SBD with sub1!), examCode 001
  const sub3 = await prisma.examSubmission.create({
    data: {
      examId: exam.id,
      examCodeId: examCode.id,
      answerSheetTemplateId: template.id,
      gradedByUserId: teacherUserA.id,
      status: "FINAL",
      detectedStudentNumber: "100001",
      candidateStudentNumber: "100001",
      studentNumberOmrStatus: "DETECTED",
      resolvedStudentNumber: "100001", // duplicate SBD!
      identityNeedsReview: false,
      originalImageStorageKey: `test-list/${Date.now()}-2/original.jpg`,
      originalImageSha256: `sha256_list_sub3_${Date.now()}_dup`,
      originalImageMimeType: "image/jpeg",
      originalImageSizeBytes: 1000,
      omrOverallStatus: "OK",
      questionCountSnapshot: 10,
      maxScoreSnapshot: new Prisma.Decimal("10.0000"),
      scoringTypeSnapshot: "EQUAL",
      examCodeSnapshot: "001",
      correctCount: 7,
      incorrectCount: 3,
      blankCount: 0,
      unresolvedCount: 0,
      finalScore: new Prisma.Decimal("7.0000"),
      finalizedAt: new Date(),
    },
  });

  return {
    teacherA: { id: teacherUserA.id, role: "TEACHER" },
    teacherB: { id: teacherUserB.id, role: "TEACHER" },
    admin: { id: adminUser.id, role: "ADMIN" },
    exam,
    examCode,
    template,
    submissions: [sub1, sub2, sub3],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Phase 7 — Exam Submission List & Summary", async (t) => {
  const ctx = await setupListContext();
  const examId = ctx.exam.id;

  await t.test("T7.1 — listExamSubmissions: returns all submissions for teacher-owned exam", async () => {
    const result = await submissionListService.listExamSubmissions({
      examId,
      user: ctx.teacherA,
      query: {},
    });
    assert.ok(result.total >= 3, "Should have at least 3 submissions");
    assert.ok(Array.isArray(result.submissions));
    assert.ok(result.page === 1);
    assert.ok(result.pageSize === 20);
    assert.ok(typeof result.hasDuplicateSbd === "boolean");
    assert.strictEqual(result.hasDuplicateSbd, true, "Should detect duplicate SBD");
  });

  await t.test("T7.2 — listExamSubmissions: filter by status=FINAL", async () => {
    const result = await submissionListService.listExamSubmissions({
      examId,
      user: ctx.teacherA,
      query: { status: "FINAL" },
    });
    assert.ok(result.submissions.every((s) => s.status === "FINAL"), "All should be FINAL");
    assert.ok(result.total >= 2);
  });

  await t.test("T7.3 — listExamSubmissions: filter by status=PROVISIONAL", async () => {
    const result = await submissionListService.listExamSubmissions({
      examId,
      user: ctx.teacherA,
      query: { status: "PROVISIONAL" },
    });
    assert.ok(result.submissions.every((s) => s.status === "PROVISIONAL"), "All should be PROVISIONAL");
    assert.ok(result.total >= 1);
  });

  await t.test("T7.4 — listExamSubmissions: filter by identityStatus=NEEDS_REVIEW", async () => {
    const result = await submissionListService.listExamSubmissions({
      examId,
      user: ctx.teacherA,
      query: { identityStatus: "NEEDS_REVIEW" },
    });
    assert.ok(result.submissions.every((s) => s.studentNumber.needsReview === true));
    assert.ok(result.total >= 1);
  });

  await t.test("T7.5 — listExamSubmissions: filter by identityStatus=RESOLVED", async () => {
    const result = await submissionListService.listExamSubmissions({
      examId,
      user: ctx.teacherA,
      query: { identityStatus: "RESOLVED" },
    });
    assert.ok(result.submissions.every((s) => s.studentNumber.needsReview === false));
    assert.ok(result.total >= 2);
  });

  await t.test("T7.6 — listExamSubmissions: search by partial SBD", async () => {
    const result = await submissionListService.listExamSubmissions({
      examId,
      user: ctx.teacherA,
      query: { search: "100001" },
    });
    assert.ok(result.total >= 2);
    for (const s of result.submissions) {
      const hasSbd =
        (s.studentNumber.resolved && s.studentNumber.resolved.includes("100001")) ||
        (s.studentNumber.detected && s.studentNumber.detected.includes("100001")) ||
        (s.studentNumber.candidate && s.studentNumber.candidate.includes("100001"));
      assert.ok(hasSbd, `Submission ${s.id} should match search 100001`);
    }
  });

  await t.test("T7.7 — listExamSubmissions: ExamCode filter with normalization (01 matches 001)", async () => {
    // Filter with "01" should match snapshot "001" through normalization
    const result01 = await submissionListService.listExamSubmissions({
      examId,
      user: ctx.teacherA,
      query: { examCode: "01" },
    });
    assert.ok(result01.total >= 3, "Query '01' should match stored '001'");

    // Filter with "001"
    const result001 = await submissionListService.listExamSubmissions({
      examId,
      user: ctx.teacherA,
      query: { examCode: "001" },
    });
    assert.ok(result001.total >= 3, "Query '001' should match stored '001'");

    // Non-matching code
    const result999 = await submissionListService.listExamSubmissions({
      examId,
      user: ctx.teacherA,
      query: { examCode: "999" },
    });
    assert.strictEqual(result999.total, 0, "Query '999' should return 0 results");
  });

  await t.test("T7.8 — listExamSubmissions: duplicate-only filter returns only duplicate SBDs", async () => {
    const result = await submissionListService.listExamSubmissions({
      examId,
      user: ctx.teacherA,
      query: { duplicate: "true" },
    });
    assert.strictEqual(result.submissions.length, 2, "Only 2 duplicate SBD submissions should be returned");
    assert.ok(result.submissions.every((s) => s.isDuplicateSbd === true));
    assert.ok(result.submissions.every((s) => s.studentNumber.resolved === "100001"));
  });

  await t.test("T7.9 — listExamSubmissions: lightweight payload (no answers array, no rawOmrSnapshot)", async () => {
    const result = await submissionListService.listExamSubmissions({
      examId,
      user: ctx.teacherA,
      query: {},
    });
    const first = result.submissions[0];
    assert.strictEqual(first.answers, undefined, "answers should not be included in list response");
    assert.strictEqual(first.rawOmrSnapshot, undefined, "rawOmrSnapshot should not be in list response");
    assert.strictEqual(first.fillRatios, undefined, "fillRatios should not be in list response");
  });

  await t.test("T7.10 — listExamSubmissions: pagination works", async () => {
    const result = await submissionListService.listExamSubmissions({
      examId,
      user: ctx.teacherA,
      query: { page: 1, pageSize: 1 },
    });
    assert.strictEqual(result.submissions.length, 1);
    assert.strictEqual(result.pageSize, 1);
    assert.ok(result.totalPages >= 3);
  });

  await t.test("T7.11 — listExamSubmissions: isDuplicateSbd flagged correctly", async () => {
    const result = await submissionListService.listExamSubmissions({
      examId,
      user: ctx.teacherA,
      query: {},
    });
    const dupSubs = result.submissions.filter((s) => s.isDuplicateSbd);
    assert.strictEqual(dupSubs.length, 2, "Exactly 2 submissions should be flagged as duplicate SBD");
  });

  await t.test("T7.12 — listExamSubmissions: ADMIN cannot access — FORBIDDEN", async () => {
    await assert.rejects(
      () => submissionListService.listExamSubmissions({ examId, user: ctx.admin, query: {} }),
      (err) => {
        assert.ok(err.statusCode === 403 || err.code === "FORBIDDEN");
        return true;
      }
    );
  });

  await t.test("T7.13 — listExamSubmissions: cross-teacher access denied", async () => {
    await assert.rejects(
      () => submissionListService.listExamSubmissions({ examId, user: ctx.teacherB, query: {} }),
      (err) => {
        assert.ok(err.statusCode === 403 || err.code === "EXAM_ACCESS_DENIED");
        return true;
      }
    );
  });

  await t.test("T7.14 — getExamSubmissionsSummary: returns correct distinct group and row counts", async () => {
    const summary = await submissionListService.getExamSubmissionsSummary({
      examId,
      user: ctx.teacherA,
    });
    assert.strictEqual(summary.totalSubmissions, 3);
    assert.strictEqual(summary.finalCount, 2);
    assert.strictEqual(summary.provisionalCount, 1);
    assert.strictEqual(summary.identityNeedsReviewCount, 1);
    assert.strictEqual(summary.duplicateStudentNumberGroupCount, 1, "1 SBD group (100001) is duplicated");
    assert.strictEqual(summary.duplicateSubmissionCount, 2, "2 submissions share SBD 100001");
    assert.ok(summary.scoreStats !== undefined);
    assert.strictEqual(summary.scoreStats.max, 8.0);
    assert.strictEqual(summary.scoreStats.min, 7.0);
  });

  await t.test("T7.15 — getExamSubmissionsSummary: ADMIN cannot access — FORBIDDEN", async () => {
    await assert.rejects(
      () => submissionListService.getExamSubmissionsSummary({ examId, user: ctx.admin }),
      (err) => {
        assert.ok(err.statusCode === 403 || err.code === "FORBIDDEN");
        return true;
      }
    );
  });

  await t.test("T7.16 — getExamSubmissionsSummary: cross-teacher denied", async () => {
    await assert.rejects(
      () => submissionListService.getExamSubmissionsSummary({ examId, user: ctx.teacherB }),
      (err) => {
        assert.ok(err.statusCode === 403 || err.code === "EXAM_ACCESS_DENIED");
        return true;
      }
    );
  });

  // Cleanup
  await prisma.examSubmission.deleteMany({ where: { examId } });
  await prisma.answerSheetTemplate.deleteMany({ where: { examId } });
  await prisma.answerKey.deleteMany({ where: { examCodeId: ctx.examCode.id } });
  await prisma.examCode.deleteMany({ where: { examId } });
  await prisma.exam.delete({ where: { id: examId } });
});
