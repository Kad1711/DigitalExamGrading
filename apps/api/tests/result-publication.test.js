import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import prisma from "../src/config/prisma.js";
import * as publicationService from "../src/services/result-publication.service.js";
import * as submissionService from "../src/services/submission.service.js";
import { updateExam } from "../src/services/exam.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

async function setupPublicationContext() {
  const teacherUserA = await prisma.user.findFirst({
    where: { role: "TEACHER" },
    include: { teacher: true },
  });
  if (!teacherUserA?.teacher) throw new Error("No Teacher A found");

  let teacherUserB = await prisma.user.findFirst({
    where: { role: "TEACHER", id: { not: teacherUserA.id } },
    include: { teacher: true },
  });
  if (!teacherUserB?.teacher) {
    teacherUserB = await prisma.user.create({
      data: {
        email: `pub_test_teacher_b_${Date.now()}@digitalexam.local`,
        passwordHash: "dummyhash",
        role: "TEACHER",
        status: "ACTIVE",
        teacher: {
          create: {
            teacherCode: `PTB_${Date.now().toString().slice(-6)}`,
            fullName: "Pub Test Teacher B",
          },
        },
      },
      include: { teacher: true },
    });
  }

  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!adminUser) throw new Error("No Admin found");

  const subject = await prisma.subject.findFirst();
  const cls = await prisma.class.findFirst();

  // Create CLOSED exam with all FINAL, no identity issues, no duplicate SBDs
  const exam = await prisma.exam.create({
    data: {
      title: `Publication Test Exam ${Date.now()}`,
      teacherId: teacherUserA.teacher.id,
      subjectId: subject.id,
      classId: cls.id,
      questionCount: 4,
      maxScore: new Prisma.Decimal("10.0000"),
      scoringType: "EQUAL",
      status: "CLOSED",
    },
  });

  const examCode = await prisma.examCode.create({
    data: { examId: exam.id, code: "001" },
  });

  for (let q = 1; q <= 4; q++) {
    await prisma.answerKey.create({
      data: {
        examCodeId: examCode.id,
        questionNumber: q,
        correctAnswer: "A",
        score: new Prisma.Decimal("2.5000"),
      },
    });
  }

  const template = await prisma.answerSheetTemplate.create({
    data: { examId: exam.id, version: 1, layoutJson: {} },
  });

  // Create 2 FINAL submissions with unique SBDs, no identity review needed
  const sub1 = await prisma.examSubmission.create({
    data: {
      examId: exam.id,
      examCodeId: examCode.id,
      answerSheetTemplateId: template.id,
      gradedByUserId: teacherUserA.id,
      status: "FINAL",
      detectedStudentNumber: "200001",
      candidateStudentNumber: "200001",
      studentNumberOmrStatus: "DETECTED",
      resolvedStudentNumber: "200001",
      identityNeedsReview: false,
      originalImageStorageKey: `pub-test/${Date.now()}-1/original.jpg`,
      originalImageSha256: `sha256_pub_sub1_${Date.now()}`,
      originalImageMimeType: "image/jpeg",
      originalImageSizeBytes: 1000,
      omrOverallStatus: "OK",
      questionCountSnapshot: 4,
      maxScoreSnapshot: new Prisma.Decimal("10.0000"),
      scoringTypeSnapshot: "EQUAL",
      examCodeSnapshot: "001",
      correctCount: 4,
      incorrectCount: 0,
      blankCount: 0,
      unresolvedCount: 0,
      finalScore: new Prisma.Decimal("10.0000"),
      finalizedAt: new Date(),
    },
  });

  // Create 4 answer rows for sub1 (question 1 is MULTIPLE resolved by teacher to ANSWER A)
  for (let q = 1; q <= 4; q++) {
    await prisma.submissionAnswer.create({
      data: {
        submissionId: sub1.id,
        questionNumber: q,
        correctAnswerSnapshot: "A",
        scoreSnapshot: new Prisma.Decimal("2.5000"),
        detectedAnswer: "A",
        candidate: "A",
        omrStatus: q === 1 ? "MULTIPLE" : "MARKED",
        resolvedByTeacher: q === 1,
        teacherResolution: q === 1 ? "ANSWER" : null,
        resolvedAnswer: q === 1 ? "A" : null,
        scoreEarned: new Prisma.Decimal("2.5000"),
        result: "CORRECT",
        confidence: 1.0,
        fillRatios: { A: 0.9, B: 0.05, C: 0.02, D: 0.01 },
      },
    });
  }

  const sub2 = await prisma.examSubmission.create({
    data: {
      examId: exam.id,
      examCodeId: examCode.id,
      answerSheetTemplateId: template.id,
      gradedByUserId: teacherUserA.id,
      status: "FINAL",
      detectedStudentNumber: "200002",
      candidateStudentNumber: "200002",
      studentNumberOmrStatus: "DETECTED",
      resolvedStudentNumber: "200002",
      identityNeedsReview: false,
      originalImageStorageKey: `pub-test/${Date.now()}-2/original.jpg`,
      originalImageSha256: `sha256_pub_sub2_${Date.now()}`,
      originalImageMimeType: "image/jpeg",
      originalImageSizeBytes: 1000,
      omrOverallStatus: "OK",
      questionCountSnapshot: 4,
      maxScoreSnapshot: new Prisma.Decimal("10.0000"),
      scoringTypeSnapshot: "EQUAL",
      examCodeSnapshot: "001",
      correctCount: 2,
      incorrectCount: 2,
      blankCount: 0,
      unresolvedCount: 0,
      finalScore: new Prisma.Decimal("5.0000"),
      finalizedAt: new Date(),
    },
  });

  for (let q = 1; q <= 4; q++) {
    await prisma.submissionAnswer.create({
      data: {
        submissionId: sub2.id,
        questionNumber: q,
        correctAnswerSnapshot: "A",
        scoreSnapshot: new Prisma.Decimal("2.5000"),
        detectedAnswer: q <= 2 ? "A" : "B",
        candidate: q <= 2 ? "A" : "B",
        omrStatus: "MARKED",
        scoreEarned: q <= 2 ? new Prisma.Decimal("2.5000") : new Prisma.Decimal("0.0000"),
        result: q <= 2 ? "CORRECT" : "INCORRECT",
        confidence: 1.0,
        fillRatios: { A: 0.9, B: 0.05, C: 0.02, D: 0.01 },
      },
    });
  }

  return {
    teacherA: { id: teacherUserA.id, role: "TEACHER" },
    teacherB: { id: teacherUserB.id, role: "TEACHER" },
    admin: { id: adminUser.id, role: "ADMIN" },
    exam,
    examCode,
    template,
    sub1,
    sub2,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Phase 8 — Result Publication & Security Audit", async (t) => {
  const ctx = await setupPublicationContext();
  const examId = ctx.exam.id;

  await t.test("T8.1 — getPublicationStatus: initially not published, status CLOSED, ready", async () => {
    const status = await publicationService.getPublicationStatus({ examId, user: ctx.teacherA });
    assert.strictEqual(status.isPublished, false);
    assert.strictEqual(status.publishedAt, null);
    assert.ok(status.readiness);
    assert.strictEqual(status.readiness.ready, true, "Exam should be ready to publish");
    assert.strictEqual(status.readiness.issues.length, 0);
  });

  await t.test("T8.2 — getPublicationStatus: Admin denied (403 FORBIDDEN)", async () => {
    await assert.rejects(
      () => publicationService.getPublicationStatus({ examId, user: ctx.admin }),
      (err) => {
        assert.ok(err.statusCode === 403 || err.code === "FORBIDDEN");
        return true;
      }
    );
  });

  await t.test("T8.3 — getPublicationStatus: cross-teacher denied (403)", async () => {
    await assert.rejects(
      () => publicationService.getPublicationStatus({ examId, user: ctx.teacherB }),
      (err) => {
        assert.ok(err.statusCode === 403 || err.code === "EXAM_ACCESS_DENIED");
        return true;
      }
    );
  });

  await t.test("T8.4 — Section 2: Zero submissions blocks publication (NO_RESULTS_TO_PUBLISH)", async () => {
    // Create an empty CLOSED exam
    const emptyExam = await prisma.exam.create({
      data: {
        title: `Empty Exam ${Date.now()}`,
        teacherId: (await prisma.teacher.findFirst({ where: { userId: ctx.teacherA.id } })).id,
        subjectId: (await prisma.subject.findFirst()).id,
        classId: (await prisma.class.findFirst()).id,
        questionCount: 4,
        maxScore: new Prisma.Decimal("10.0000"),
        scoringType: "EQUAL",
        status: "CLOSED",
      },
    });

    const status = await publicationService.getPublicationStatus({ examId: emptyExam.id, user: ctx.teacherA });
    assert.strictEqual(status.readiness.ready, false);
    assert.ok(status.readiness.blockers.includes("NO_RESULTS_TO_PUBLISH"));

    // Attempting to publish MUST fail
    await assert.rejects(
      () => publicationService.publishExamResults({ examId: emptyExam.id, user: ctx.teacherA, note: null }),
      (err) => {
        assert.ok(err.statusCode === 422 || err.code === "PUBLICATION_READINESS_FAILED");
        assert.ok(err.details?.blockers?.includes("NO_RESULTS_TO_PUBLISH"));
        return true;
      }
    );

    // Verify DB remains untouched
    const checkDb = await prisma.exam.findUnique({ where: { id: emptyExam.id } });
    assert.strictEqual(checkDb.resultsPublishedAt, null);

    const logCount = await prisma.examResultPublicationLog.count({ where: { examId: emptyExam.id } });
    assert.strictEqual(logCount, 0, "No publication log should be created");

    await prisma.exam.delete({ where: { id: emptyExam.id } });
  });

  await t.test("T8.5 — Section 3: Require at least one FINAL result (only PROVISIONAL blocks publish)", async () => {
    const provOnlyExam = await prisma.exam.create({
      data: {
        title: `Prov Only Exam ${Date.now()}`,
        teacherId: (await prisma.teacher.findFirst({ where: { userId: ctx.teacherA.id } })).id,
        subjectId: (await prisma.subject.findFirst()).id,
        classId: (await prisma.class.findFirst()).id,
        questionCount: 4,
        maxScore: new Prisma.Decimal("10.0000"),
        scoringType: "EQUAL",
        status: "CLOSED",
      },
    });
    const sub = await prisma.examSubmission.create({
      data: {
        examId: provOnlyExam.id,
        examCodeId: ctx.examCode.id,
        answerSheetTemplateId: ctx.template.id,
        gradedByUserId: ctx.teacherA.id,
        status: "PROVISIONAL",
        detectedStudentNumber: "999999",
        candidateStudentNumber: "999999",
        studentNumberOmrStatus: "DETECTED",
        resolvedStudentNumber: "999999",
        identityNeedsReview: false,
        originalImageStorageKey: "test",
        originalImageSha256: `sha_${Date.now()}`,
        originalImageMimeType: "image/jpeg",
        originalImageSizeBytes: 100,
        omrOverallStatus: "OK",
        questionCountSnapshot: 4,
        maxScoreSnapshot: new Prisma.Decimal("10.0000"),
        scoringTypeSnapshot: "EQUAL",
        examCodeSnapshot: "001",
        correctCount: 2,
        incorrectCount: 0,
        blankCount: 0,
        unresolvedCount: 2,
      },
    });

    const status = await publicationService.getPublicationStatus({ examId: provOnlyExam.id, user: ctx.teacherA });
    assert.strictEqual(status.readiness.ready, false);
    assert.ok(status.readiness.blockers.includes("NO_FINAL_RESULTS"));

    await prisma.examSubmission.delete({ where: { id: sub.id } });
    await prisma.exam.delete({ where: { id: provOnlyExam.id } });
  });

  await t.test("T8.6 — Section 35: Duplicate confirmed SBD blocks publication (DUPLICATE_STUDENT_NUMBERS_EXIST)", async () => {
    // Create a duplicate SBD submission for ctx.exam (SBD 200001 already used by sub1)
    const dupSub = await prisma.examSubmission.create({
      data: {
        examId,
        examCodeId: ctx.examCode.id,
        answerSheetTemplateId: ctx.template.id,
        gradedByUserId: ctx.teacherA.id,
        status: "FINAL",
        detectedStudentNumber: "200001",
        candidateStudentNumber: "200001",
        studentNumberOmrStatus: "DETECTED",
        resolvedStudentNumber: "200001", // DUPLICATE with sub1
        identityNeedsReview: false,
        originalImageStorageKey: `dup-test/${Date.now()}/original.jpg`,
        originalImageSha256: `sha256_dup_${Date.now()}`,
        originalImageMimeType: "image/jpeg",
        originalImageSizeBytes: 1000,
        omrOverallStatus: "OK",
        questionCountSnapshot: 4,
        maxScoreSnapshot: new Prisma.Decimal("10.0000"),
        scoringTypeSnapshot: "EQUAL",
        examCodeSnapshot: "001",
        correctCount: 3,
        incorrectCount: 1,
        blankCount: 0,
        unresolvedCount: 0,
        finalScore: new Prisma.Decimal("7.5000"),
        finalizedAt: new Date(),
      },
    });

    const status = await publicationService.getPublicationStatus({ examId, user: ctx.teacherA });
    assert.strictEqual(status.readiness.ready, false);
    assert.ok(status.readiness.blockers.includes("DUPLICATE_STUDENT_NUMBERS_EXIST"));

    // Attempting to publish MUST fail
    await assert.rejects(
      () => publicationService.publishExamResults({ examId, user: ctx.teacherA, note: null }),
      (err) => {
        assert.ok(err.statusCode === 422 || err.code === "PUBLICATION_READINESS_FAILED");
        assert.ok(err.details?.blockers?.includes("DUPLICATE_STUDENT_NUMBERS_EXIST"));
        return true;
      }
    );

    // Clean up duplicate sub
    await prisma.examSubmission.delete({ where: { id: dupSub.id } });
  });

  await t.test("T8.7 — Section 12: Generic PATCH /exams/:examId cannot set publication fields", async () => {
    // In DRAFT exam, try to send resultsPublishedAt in PATCH
    const draftExam = await prisma.exam.create({
      data: {
        title: `Draft Exam ${Date.now()}`,
        teacherId: (await prisma.teacher.findFirst({ where: { userId: ctx.teacherA.id } })).id,
        subjectId: (await prisma.subject.findFirst()).id,
        classId: (await prisma.class.findFirst()).id,
        questionCount: 4,
        maxScore: new Prisma.Decimal("10.0000"),
        scoringType: "EQUAL",
        status: "DRAFT",
      },
    });

    // Update with dangerous payload
    await updateExam(
      draftExam.id,
      { title: "Updated Title", resultsPublishedAt: new Date(), resultsPublishedByUserId: "evil" },
      ctx.teacherA
    );

    const check = await prisma.exam.findUnique({ where: { id: draftExam.id } });
    assert.strictEqual(check.title, "Updated Title");
    assert.strictEqual(check.resultsPublishedAt, null, "resultsPublishedAt must NOT be settable via generic update");
    assert.strictEqual(check.resultsPublishedByUserId, null);

    await prisma.exam.delete({ where: { id: draftExam.id } });
  });

  await t.test("T8.8 — publishExamResults: successfully publishes clean ready exam", async () => {
    const result = await publicationService.publishExamResults({
      examId,
      user: ctx.teacherA,
      note: "Chính thức công bố",
    });
    assert.strictEqual(result.isPublished, true);
    assert.ok(result.publishedAt);
    assert.ok(result.publishedBy);
    assert.strictEqual(result.publishedBy.id, ctx.teacherA.id);
  });

  await t.test("T8.9 — publishExamResults: already published returns 409", async () => {
    await assert.rejects(
      () => publicationService.publishExamResults({ examId, user: ctx.teacherA, note: null }),
      (err) => {
        assert.ok(err.statusCode === 409 || err.code === "RESULTS_ALREADY_PUBLISHED");
        return true;
      }
    );
  });

  await t.test("T8.10 — Section 15: Published exam locks submission answer review (RESULTS_PUBLISHED_LOCKED)", async () => {
    await assert.rejects(
      () =>
        submissionService.reviewSubmissionAnswers({
          submissionId: ctx.sub1.id,
          reviews: [{ questionNumber: 1, resolution: "MULTIPLE_INVALID" }],
          user: ctx.teacherA,
        }),
      (err) => {
        assert.ok(err.statusCode === 403);
        assert.strictEqual(err.code, "RESULTS_PUBLISHED_LOCKED");
        return true;
      }
    );
  });

  await t.test("T8.11 — Section 15: Published exam locks student identity review (RESULTS_PUBLISHED_LOCKED)", async () => {
    await assert.rejects(
      () =>
        submissionService.reviewSubmissionIdentity({
          submissionId: ctx.sub1.id,
          studentNumber: "999999",
          user: ctx.teacherA,
        }),
      (err) => {
        assert.ok(err.statusCode === 403);
        assert.strictEqual(err.code, "RESULTS_PUBLISHED_LOCKED");
        return true;
      }
    );
  });

  await t.test("T8.12 — Section 16: Complete Unpublish -> Correct -> Republish lifecycle", async () => {
    // Step C: Unpublish
    const unpubResult = await publicationService.unpublishExamResults({
      examId,
      user: ctx.teacherA,
      note: "Cần chấm phúc khảo",
    });
    assert.strictEqual(unpubResult.isPublished, false);
    assert.strictEqual(unpubResult.publishedAt, null);

    // Step D: Review is now UNLOCKED. Teacher marks question 1 UNRESOLVED -> status becomes PROVISIONAL
    const reviewResult = await submissionService.reviewSubmissionAnswers({
      submissionId: ctx.sub1.id,
      reviews: [{ questionNumber: 1, resolution: "UNRESOLVED" }],
      user: ctx.teacherA,
    });
    assert.strictEqual(reviewResult.status, "PROVISIONAL");

    // Step E: Attempt republish -> MUST BE BLOCKED because PROVISIONAL submission exists!
    await assert.rejects(
      () => publicationService.publishExamResults({ examId, user: ctx.teacherA, note: "republish" }),
      (err) => {
        assert.ok(err.statusCode === 422 || err.code === "PUBLICATION_READINESS_FAILED");
        assert.ok(err.details?.blockers?.includes("PROVISIONAL_SUBMISSIONS_EXIST"));
        return true;
      }
    );

    // Step F: Teacher resolves question 1 back to teacher override -> status becomes FINAL
    const resolveResult = await submissionService.reviewSubmissionAnswers({
      submissionId: ctx.sub1.id,
      reviews: [{ questionNumber: 1, resolution: "ANSWER", answer: "A" }],
      user: ctx.teacherA,
    });
    assert.strictEqual(resolveResult.status, "FINAL");

    // Step G: Republish succeeds!
    const repubResult = await publicationService.publishExamResults({
      examId,
      user: ctx.teacherA,
      note: "Công bố lại sau phúc khảo",
    });
    assert.strictEqual(repubResult.isPublished, true);

    // Verify chronological publication logs: PUBLISHED -> UNPUBLISHED -> PUBLISHED
    const logs = await publicationService.getPublicationLogs({ examId, user: ctx.teacherA });
    assert.ok(logs.length >= 3);
    const actions = logs.map((l) => l.action);
    assert.deepStrictEqual(actions.slice(-3), ["PUBLISHED", "UNPUBLISHED", "PUBLISHED"]);
  });

  await t.test("T8.13 — Section 18: ARCHIVED exam blocks publish and unpublish", async () => {
    // Archive the exam
    await prisma.exam.update({ where: { id: examId }, data: { status: "ARCHIVED" } });

    await assert.rejects(
      () => publicationService.unpublishExamResults({ examId, user: ctx.teacherA, note: "unpub" }),
      (err) => {
        assert.ok(err.statusCode === 400 || err.code === "EXAM_ARCHIVED");
        return true;
      }
    );

    // Restore to CLOSED for cleanup
    await prisma.exam.update({ where: { id: examId }, data: { status: "CLOSED" } });
  });

  // Cleanup
  await prisma.examResultPublicationLog.deleteMany({ where: { examId } });
  await prisma.submissionAnswer.deleteMany({ where: { submission: { examId } } });
  await prisma.examSubmission.deleteMany({ where: { examId } });
  await prisma.answerSheetTemplate.deleteMany({ where: { examId } });
  await prisma.answerKey.deleteMany({ where: { examCodeId: ctx.examCode.id } });
  await prisma.examCode.deleteMany({ where: { examId } });
  await prisma.exam.delete({ where: { id: examId } });
});
