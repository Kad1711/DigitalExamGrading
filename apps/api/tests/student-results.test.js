import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import prisma from "../src/config/prisma.js";
import * as studentResultService from "../src/services/student-result.service.js";
import * as publicationService from "../src/services/result-publication.service.js";
import { assignCandidate } from "../src/services/exam-candidate.service.js";

async function setupStudentTestFixture() {
  const ts = Date.now();

  // Create Teacher
  const teacherUser = await prisma.user.create({
    data: {
      email: `teacher_st_${ts}@digitalexam.local`,
      passwordHash: "dummyhash",
      role: "TEACHER",
      status: "ACTIVE",
      teacher: {
        create: {
          teacherCode: `TST_${ts.toString().slice(-6)}`,
          fullName: "Student Test Teacher",
        },
      },
    },
    include: { teacher: true },
  });

  const subject = await prisma.subject.findFirst();
  const cls = await prisma.class.findFirst();

  // Create Student A User & Profile
  const studentAUser = await prisma.user.create({
    data: {
      email: `student_a_${ts}@digitalexam.local`,
      passwordHash: "dummyhash",
      role: "STUDENT",
      status: "ACTIVE",
      student: {
        create: {
          studentCode: `SA_${ts.toString().slice(-6)}`,
          fullName: "Student Alpha",
        },
      },
    },
    include: { student: true },
  });

  // Create Student B User & Profile
  const studentBUser = await prisma.user.create({
    data: {
      email: `student_b_${ts}@digitalexam.local`,
      passwordHash: "dummyhash",
      role: "STUDENT",
      status: "ACTIVE",
      student: {
        create: {
          studentCode: `SB_${ts.toString().slice(-6)}`,
          fullName: "Student Beta",
        },
      },
    },
    include: { student: true },
  });

  // Create Exam
  const exam = await prisma.exam.create({
    data: {
      title: `Student Portal Test Exam ${ts}`,
      teacherId: teacherUser.teacher.id,
      subjectId: subject.id,
      classId: cls.id,
      questionCount: 4,
      maxScore: new Prisma.Decimal("10.0000"),
      scoringType: "EQUAL",
      status: "CLOSED",
      allowStudentViewAnswers: false,
    },
  });

  const examCode = await prisma.examCode.create({
    data: {
      examId: exam.id,
      code: "001",
    },
  });

  const template = await prisma.answerSheetTemplate.create({
    data: {
      examId: exam.id,
      layoutJson: { test: true },
    },
  });

  return {
    ts,
    teacherUser,
    studentAUser,
    studentBUser,
    exam,
    examCode,
    template,
  };
}

