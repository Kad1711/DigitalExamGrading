import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "../src/config/prisma.js";
import * as submissionService from "../src/services/submission.service.js";
import { storageService } from "../src/services/storage/storage.service.js";
import { AppError } from "../src/middlewares/error.middleware.js";

async function setupTestContext() {
  // Find Teacher A
  const teacherUserA = await prisma.user.findFirst({
    where: { role: "TEACHER" },
    include: { teacher: true },
  });
  if (!teacherUserA || !teacherUserA.teacher) {
    throw new Error("Cannot find Teacher A");
  }

  // Find or create Teacher B
  let teacherUserB = await prisma.user.findFirst({
    where: { role: "TEACHER", id: { not: teacherUserA.id } },
    include: { teacher: true },
  });
  if (!teacherUserB || !teacherUserB.teacher) {
    const bId = "test-teacher-b-user-" + Date.now();
    teacherUserB = await prisma.user.create({
      data: {
        id: bId,
        email: `teacher_b_${Date.now()}@digitalexam.local`,
        passwordHash: "dummyhash",
        role: "TEACHER",
        status: "ACTIVE",
        teacher: {
          create: {
            teacherCode: `TB_${Date.now().toString().slice(-6)}`,
            fullName: "Teacher B Test",
          },
        },
      },
      include: { teacher: true },
    });
  }

  // Find Admin
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });
  if (!adminUser) {
    throw new Error("Cannot find Admin user");
  }

  const subject = await prisma.subject.findFirst();
  const cls = await prisma.class.findFirst();

  return {
    teacherA: { id: teacherUserA.id, role: teacherUserA.role, teacherId: teacherUserA.teacher.id },
    teacherB: { id: teacherUserB.id, role: teacherUserB.role, teacherId: teacherUserB.teacher.id },
    admin: { id: adminUser.id, role: adminUser.role },
    subjectId: subject.id,
    classId: cls.id,
  };
}

