import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import prisma from "../src/config/prisma.js";
import { getExamAnalytics } from "../src/services/exam-analytics.service.js";

async function setupAnalyticsFixture() {
  const ts = Date.now();

  const teacherA = await prisma.user.create({
    data: {
      email: `an_t_a_${ts}@digitalexam.local`,
      passwordHash: "dummy",
      role: "TEACHER",
      teacher: {
        create: {
          teacherCode: `ATA_${ts.toString().slice(-6)}`,
          fullName: "Analytics Teacher A",
        },
      },
    },
    include: { teacher: true },
  });

  const teacherB = await prisma.user.create({
    data: {
      email: `an_t_b_${ts}@digitalexam.local`,
      passwordHash: "dummy",
      role: "TEACHER",
      teacher: {
        create: {
          teacherCode: `ATB_${ts.toString().slice(-6)}`,
          fullName: "Analytics Teacher B",
        },
      },
    },
    include: { teacher: true },
  });

  const subject = await prisma.subject.findFirst();
  const cls = await prisma.class.findFirst();

  const exam = await prisma.exam.create({
    data: {
      title: `Analytics Test Exam ${ts}`,
      teacherId: teacherA.teacher.id,
      subjectId: subject.id,
      classId: cls.id,
      questionCount: 4,
      maxScore: new Prisma.Decimal("10.0000"),
      scoringType: "EQUAL",
      status: "CLOSED",
    },
  });

  const code1 = await prisma.examCode.create({
    data: { examId: exam.id, code: "001" },
  });
  const code2 = await prisma.examCode.create({
    data: { examId: exam.id, code: "002" },
  });

  const template = await prisma.answerSheetTemplate.create({
    data: { examId: exam.id, layoutJson: {} },
  });

  // Submission 1: FINAL, score 10.0 (4 correct), code 001
  await prisma.examSubmission.create({
    data: {
      examId: exam.id,
      examCodeId: code1.id,
      answerSheetTemplateId: template.id,
      gradedByUserId: teacherA.id,
      status: "FINAL",
      resolvedStudentNumber: "171101",
      studentNumberOmrStatus: "CONFIRMED",
      originalImageStorageKey: `key_${ts}_1`,
      originalImageSha256: `sha_${ts}_1`,
      originalImageMimeType: "image/jpeg",
      originalImageSizeBytes: 100,
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
      answers: {
        create: [
          { questionNumber: 1, correctAnswerSnapshot: "A", scoreSnapshot: new Prisma.Decimal("2.5000"), omrStatus: "MARKED", confidence: 0.9, fillRatios: {}, effectiveAnswer: "A", result: "CORRECT", scoreEarned: new Prisma.Decimal("2.5000") },
          { questionNumber: 2, correctAnswerSnapshot: "B", scoreSnapshot: new Prisma.Decimal("2.5000"), omrStatus: "MARKED", confidence: 0.9, fillRatios: {}, effectiveAnswer: "B", result: "CORRECT", scoreEarned: new Prisma.Decimal("2.5000") },
          { questionNumber: 3, correctAnswerSnapshot: "C", scoreSnapshot: new Prisma.Decimal("2.5000"), omrStatus: "MARKED", confidence: 0.9, fillRatios: {}, effectiveAnswer: "C", result: "CORRECT", scoreEarned: new Prisma.Decimal("2.5000") },
          { questionNumber: 4, correctAnswerSnapshot: "D", scoreSnapshot: new Prisma.Decimal("2.5000"), omrStatus: "MARKED", confidence: 0.9, fillRatios: {}, effectiveAnswer: "D", result: "CORRECT", scoreEarned: new Prisma.Decimal("2.5000") },
        ],
      },
    },
  });

  // Submission 2: FINAL, score 5.0 (2 correct: Q1, Q2; Q3 incorrect 'A', Q4 blank), code 001
  await prisma.examSubmission.create({
    data: {
      examId: exam.id,
      examCodeId: code1.id,
      answerSheetTemplateId: template.id,
      gradedByUserId: teacherA.id,
      status: "FINAL",
      resolvedStudentNumber: "171102",
      studentNumberOmrStatus: "CONFIRMED",
      originalImageStorageKey: `key_${ts}_2`,
      originalImageSha256: `sha_${ts}_2`,
      originalImageMimeType: "image/jpeg",
      originalImageSizeBytes: 100,
      omrOverallStatus: "OK",
      questionCountSnapshot: 4,
      maxScoreSnapshot: new Prisma.Decimal("10.0000"),
      scoringTypeSnapshot: "EQUAL",
      examCodeSnapshot: "001",
      correctCount: 2,
      incorrectCount: 1,
      blankCount: 1,
      unresolvedCount: 0,
      finalScore: new Prisma.Decimal("5.0000"),
      answers: {
        create: [
          { questionNumber: 1, correctAnswerSnapshot: "A", scoreSnapshot: new Prisma.Decimal("2.5000"), omrStatus: "MARKED", confidence: 0.9, fillRatios: {}, effectiveAnswer: "A", result: "CORRECT", scoreEarned: new Prisma.Decimal("2.5000") },
          { questionNumber: 2, correctAnswerSnapshot: "B", scoreSnapshot: new Prisma.Decimal("2.5000"), omrStatus: "MARKED", confidence: 0.9, fillRatios: {}, effectiveAnswer: "B", result: "CORRECT", scoreEarned: new Prisma.Decimal("2.5000") },
          { questionNumber: 3, correctAnswerSnapshot: "C", scoreSnapshot: new Prisma.Decimal("2.5000"), omrStatus: "MARKED", confidence: 0.9, fillRatios: {}, effectiveAnswer: "A", result: "INCORRECT", scoreEarned: new Prisma.Decimal("0.0000") },
          { questionNumber: 4, correctAnswerSnapshot: "D", scoreSnapshot: new Prisma.Decimal("2.5000"), omrStatus: "BLANK", confidence: 0.9, fillRatios: {}, effectiveAnswer: null, result: "BLANK", scoreEarned: new Prisma.Decimal("0.0000") },
        ],
      },
    },
  });

  // Submission 3: FINAL, score 7.5 (3 correct), code 002
  await prisma.examSubmission.create({
    data: {
      examId: exam.id,
      examCodeId: code2.id,
      answerSheetTemplateId: template.id,
      gradedByUserId: teacherA.id,
      status: "FINAL",
      resolvedStudentNumber: "171103",
      studentNumberOmrStatus: "CONFIRMED",
      originalImageStorageKey: `key_${ts}_3`,
      originalImageSha256: `sha_${ts}_3`,
      originalImageMimeType: "image/jpeg",
      originalImageSizeBytes: 100,
      omrOverallStatus: "OK",
      questionCountSnapshot: 4,
      maxScoreSnapshot: new Prisma.Decimal("10.0000"),
      scoringTypeSnapshot: "EQUAL",
      examCodeSnapshot: "002",
      correctCount: 3,
      incorrectCount: 1,
      blankCount: 0,
      unresolvedCount: 0,
      finalScore: new Prisma.Decimal("7.5000"),
      answers: {
        create: [
          { questionNumber: 1, correctAnswerSnapshot: "A", scoreSnapshot: new Prisma.Decimal("2.5000"), omrStatus: "MARKED", confidence: 0.9, fillRatios: {}, effectiveAnswer: "A", result: "CORRECT", scoreEarned: new Prisma.Decimal("2.5000") },
          { questionNumber: 2, correctAnswerSnapshot: "B", scoreSnapshot: new Prisma.Decimal("2.5000"), omrStatus: "MARKED", confidence: 0.9, fillRatios: {}, effectiveAnswer: "B", result: "CORRECT", scoreEarned: new Prisma.Decimal("2.5000") },
          { questionNumber: 3, correctAnswerSnapshot: "C", scoreSnapshot: new Prisma.Decimal("2.5000"), omrStatus: "MARKED", confidence: 0.9, fillRatios: {}, effectiveAnswer: "C", result: "CORRECT", scoreEarned: new Prisma.Decimal("2.5000") },
          { questionNumber: 4, correctAnswerSnapshot: "D", scoreSnapshot: new Prisma.Decimal("2.5000"), omrStatus: "MULTIPLE", confidence: 0.9, fillRatios: {}, effectiveAnswer: null, result: "INVALID_MULTIPLE", scoreEarned: new Prisma.Decimal("0.0000"), resolvedByTeacher: true, teacherResolution: "MULTIPLE_INVALID" },
        ],
      },
    },
  });

  // Submission 4: PROVISIONAL, score 2.5 (should be excluded from score analytics!)
  await prisma.examSubmission.create({
    data: {
      examId: exam.id,
      examCodeId: code1.id,
      answerSheetTemplateId: template.id,
      gradedByUserId: teacherA.id,
      status: "PROVISIONAL",
      resolvedStudentNumber: "171104",
      studentNumberOmrStatus: "CONFIRMED",
      originalImageStorageKey: `key_${ts}_4`,
      originalImageSha256: `sha_${ts}_4`,
      originalImageMimeType: "image/jpeg",
      originalImageSizeBytes: 100,
      omrOverallStatus: "UNCERTAIN",
      questionCountSnapshot: 4,
      maxScoreSnapshot: new Prisma.Decimal("10.0000"),
      scoringTypeSnapshot: "EQUAL",
      examCodeSnapshot: "001",
      correctCount: 1,
      incorrectCount: 0,
      blankCount: 0,
      unresolvedCount: 3,
      provisionalScore: new Prisma.Decimal("2.5000"),
      answers: {
        create: [
          { questionNumber: 1, correctAnswerSnapshot: "A", scoreSnapshot: new Prisma.Decimal("2.5000"), omrStatus: "MARKED", confidence: 0.9, fillRatios: {}, effectiveAnswer: "A", result: "CORRECT", scoreEarned: new Prisma.Decimal("2.5000") },
          { questionNumber: 2, correctAnswerSnapshot: "B", scoreSnapshot: new Prisma.Decimal("2.5000"), omrStatus: "UNCERTAIN", confidence: 0.4, fillRatios: {}, effectiveAnswer: null, result: "UNRESOLVED", scoreEarned: null, needsReview: true },
          { questionNumber: 3, correctAnswerSnapshot: "C", scoreSnapshot: new Prisma.Decimal("2.5000"), omrStatus: "UNCERTAIN", confidence: 0.4, fillRatios: {}, effectiveAnswer: null, result: "UNRESOLVED", scoreEarned: null, needsReview: true },
          { questionNumber: 4, correctAnswerSnapshot: "D", scoreSnapshot: new Prisma.Decimal("2.5000"), omrStatus: "UNCERTAIN", confidence: 0.4, fillRatios: {}, effectiveAnswer: null, result: "UNRESOLVED", scoreEarned: null, needsReview: true },
        ],
      },
    },
  });

  return {
    ts,
    teacherA,
    teacherB,
    exam,
  };
}