test("Phase 9 — Student Result Portal Suite", async (t) => {
  const ctx = await setupStudentTestFixture();

  await t.test("T9.1 — listStudentResults: unlinked user throws STUDENT_PROFILE_NOT_FOUND", async () => {
    const unlinkedUser = await prisma.user.create({
      data: {
        email: `unlinked_${ctx.ts}@digitalexam.local`,
        passwordHash: "hash",
        role: "STUDENT",
      },
    });

    await assert.rejects(
      () => studentResultService.listStudentResults(unlinkedUser.id),
      (err) => {
        assert.strictEqual(err.code, "STUDENT_PROFILE_NOT_FOUND");
        assert.strictEqual(err.statusCode, 404);
        return true;
      }
    );
  });

  await t.test("T9.2 — listStudentResults: student with no mapping sees empty results list", async () => {
    const results = await studentResultService.listStudentResults(ctx.studentAUser.id);
    assert.strictEqual(results.length, 0);
  });

  await t.test("T9.3 — Student mapped but Exam unpublished: list empty, detail 404", async () => {
    // Assign Student A to SBD 171101
    await assignCandidate(ctx.teacherUser.id, ctx.exam.id, {
      studentId: ctx.studentAUser.student.id,
      studentNumber: "171101",
    });

    // Create FINAL submission
    await prisma.examSubmission.create({
      data: {
        examId: ctx.exam.id,
        examCodeId: ctx.examCode.id,
        answerSheetTemplateId: ctx.template.id,
        gradedByUserId: ctx.teacherUser.id,
        status: "FINAL",
        resolvedStudentNumber: "171101",
        identityNeedsReview: false,
        studentNumberOmrStatus: "CONFIRMED",
        originalImageStorageKey: `img_${ctx.ts}_1`,
        originalImageSha256: `sha_${ctx.ts}_1`,
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
        answers: {
          create: [
            {
              questionNumber: 1,
              correctAnswerSnapshot: "A",
              scoreSnapshot: new Prisma.Decimal("2.5000"),
              omrStatus: "MARKED",
              confidence: 0.99,
              fillRatios: {},
              effectiveAnswer: "A",
              result: "CORRECT",
              scoreEarned: new Prisma.Decimal("2.5000"),
            },
            {
              questionNumber: 2,
              correctAnswerSnapshot: "B",
              scoreSnapshot: new Prisma.Decimal("2.5000"),
              omrStatus: "MARKED",
              confidence: 0.99,
              fillRatios: {},
              effectiveAnswer: "B",
              result: "CORRECT",
              scoreEarned: new Prisma.Decimal("2.5000"),
            },
            {
              questionNumber: 3,
              correctAnswerSnapshot: "C",
              scoreSnapshot: new Prisma.Decimal("2.5000"),
              omrStatus: "MARKED",
              confidence: 0.99,
              fillRatios: {},
              effectiveAnswer: "C",
              result: "CORRECT",
              scoreEarned: new Prisma.Decimal("2.5000"),
            },
            {
              questionNumber: 4,
              correctAnswerSnapshot: "D",
              scoreSnapshot: new Prisma.Decimal("2.5000"),
              omrStatus: "MARKED",
              confidence: 0.99,
              fillRatios: {},
              effectiveAnswer: "A",
              result: "INCORRECT",
              scoreEarned: new Prisma.Decimal("0.0000"),
            },
          ],
        },
      },
    });

    // Unpublished -> list is empty
    const results = await studentResultService.listStudentResults(ctx.studentAUser.id);
    assert.strictEqual(results.length, 0);

    // Unpublished -> detail throws STUDENT_RESULT_NOT_AVAILABLE (404)
    await assert.rejects(
      () => studentResultService.getStudentResultDetail(ctx.studentAUser.id, ctx.exam.id),
      (err) => {
        assert.strictEqual(err.code, "STUDENT_RESULT_NOT_AVAILABLE");
        assert.strictEqual(err.statusCode, 404);
        return true;
      }
    );
  });

  await t.test("T9.4 — When published, student sees own official result", async () => {
    // Publish results
    await publicationService.publishExamResults({ examId: ctx.exam.id, user: ctx.teacherUser });

    // List results
    const list = await studentResultService.listStudentResults(ctx.studentAUser.id);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].examId, ctx.exam.id);
    assert.strictEqual(list[0].studentNumber, "171101");
    assert.strictEqual(list[0].score, 7.5);
    assert.strictEqual(list[0].maxScore, 10);
    assert.strictEqual(list[0].correctCount, 3);
    assert.strictEqual(list[0].incorrectCount, 1);

    // Detail result
    const detail = await studentResultService.getStudentResultDetail(ctx.studentAUser.id, ctx.exam.id);
    assert.strictEqual(detail.examId, ctx.exam.id);
    assert.strictEqual(detail.studentNumber, "171101");
    assert.strictEqual(detail.studentName, "Student Alpha");
    assert.strictEqual(detail.score, 7.5);
    assert.strictEqual(detail.allowStudentViewAnswers, false);
    assert.strictEqual(detail.answers, null); // Hidden by default
  });

  await t.test("T9.5 — Cross-student protection: Student B cannot see Student A result", async () => {
    // Student B has no mapping for this exam
    const listB = await studentResultService.listStudentResults(ctx.studentBUser.id);
    assert.strictEqual(listB.length, 0);

    // Student B requesting detail throws 404
    await assert.rejects(
      () => studentResultService.getStudentResultDetail(ctx.studentBUser.id, ctx.exam.id),
      (err) => {
        assert.strictEqual(err.code, "STUDENT_RESULT_NOT_AVAILABLE");
        assert.strictEqual(err.statusCode, 404);
        return true;
      }
    );
  });

  await t.test("T9.6 — Answer visibility policy: enabled reveals question answers without leaking key", async () => {
    // Update exam to allow answer detail
    await prisma.exam.update({
      where: { id: ctx.exam.id },
      data: { allowStudentViewAnswers: true },
    });

    const detail = await studentResultService.getStudentResultDetail(ctx.studentAUser.id, ctx.exam.id);
    assert.strictEqual(detail.allowStudentViewAnswers, true);
    assert.ok(Array.isArray(detail.answers));
    assert.strictEqual(detail.answers.length, 4);

    const q1 = detail.answers[0];
    assert.strictEqual(q1.questionNumber, 1);
    assert.strictEqual(q1.studentAnswer, "A");
    assert.strictEqual(q1.result, "CORRECT");
    assert.strictEqual(q1.scoreEarned, 2.5);
    // Crucial: Correct answer is NOT in the answer object
    assert.strictEqual(q1.correctAnswer, undefined);
    assert.strictEqual(q1.correctAnswerSnapshot, undefined);
  });

  await t.test("T9.7 — Unpublish immediately hides result from student portal", async () => {
    await publicationService.unpublishExamResults({
      examId: ctx.exam.id,
      user: ctx.teacherUser,
      reason: "Hiding for review",
    });

    const list = await studentResultService.listStudentResults(ctx.studentAUser.id);
    assert.strictEqual(list.length, 0);

    await assert.rejects(
      () => studentResultService.getStudentResultDetail(ctx.studentAUser.id, ctx.exam.id),
      (err) => {
        assert.strictEqual(err.code, "STUDENT_RESULT_NOT_AVAILABLE");
        return true;
      }
    );
  });

  await t.test("T9.8 — Republish restores result visibility", async () => {
    await publicationService.publishExamResults({ examId: ctx.exam.id, user: ctx.teacherUser });

    const list = await studentResultService.listStudentResults(ctx.studentAUser.id);
    assert.strictEqual(list.length, 1);

    const detail = await studentResultService.getStudentResultDetail(ctx.studentAUser.id, ctx.exam.id);
    assert.strictEqual(detail.score, 7.5);
  });

  await t.test("T9.9 — candidateStudentNumber alone CANNOT authorize Student result", async () => {
    // Unpublish so candidate can be assigned safely
    await publicationService.unpublishExamResults({
      examId: ctx.exam.id,
      user: ctx.teacherUser,
      reason: "Assign candidate for test",
    });

    // Scenario: Candidate is mapped to Student B with SBD "171109"
    await assignCandidate(ctx.teacherUser.id, ctx.exam.id, {
      studentId: ctx.studentBUser.student.id,
      studentNumber: "171109",
    });

    // Re-publish results so exam is officially published
    await publicationService.publishExamResults({
      examId: ctx.exam.id,
      user: ctx.teacherUser,
    });

    // Create a submission where candidateStudentNumber is "171109"
    // BUT resolvedStudentNumber is null and identityNeedsReview is true
    const unconfirmedSub = await prisma.examSubmission.create({
      data: {
        examId: ctx.exam.id,
        examCodeId: ctx.examCode.id,
        answerSheetTemplateId: ctx.template.id,
        gradedByUserId: ctx.teacherUser.id,
        status: "FINAL",
        candidateStudentNumber: "171109",
        resolvedStudentNumber: null, // NOT resolved
        identityNeedsReview: true,  // Unconfirmed
        studentNumberOmrStatus: "UNCERTAIN",
        originalImageStorageKey: `img_${ctx.ts}_unconfirmed`,
        originalImageSha256: `sha_${ctx.ts}_unconfirmed`,
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
      },
    });

    try {
      // Student B MUST NOT see this result in listing
      const listB = await studentResultService.listStudentResults(ctx.studentBUser.id);
      assert.strictEqual(listB.length, 0);

      // Student B MUST NOT access via detail (404)
      await assert.rejects(
        () => studentResultService.getStudentResultDetail(ctx.studentBUser.id, ctx.exam.id),
        (err) => {
          assert.strictEqual(err.code, "STUDENT_RESULT_NOT_AVAILABLE");
          assert.strictEqual(err.statusCode, 404);
          return true;
        }
      );
    } finally {
      await prisma.examSubmission.delete({ where: { id: unconfirmedSub.id } });
    }
  });

  await t.test("T9.10 — Candidate conflict: Student mapped SBD does not match resolvedStudentNumber", async () => {
    // Submission has candidateStudentNumber = "171109"
    // BUT resolvedStudentNumber = "171199" (different SBD)
    const conflictSub = await prisma.examSubmission.create({
      data: {
        examId: ctx.exam.id,
        examCodeId: ctx.examCode.id,
        answerSheetTemplateId: ctx.template.id,
        gradedByUserId: ctx.teacherUser.id,
        status: "FINAL",
        candidateStudentNumber: "171109", // Raw candidate matches Student B
        resolvedStudentNumber: "171199",  // Authoritative resolved does NOT match Student B
        identityNeedsReview: false,
        studentNumberOmrStatus: "CONFIRMED",
        originalImageStorageKey: `img_${ctx.ts}_conflict`,
        originalImageSha256: `sha_${ctx.ts}_conflict`,
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
      },
    });

    try {
      // Student B MUST NOT see this submission
      const listB = await studentResultService.listStudentResults(ctx.studentBUser.id);
      assert.strictEqual(listB.length, 0);

      await assert.rejects(
        () => studentResultService.getStudentResultDetail(ctx.studentBUser.id, ctx.exam.id),
        (err) => {
          assert.strictEqual(err.code, "STUDENT_RESULT_NOT_AVAILABLE");
          assert.strictEqual(err.statusCode, 404);
          return true;
        }
      );
    } finally {
      await prisma.examSubmission.delete({ where: { id: conflictSub.id } });
    }
  });

  await t.test("T9.11 — identityNeedsReview=true blocks Student result even if resolvedStudentNumber matches", async () => {
    const unconfirmedResolved = await prisma.examSubmission.create({
      data: {
        examId: ctx.exam.id,
        examCodeId: ctx.examCode.id,
        answerSheetTemplateId: ctx.template.id,
        gradedByUserId: ctx.teacherUser.id,
        status: "FINAL",
        resolvedStudentNumber: "171109", // Matches Student B
        identityNeedsReview: true,       // But identity is still flagged for review!
        studentNumberOmrStatus: "UNCERTAIN",
        originalImageStorageKey: `img_${ctx.ts}_idreview`,
        originalImageSha256: `sha_${ctx.ts}_idreview`,
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
      },
    });

    try {
      const listB = await studentResultService.listStudentResults(ctx.studentBUser.id);
      assert.strictEqual(listB.length, 0);

      await assert.rejects(
        () => studentResultService.getStudentResultDetail(ctx.studentBUser.id, ctx.exam.id),
        (err) => {
          assert.strictEqual(err.code, "STUDENT_RESULT_NOT_AVAILABLE");
          assert.strictEqual(err.statusCode, 404);
          return true;
        }
      );
    } finally {
      await prisma.examSubmission.delete({ where: { id: unconfirmedResolved.id } });
    }
  });

  await t.test("T9.12 — Positive identity confirmation: resolvedStudentNumber + confirmed identity exposes official result", async () => {
    const confirmedSub = await prisma.examSubmission.create({
      data: {
        examId: ctx.exam.id,
        examCodeId: ctx.examCode.id,
        answerSheetTemplateId: ctx.template.id,
        gradedByUserId: ctx.teacherUser.id,
        status: "FINAL",
        candidateStudentNumber: "999999", // Stale raw candidate
        resolvedStudentNumber: "171109",  // Authoritative confirmed SBD matches Student B
        identityNeedsReview: false,
        studentNumberOmrStatus: "CONFIRMED",
        originalImageStorageKey: `img_${ctx.ts}_confirmed`,
        originalImageSha256: `sha_${ctx.ts}_confirmed`,
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
      },
    });

    try {
      const listB = await studentResultService.listStudentResults(ctx.studentBUser.id);
      assert.strictEqual(listB.length, 1);
      assert.strictEqual(listB[0].studentNumber, "171109"); // Returns authoritative resolvedStudentNumber
      assert.strictEqual(listB[0].score, 10.0);

      const detailB = await studentResultService.getStudentResultDetail(ctx.studentBUser.id, ctx.exam.id);
      assert.strictEqual(detailB.studentNumber, "171109"); // Authoritative
      assert.strictEqual(detailB.score, 10.0);
    } finally {
      await prisma.examSubmission.delete({ where: { id: confirmedSub.id } });
    }
  });
});