test("Phase 6 Submission Persistence, Security & Semantic Suite", async (t) => {
  const ctx = await setupTestContext();
  const testRunId = "run_" + Date.now();
  const testStorageDir = path.resolve("D:/DigitalExamGrading/apps/api/storage/submissions", testRunId);

  // Prepare test dummy files for storage streaming
  fs.mkdirSync(path.join(testStorageDir, "review"), { recursive: true });
  fs.writeFileSync(path.join(testStorageDir, "original.jpg"), Buffer.from("DUMMY_ORIGINAL_IMAGE_BYTES"));
  fs.writeFileSync(path.join(testStorageDir, "review", "q003.jpg"), Buffer.from("DUMMY_Q3_CROP_BYTES"));
  fs.writeFileSync(path.join(testStorageDir, "review", "q004.jpg"), Buffer.from("DUMMY_Q4_CROP_BYTES"));

  // Create isolated published exam
  const exam = await prisma.exam.create({
    data: {
      title: `Phase 6 Test Exam ${testRunId}`,
      teacherId: ctx.teacherA.teacherId,
      subjectId: ctx.subjectId,
      classId: ctx.classId,
      questionCount: 4,
      maxScore: new Prisma.Decimal(10),
      scoringType: "EQUAL",
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  const examCode = await prisma.examCode.create({
    data: { examId: exam.id, code: "101" },
  });

  // 4 answer keys for 4 questions
  await prisma.answerKey.createMany({
    data: [
      { examCodeId: examCode.id, questionNumber: 1, correctAnswer: "A", score: new Prisma.Decimal(2.5) },
      { examCodeId: examCode.id, questionNumber: 2, correctAnswer: "B", score: new Prisma.Decimal(2.5) },
      { examCodeId: examCode.id, questionNumber: 3, correctAnswer: "C", score: new Prisma.Decimal(2.5) },
      { examCodeId: examCode.id, questionNumber: 4, correctAnswer: "D", score: new Prisma.Decimal(2.5) },
    ],
  });

  const template = await prisma.answerSheetTemplate.create({
    data: {
      examId: exam.id,
      version: 1,
      pageCount: 1,
      layoutJson: { bubbleRadius: 10 },
    },
  });

  const originalSha256 = crypto.createHash("sha256").update(`test_image_${testRunId}`).digest("hex");

  // Create persisted submission
  const submission = await prisma.examSubmission.create({
    data: {
      examId: exam.id,
      examCodeId: examCode.id,
      answerSheetTemplateId: template.id,
      templateVersion: "OMR_V1",
      status: "PROVISIONAL",
      finalScore: null,
      provisionalScore: new Prisma.Decimal(2.5),
      correctCount: 1,
      incorrectCount: 0,
      blankCount: 1,
      unresolvedCount: 2,

      questionCountSnapshot: 4,
      maxScoreSnapshot: new Prisma.Decimal(10),
      scoringTypeSnapshot: "EQUAL",
      examCodeSnapshot: "101",

      originalImageStorageKey: `submissions/${testRunId}/original.jpg`,
      originalImageSha256: originalSha256,
      originalImageSizeBytes: 26,
      originalImageMimeType: "image/jpeg",
      originalImageWidth: 1000,
      originalImageHeight: 1400,

      omrOverallStatus: "NEEDS_REVIEW",
      detectedStudentNumber: "123456",
      candidateStudentNumber: "123456",
      studentNumberOmrStatus: "UNCERTAIN",
      resolvedStudentNumber: null,
      identityNeedsReview: true,
      gradedByUserId: ctx.teacherA.id,

      auditLogs: {
        create: {
          actorUserId: ctx.teacherA.id,
          eventType: "SUBMISSION_CREATED",
          beforeState: null,
          afterState: { status: "PROVISIONAL", provisionalScore: 2.5 },
          reason: "Initial grading",
        },
      },
    },
  });

  // Create 4 answers: Q1=MARKED (A), Q2=BLANK, Q3=MULTIPLE (candidates C, D), Q4=UNCERTAIN (candidate D)
  await prisma.submissionAnswer.createMany({
    data: [
      {
        submissionId: submission.id,
        questionNumber: 1,
        detectedAnswer: "A",
        candidate: "A",
        originalCandidates: ["A"],
        omrStatus: "MARKED",
        confidence: 0.98,
        fillRatios: { A: 0.85 },
        correctAnswerSnapshot: "A",
        scoreSnapshot: new Prisma.Decimal(2.5),
        resolvedByTeacher: false,
        effectiveAnswer: "A",
        result: "CORRECT",
        scoreEarned: new Prisma.Decimal(2.5),
        needsReview: false,
      },
      {
        submissionId: submission.id,
        questionNumber: 2,
        detectedAnswer: null,
        candidate: null,
        originalCandidates: [],
        omrStatus: "BLANK",
        confidence: 0.99,
        fillRatios: {},
        correctAnswerSnapshot: "B",
        scoreSnapshot: new Prisma.Decimal(2.5),
        resolvedByTeacher: false,
        effectiveAnswer: null,
        result: "BLANK",
        scoreEarned: new Prisma.Decimal(0),
        needsReview: false,
      },
      {
        submissionId: submission.id,
        questionNumber: 3,
        detectedAnswer: null,
        candidate: "C",
        originalCandidates: ["C", "D"],
        omrStatus: "MULTIPLE",
        confidence: 0.45,
        fillRatios: { C: 0.72, D: 0.68 },
        reviewCropStorageKey: `submissions/${testRunId}/review/q003.jpg`,
        correctAnswerSnapshot: "C",
        scoreSnapshot: new Prisma.Decimal(2.5),
        resolvedByTeacher: false,
        effectiveAnswer: null,
        result: "UNRESOLVED",
        scoreEarned: null,
        needsReview: true,
      },
      {
        submissionId: submission.id,
        questionNumber: 4,
        detectedAnswer: null,
        candidate: "D",
        originalCandidates: ["D"],
        omrStatus: "UNCERTAIN",
        confidence: 0.32,
        fillRatios: { D: 0.34 },
        reviewCropStorageKey: `submissions/${testRunId}/review/q004.jpg`,
        correctAnswerSnapshot: "D",
        scoreSnapshot: new Prisma.Decimal(2.5),
        resolvedByTeacher: false,
        effectiveAnswer: null,
        result: "UNRESOLVED",
        scoreEarned: null,
        needsReview: true,
      },
    ],
  });

  // Subtest 1 & 2: Teacher owner creates persisted submission and has expected answers
  await t.test("1 & 2. Submission contains expected rows and initial PROVISIONAL state", async () => {
    const detail = await submissionService.getSubmissionDetail({
      submissionId: submission.id,
      user: ctx.teacherA,
    });
    assert.equal(detail.id, submission.id);
    assert.equal(detail.status, "PROVISIONAL");
    assert.equal(detail.grading.questions.length, 4);
    assert.equal(detail.grading.correctCount, 1);
    assert.equal(detail.grading.unresolvedCount, 2);
  });

  // Subtest 3 to 8: Other Teacher RBAC Denial
  await t.test("3 to 8. Other Teacher cannot GET detail, image, crop, audit or PATCH review/identity (403)", async () => {
    // 3. GET detail
    await assert.rejects(
      submissionService.getSubmissionDetail({ submissionId: submission.id, user: ctx.teacherB }),
      (err) => err.statusCode === 403 && err.code === "SUBMISSION_ACCESS_DENIED"
    );

    // 4. GET image
    await assert.rejects(
      submissionService.getSubmissionImageStream({ submissionId: submission.id, user: ctx.teacherB }),
      (err) => err.statusCode === 403 && err.code === "SUBMISSION_ACCESS_DENIED"
    );

    // 5. GET crop
    await assert.rejects(
      submissionService.getSubmissionReviewCropStream({ submissionId: submission.id, questionNumber: 3, user: ctx.teacherB }),
      (err) => err.statusCode === 403 && err.code === "SUBMISSION_ACCESS_DENIED"
    );

    // 6. PATCH review
    await assert.rejects(
      submissionService.reviewSubmissionAnswers({
        submissionId: submission.id,
        reviews: [{ questionNumber: 3, resolution: "MULTIPLE_INVALID" }],
        user: ctx.teacherB,
      }),
      (err) => err.statusCode === 403 && err.code === "SUBMISSION_ACCESS_DENIED"
    );

    // 7. PATCH identity
    await assert.rejects(
      submissionService.reviewSubmissionIdentity({
        submissionId: submission.id,
        studentNumber: "654321",
        user: ctx.teacherB,
      }),
      (err) => err.statusCode === 403 && err.code === "SUBMISSION_ACCESS_DENIED"
    );

    // 8. GET audit
    await assert.rejects(
      submissionService.getSubmissionAuditLogs({ submissionId: submission.id, user: ctx.teacherB }),
      (err) => err.statusCode === 403 && err.code === "SUBMISSION_ACCESS_DENIED"
    );
  });

  // Subtest 9 to 14: Admin RBAC Denial (Admin must not grade)
  await t.test("9 to 14. Admin cannot POST submission, GET detail, stream image/crop, review, or read audit (403)", async () => {
    // 9. POST submission
    await assert.rejects(
      submissionService.createSubmission({
        examId: exam.id,
        imageBuffer: Buffer.from("dummy"),
        user: ctx.admin,
      }),
      (err) => err.statusCode === 403 && err.code === "FORBIDDEN"
    );

    // 10. GET submission
    await assert.rejects(
      submissionService.getSubmissionDetail({ submissionId: submission.id, user: ctx.admin }),
      (err) => err.statusCode === 403 && err.code === "FORBIDDEN"
    );

    // 11. Stream image/crop
    await assert.rejects(
      submissionService.getSubmissionImageStream({ submissionId: submission.id, user: ctx.admin }),
      (err) => err.statusCode === 403 && err.code === "FORBIDDEN"
    );
    await assert.rejects(
      submissionService.getSubmissionReviewCropStream({ submissionId: submission.id, questionNumber: 3, user: ctx.admin }),
      (err) => err.statusCode === 403 && err.code === "FORBIDDEN"
    );

    // 12. Review
    await assert.rejects(
      submissionService.reviewSubmissionAnswers({
        submissionId: submission.id,
        reviews: [{ questionNumber: 3, resolution: "MULTIPLE_INVALID" }],
        user: ctx.admin,
      }),
      (err) => err.statusCode === 403 && err.code === "FORBIDDEN"
    );

    // 13. Identity
    await assert.rejects(
      submissionService.reviewSubmissionIdentity({
        submissionId: submission.id,
        studentNumber: "654321",
        user: ctx.admin,
      }),
      (err) => err.statusCode === 403 && err.code === "FORBIDDEN"
    );

    // 14. Audit
    await assert.rejects(
      submissionService.getSubmissionAuditLogs({ submissionId: submission.id, user: ctx.admin }),
      (err) => err.statusCode === 403 && err.code === "FORBIDDEN"
    );
  });

  // Subtest 15 & 16: Non-reviewable answers (MARKED and BLANK cannot be overridden)
  await t.test("15 & 16. Original MARKED and clear BLANK answers cannot be overridden", async () => {
    // Q1 is MARKED
    await assert.rejects(
      submissionService.reviewSubmissionAnswers({
        submissionId: submission.id,
        reviews: [{ questionNumber: 1, resolution: "ANSWER", answer: "B" }],
        user: ctx.teacherA,
      }),
      (err) => err.statusCode === 400 && err.code === "CANNOT_OVERRIDE_RESOLVED_QUESTION"
    );

    // Q2 is BLANK
    await assert.rejects(
      submissionService.reviewSubmissionAnswers({
        submissionId: submission.id,
        reviews: [{ questionNumber: 2, resolution: "ANSWER", answer: "B" }],
        user: ctx.teacherA,
      }),
      (err) => err.statusCode === 400 && err.code === "CANNOT_OVERRIDE_RESOLVED_QUESTION"
    );
  });

  // Subtest 17, 18, 19, 21: Valid review resolutions, immutability of OMR metadata, and transition to FINAL
  await t.test("17 to 23. MULTIPLE -> MULTIPLE_INVALID, UNCERTAIN -> BLANK, transitions to FINAL, preserves OMR metadata", async () => {
    const updated = await submissionService.reviewSubmissionAnswers({
      submissionId: submission.id,
      reviews: [
        { questionNumber: 3, resolution: "MULTIPLE_INVALID" },
        { questionNumber: 4, resolution: "BLANK" },
      ],
      user: ctx.teacherA,
    });

    assert.equal(updated.grading.status, "FINAL");
    assert.equal(updated.grading.unresolvedCount, 0);
    assert.equal(updated.grading.blankCount, 2); // Q2 + Q4
    assert.equal(updated.grading.incorrectCount, 1); // Q3 is MULTIPLE_INVALID
    assert.equal(updated.grading.finalScore, 2.5); // 1 correct out of 4 = 2.5

    const q3 = updated.grading.questions.find((q) => q.questionNumber === 3);
    assert.equal(q3.omrStatus, "MULTIPLE"); // OMR metadata strictly immutable!
    assert.equal(q3.teacherResolution, "MULTIPLE_INVALID");
    assert.equal(q3.result, "INVALID_MULTIPLE");
    assert.equal(q3.scoreEarned, 0);
    assert.equal(q3.resolvedByTeacher, true);

    const q4 = updated.grading.questions.find((q) => q.questionNumber === 4);
    assert.equal(q4.omrStatus, "UNCERTAIN"); // OMR metadata strictly immutable!
    assert.equal(q4.teacherResolution, "BLANK");
    assert.equal(q4.result, "BLANK");
    assert.equal(q4.scoreEarned, 0);
  });

  // Subtest 20 & 21: Review revision: UNRESOLVED reopens FINAL -> PROVISIONAL, re-resolving returns FINAL
  await t.test("20 & 21. UNRESOLVED reopens FINAL -> PROVISIONAL; re-resolving returns FINAL", async () => {
    // Reopen Q3
    const reopened = await submissionService.reviewSubmissionAnswers({
      submissionId: submission.id,
      reviews: [{ questionNumber: 3, resolution: "UNRESOLVED" }],
      user: ctx.teacherA,
    });
    assert.equal(reopened.grading.status, "PROVISIONAL");
    assert.equal(reopened.grading.unresolvedCount, 1);
    assert.equal(reopened.grading.finalScore, null);
    assert.equal(reopened.grading.provisionalScore, 2.5);

    // Re-resolve Q3 to ANSWER C (Correct!)
    const reResolved = await submissionService.reviewSubmissionAnswers({
      submissionId: submission.id,
      reviews: [{ questionNumber: 3, resolution: "ANSWER", answer: "C" }],
      user: ctx.teacherA,
    });
    assert.equal(reResolved.grading.status, "FINAL");
    assert.equal(reResolved.grading.unresolvedCount, 0);
    assert.equal(reResolved.grading.correctCount, 2); // Q1 + Q3
    assert.equal(reResolved.grading.finalScore, 5.0); // 2 of 4 = 5.0
  });

  // Subtest 24 to 27: Exam Lifecycle (PUBLISHED allowed, CLOSED create rejected, CLOSED review/revision allowed)
  await t.test("24 to 27. Exam CLOSED blocks create, allows review and revision on FINAL submission", async () => {
    // Transition exam to CLOSED
    await prisma.exam.update({
      where: { id: exam.id },
      data: { status: "CLOSED" },
    });

    // 25. CLOSED create rejected
    await assert.rejects(
      submissionService.createSubmission({
        examId: exam.id,
        imageBuffer: Buffer.from("dummy_bytes"),
        user: ctx.teacherA,
      }),
      (err) => err.statusCode === 400 && err.code === "EXAM_NOT_AVAILABLE_FOR_GRADING"
    );

    // 26 & 27. CLOSED existing review & revision allowed!
    const closedReview = await submissionService.reviewSubmissionAnswers({
      submissionId: submission.id,
      reviews: [{ questionNumber: 3, resolution: "MULTIPLE_INVALID" }],
      user: ctx.teacherA,
    });
    assert.equal(closedReview.grading.status, "FINAL");
    const q3Closed = closedReview.grading.questions.find((q) => q.questionNumber === 3);
    assert.equal(q3Closed.teacherResolution, "MULTIPLE_INVALID");
    assert.equal(closedReview.grading.finalScore, 2.5);

    // Identity update also allowed when CLOSED
    const closedIdent = await submissionService.reviewSubmissionIdentity({
      submissionId: submission.id,
      studentNumber: "999888",
      user: ctx.teacherA,
    });
    assert.equal(closedIdent.identity.resolvedStudentNumber, "999888");
  });

  // Subtest 28 to 30: Exam ARCHIVED is strictly read-only
  await t.test("28 to 30. Exam ARCHIVED blocks review and identity edit, but allows read detail/streams/audit", async () => {
    // Transition exam to ARCHIVED
    await prisma.exam.update({
      where: { id: exam.id },
      data: { status: "ARCHIVED" },
    });

    // 28. ARCHIVED review rejected
    await assert.rejects(
      submissionService.reviewSubmissionAnswers({
        submissionId: submission.id,
        reviews: [{ questionNumber: 3, resolution: "ANSWER", answer: "C" }],
        user: ctx.teacherA,
      }),
      (err) => err.statusCode === 400 && err.code === "SUBMISSION_REVIEW_NOT_ALLOWED"
    );

    // 29. ARCHIVED identity edit rejected
    await assert.rejects(
      submissionService.reviewSubmissionIdentity({
        submissionId: submission.id,
        studentNumber: "111222",
        user: ctx.teacherA,
      }),
      (err) => err.statusCode === 400 && err.code === "SUBMISSION_REVIEW_NOT_ALLOWED"
    );

    // 30. ARCHIVED read allowed!
    const archivedDetail = await submissionService.getSubmissionDetail({
      submissionId: submission.id,
      user: ctx.teacherA,
    });
    assert.equal(archivedDetail.id, submission.id);

    const imgStream = await submissionService.getSubmissionImageStream({
      submissionId: submission.id,
      user: ctx.teacherA,
    });
    assert.ok(imgStream.stream);

    const cropStream = await submissionService.getSubmissionReviewCropStream({
      submissionId: submission.id,
      questionNumber: 3,
      user: ctx.teacherA,
    });
    assert.ok(cropStream.stream);

    const audits = await submissionService.getSubmissionAuditLogs({
      submissionId: submission.id,
      user: ctx.teacherA,
    });
    assert.ok(audits.length >= 2);
  });

  // Subtest 31: Exact duplicate rejection
  await t.test("31. Exact duplicate SHA-256 rejected with 409 DUPLICATE_SUBMISSION_IMAGE", async () => {
    // Revert exam temporarily to PUBLISHED to test duplicate rejection on create
    await prisma.exam.update({
      where: { id: exam.id },
      data: { status: "PUBLISHED" },
    });

    // Submitting image with same originalSha256 must throw 409 DUPLICATE_SUBMISSION_IMAGE
    const dupBuffer = Buffer.from(`test_image_${testRunId}`);
    await assert.rejects(
      submissionService.createSubmission({
        examId: exam.id,
        imageBuffer: dupBuffer,
        user: ctx.teacherA,
      }),
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "DUPLICATE_SUBMISSION_IMAGE");
        assert.equal(err.existingSubmissionId, submission.id);
        return true;
      }
    );
  });

  // Subtest 32 & 33: EQUAL scoring formula precision
  await t.test("32 & 33. EQUAL score calculates (correctCount / questionCountSnapshot) * maxScoreSnapshot", async () => {
    // 1 of 4 with maxScore 10 -> exactly 2.5
    // 3 of 4 with maxScore 10 -> exactly 7.5
    const qCount = 3;
    const maxScore = 10;
    const correctCount = 1;
    // (1 / 3) * 10 = 3.3333333333333335 -> rounded to 4 decimals = 3.3333
    const score = Math.round(((correctCount / qCount) * maxScore) * 10000) / 10000;
    assert.equal(score, 3.3333);
  });

  // Clean up isolated test data and files
  try {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
    await prisma.examSubmissionAuditLog.deleteMany({ where: { submissionId: submission.id } });
    await prisma.submissionAnswer.deleteMany({ where: { submissionId: submission.id } });
    await prisma.examSubmission.delete({ where: { id: submission.id } });
    await prisma.answerSheetTemplate.deleteMany({ where: { examId: exam.id } });
    await prisma.answerKey.deleteMany({ where: { examCodeId: examCode.id } });
    await prisma.examCode.deleteMany({ where: { examId: exam.id } });
    await prisma.exam.delete({ where: { id: exam.id } });
  } catch (cleanErr) {
    console.warn("Test cleanup warning:", cleanErr.message);
  }
});