test("Phase 10 — Exam Analytics Suite", async (t) => {
  const ctx = await setupAnalyticsFixture();

  await t.test("TA.1 — Other teacher is denied analytics (EXAM_ACCESS_DENIED)", async () => {
    await assert.rejects(
      () => getExamAnalytics(ctx.teacherB.id, ctx.exam.id),
      (err) => {
        assert.strictEqual(err.code, "EXAM_ACCESS_DENIED");
        assert.strictEqual(err.statusCode, 403);
        return true;
      }
    );
  });

  await t.test("TA.2 — Overview metrics are accurately computed", async () => {
    const data = await getExamAnalytics(ctx.teacherA.id, ctx.exam.id);
    assert.strictEqual(data.overview.totalSubmissions, 4);
    assert.strictEqual(data.overview.finalCount, 3);
    assert.strictEqual(data.overview.provisionalCount, 1);
  });

  await t.test("TA.3 — Score statistics: PROVISIONAL excluded, only FINAL used", async () => {
    const data = await getExamAnalytics(ctx.teacherA.id, ctx.exam.id);
    // Final scores: 10.0, 5.0, 7.5
    // Mean = (10 + 5 + 7.5) / 3 = 22.5 / 3 = 7.5
    assert.strictEqual(data.scoreStats.averageFinalScore, 7.5);
    assert.strictEqual(data.scoreStats.highestFinalScore, 10.0);
    assert.strictEqual(data.scoreStats.lowestFinalScore, 5.0);
    assert.strictEqual(data.scoreStats.medianFinalScore, 7.5);
  });

  await t.test("TA.4 — Score distribution: 10 buckets accurately populate", async () => {
    const data = await getExamAnalytics(ctx.teacherA.id, ctx.exam.id);
    assert.strictEqual(data.scoreDistribution.length, 10);
    const totalBucketed = data.scoreDistribution.reduce((acc, b) => acc + b.count, 0);
    assert.strictEqual(totalBucketed, 3); // 3 final scores
  });

  await t.test("TA.5 — Question analytics: accurate correct rates and breakdown", async () => {
    const data = await getExamAnalytics(ctx.teacherA.id, ctx.exam.id);
    assert.strictEqual(data.questionAnalytics.length, 4);

    // Q1: all 3 final answers were CORRECT -> 100%
    const q1 = data.questionAnalytics[0];
    assert.strictEqual(q1.questionNumber, 1);
    assert.strictEqual(q1.totalFinalResponses, 3);
    assert.strictEqual(q1.correctCount, 3);
    assert.strictEqual(q1.correctRate, 100);

    // Q4: 1 correct (sub 1), 1 blank (sub 2), 1 invalid multiple (sub 3)
    const q4 = data.questionAnalytics[3];
    assert.strictEqual(q4.questionNumber, 4);
    assert.strictEqual(q4.correctCount, 1);
    assert.strictEqual(q4.blankCount, 1);
    assert.strictEqual(q4.invalidMultipleCount, 1);
  });

  await t.test("TA.6 — ExamCode comparison: groups codes 001 and 002 accurately", async () => {
    const data = await getExamAnalytics(ctx.teacherA.id, ctx.exam.id);
    assert.strictEqual(data.examCodeComparison.length, 2);

    const c001 = data.examCodeComparison.find((c) => c.code === "001");
    assert.ok(c001);
    assert.strictEqual(c001.candidateCount, 2); // 2 final submissions in 001 (10.0 and 5.0)
    assert.strictEqual(c001.averageScore, 7.5);

    const c002 = data.examCodeComparison.find((c) => c.code === "002");
    assert.ok(c002);
    assert.strictEqual(c002.candidateCount, 1);
    assert.strictEqual(c002.averageScore, 7.5);
  });

  await t.test("TA.7 — Recognition and review workload metrics match data", async () => {
    const data = await getExamAnalytics(ctx.teacherA.id, ctx.exam.id);
    assert.strictEqual(data.reviewWorkload.teacherReviewedAnswerCount, 1); // 1 answer had resolvedByTeacher
    assert.strictEqual(data.reviewWorkload.invalidMultipleCount, 1);
  });

  await t.test("TA.8 — ARCHIVED exam analytics remains accessible and readable", async () => {
    await prisma.exam.update({
      where: { id: ctx.exam.id },
      data: { status: "ARCHIVED" },
    });

    const data = await getExamAnalytics(ctx.teacherA.id, ctx.exam.id);
    assert.strictEqual(data.overview.status, "ARCHIVED");
    assert.strictEqual(data.overview.finalCount, 3);
  });

  await t.test("TA.9 — maxScore 20 exam: scale buckets 0-20 (step 2) and perfect score 20 recognized", async () => {
    const subject = await prisma.subject.findFirst();
    const cls = await prisma.class.findFirst();

    // Create an exam with maxScore = 20
    const exam20 = await prisma.exam.create({
      data: {
        title: `MaxScore 20 Exam ${ctx.ts}`,
        teacherId: ctx.teacherA.teacher.id,
        subjectId: subject.id,
        classId: cls.id,
        questionCount: 10,
        maxScore: new Prisma.Decimal("20.0000"),
        scoringType: "EQUAL",
        status: "CLOSED",
      },
    });

    const code20 = await prisma.examCode.create({
      data: { examId: exam20.id, code: "001" },
    });

    const tpl20 = await prisma.answerSheetTemplate.create({
      data: { examId: exam20.id, layoutJson: {} },
    });

    // Submissions: one with 20.0 (perfect), one with 12.0
    const sub1 = await prisma.examSubmission.create({
      data: {
        examId: exam20.id,
        examCodeId: code20.id,
        answerSheetTemplateId: tpl20.id,
        gradedByUserId: ctx.teacherA.id,
        status: "FINAL",
        resolvedStudentNumber: "171101",
        identityNeedsReview: false,
        studentNumberOmrStatus: "CONFIRMED",
        originalImageStorageKey: `img_${ctx.ts}_m20_1`,
        originalImageSha256: `sha_${ctx.ts}_m20_1`,
        originalImageMimeType: "image/jpeg",
        originalImageSizeBytes: 100,
        omrOverallStatus: "OK",
        questionCountSnapshot: 10,
        maxScoreSnapshot: new Prisma.Decimal("20.0000"),
        scoringTypeSnapshot: "EQUAL",
        examCodeSnapshot: "001",
        correctCount: 10,
        incorrectCount: 0,
        blankCount: 0,
        unresolvedCount: 0,
        finalScore: new Prisma.Decimal("20.0000"),
      },
    });

    const sub2 = await prisma.examSubmission.create({
      data: {
        examId: exam20.id,
        examCodeId: code20.id,
        answerSheetTemplateId: tpl20.id,
        gradedByUserId: ctx.teacherA.id,
        status: "FINAL",
        resolvedStudentNumber: "171102",
        identityNeedsReview: false,
        studentNumberOmrStatus: "CONFIRMED",
        originalImageStorageKey: `img_${ctx.ts}_m20_2`,
        originalImageSha256: `sha_${ctx.ts}_m20_2`,
        originalImageMimeType: "image/jpeg",
        originalImageSizeBytes: 100,
        omrOverallStatus: "OK",
        questionCountSnapshot: 10,
        maxScoreSnapshot: new Prisma.Decimal("20.0000"),
        scoringTypeSnapshot: "EQUAL",
        examCodeSnapshot: "001",
        correctCount: 6,
        incorrectCount: 4,
        blankCount: 0,
        unresolvedCount: 0,
        finalScore: new Prisma.Decimal("12.0000"),
      },
    });

    try {
      const data20 = await getExamAnalytics(ctx.teacherA.id, exam20.id);

      // Score stats
      assert.strictEqual(data20.scoreStats.highestFinalScore, 20.0);
      assert.strictEqual(data20.scoreStats.lowestFinalScore, 12.0);
      assert.strictEqual(data20.scoreStats.averageFinalScore, 16.0);
      assert.strictEqual(data20.scoreStats.perfectScoreCount, 1); // Exact match for maxScore 20
      assert.strictEqual(data20.scoreStats.passRate, undefined); // No invented passRate

      // Score distribution: 10 buckets spanning 0 to 20 (step 2)
      assert.strictEqual(data20.scoreDistribution.length, 10);
      assert.strictEqual(data20.scoreDistribution[0].min, 0);
      assert.strictEqual(data20.scoreDistribution[0].max, 2);
      assert.strictEqual(data20.scoreDistribution[9].min, 18);
      assert.strictEqual(data20.scoreDistribution[9].max, 20);
      assert.strictEqual(data20.scoreDistribution[9].count, 1); // 20.0 in last bucket
    } finally {
      await prisma.examSubmission.deleteMany({ where: { examId: exam20.id } });
      await prisma.answerSheetTemplate.deleteMany({ where: { examId: exam20.id } });
      await prisma.examCode.deleteMany({ where: { examId: exam20.id } });
      await prisma.exam.delete({ where: { id: exam20.id } });
    }
  });

  await t.test("TA.10 — Inconsistent final submissions flag consistencyCode: ANALYTICS_DATA_INCONSISTENT", async () => {
    const subject = await prisma.subject.findFirst();
    const cls = await prisma.class.findFirst();

    const examInc = await prisma.exam.create({
      data: {
        title: `Inconsistent Exam ${ctx.ts}`,
        teacherId: ctx.teacherA.teacher.id,
        subjectId: subject.id,
        classId: cls.id,
        questionCount: 10,
        maxScore: new Prisma.Decimal("10.0000"),
        scoringType: "EQUAL",
        status: "CLOSED",
      },
    });

    const codeInc = await prisma.examCode.create({
      data: { examId: examInc.id, code: "001" },
    });

    const tplInc = await prisma.answerSheetTemplate.create({
      data: { examId: examInc.id, layoutJson: {} },
    });

    // Sub 1: maxScoreSnapshot 10
    const s1 = await prisma.examSubmission.create({
      data: {
        examId: examInc.id,
        examCodeId: codeInc.id,
        answerSheetTemplateId: tplInc.id,
        gradedByUserId: ctx.teacherA.id,
        status: "FINAL",
        resolvedStudentNumber: "171101",
        identityNeedsReview: false,
        studentNumberOmrStatus: "CONFIRMED",
        originalImageStorageKey: `img_${ctx.ts}_inc1`,
        originalImageSha256: `sha_${ctx.ts}_inc1`,
        originalImageMimeType: "image/jpeg",
        originalImageSizeBytes: 100,
        omrOverallStatus: "OK",
        questionCountSnapshot: 10,
        maxScoreSnapshot: new Prisma.Decimal("10.0000"),
        scoringTypeSnapshot: "EQUAL",
        examCodeSnapshot: "001",
        correctCount: 10,
        incorrectCount: 0,
        blankCount: 0,
        unresolvedCount: 0,
        finalScore: new Prisma.Decimal("10.0000"),
      },
    });

    // Sub 2: maxScoreSnapshot 20 (mismatched!)
    const s2 = await prisma.examSubmission.create({
      data: {
        examId: examInc.id,
        examCodeId: codeInc.id,
        answerSheetTemplateId: tplInc.id,
        gradedByUserId: ctx.teacherA.id,
        status: "FINAL",
        resolvedStudentNumber: "171102",
        identityNeedsReview: false,
        studentNumberOmrStatus: "CONFIRMED",
        originalImageStorageKey: `img_${ctx.ts}_inc2`,
        originalImageSha256: `sha_${ctx.ts}_inc2`,
        originalImageMimeType: "image/jpeg",
        originalImageSizeBytes: 100,
        omrOverallStatus: "OK",
        questionCountSnapshot: 10,
        maxScoreSnapshot: new Prisma.Decimal("20.0000"),
        scoringTypeSnapshot: "EQUAL",
        examCodeSnapshot: "001",
        correctCount: 10,
        incorrectCount: 0,
        blankCount: 0,
        unresolvedCount: 0,
        finalScore: new Prisma.Decimal("20.0000"),
      },
    });

    try {
      const dataInc = await getExamAnalytics(ctx.teacherA.id, examInc.id);
      assert.strictEqual(dataInc.consistencyWarning, true);
      assert.strictEqual(dataInc.consistencyCode, "ANALYTICS_DATA_INCONSISTENT");
    } finally {
      await prisma.examSubmission.deleteMany({ where: { examId: examInc.id } });
      await prisma.answerSheetTemplate.deleteMany({ where: { examId: examInc.id } });
      await prisma.examCode.deleteMany({ where: { examId: examInc.id } });
      await prisma.exam.delete({ where: { id: examInc.id } });
    }
  });
});
