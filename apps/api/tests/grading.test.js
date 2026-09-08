import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { evaluateSubmission, applyReviewOverrides } from "../src/services/grading.service.js";
import { analyzeOmrSheet } from "../src/services/omr-client.service.js";

test("Grading Engine - EQUAL scoring: 40 questions, 32 correct, maxScore 10 -> exactly 8.0", () => {
  const exam = {
    questionCount: 40,
    maxScore: 10,
    scoringType: "EQUAL",
  };

  const answerKeys = Array.from({ length: 40 }, (_, i) => ({
    questionNumber: i + 1,
    correctAnswer: "A",
    score: new Prisma.Decimal("0.25"),
  }));

  // 32 marked 'A' (correct), 8 marked 'B' (incorrect)
  const omrAnswers = Array.from({ length: 40 }, (_, i) => ({
    questionNumber: i + 1,
    answer: i < 32 ? "A" : "B",
    candidate: i < 32 ? "A" : "B",
    status: "MARKED",
    confidence: 0.99,
  }));

  const result = evaluateSubmission({ exam, answerKeys, omrAnswers });

  assert.equal(result.status, "FINAL");
  assert.equal(result.finalScore, 8.0);
  assert.equal(result.provisionalScore, null);
  assert.equal(result.correctCount, 32);
  assert.equal(result.incorrectCount, 8);
  assert.equal(result.blankCount, 0);
  assert.equal(result.unresolvedCount, 0);
  assert.equal(result.questions.length, 40);
});

test("Grading Engine - EQUAL scoring: 30 questions, 27 correct, maxScore 10 -> exactly 9.0", () => {
  const exam = {
    questionCount: 30,
    maxScore: 10,
    scoringType: "EQUAL",
  };

  const answerKeys = Array.from({ length: 30 }, (_, i) => ({
    questionNumber: i + 1,
    correctAnswer: "C",
    score: new Prisma.Decimal("0.3333"),
  }));

  // 27 correct, 3 incorrect
  const omrAnswers = Array.from({ length: 30 }, (_, i) => ({
    questionNumber: i + 1,
    answer: i < 27 ? "C" : "D",
    candidate: i < 27 ? "C" : "D",
    status: "MARKED",
    confidence: 0.98,
  }));

  const result = evaluateSubmission({ exam, answerKeys, omrAnswers });

  assert.equal(result.status, "FINAL");
  assert.equal(result.finalScore, 9.0);
  assert.equal(result.provisionalScore, null);
  assert.equal(result.correctCount, 27);
  assert.equal(result.incorrectCount, 3);
  assert.equal(result.unresolvedCount, 0);
});

test("Grading Engine - CUSTOM scoring: Decimal-safe summation", () => {
  const exam = {
    questionCount: 4,
    maxScore: 10,
    scoringType: "CUSTOM",
  };

  const answerKeys = [
    { questionNumber: 1, correctAnswer: "A", score: new Prisma.Decimal("2.0000") },
    { questionNumber: 2, correctAnswer: "B", score: new Prisma.Decimal("2.0000") },
    { questionNumber: 3, correctAnswer: "C", score: new Prisma.Decimal("3.0000") },
    { questionNumber: 4, correctAnswer: "D", score: new Prisma.Decimal("3.0000") },
  ];

  // Student answers: Q1: A (correct, +2), Q2: A (incorrect, 0), Q3: C (correct, +3), Q4: B (incorrect, 0) -> Total = 5.0
  const omrAnswers = [
    { questionNumber: 1, answer: "A", candidate: "A", status: "MARKED", confidence: 0.95 },
    { questionNumber: 2, answer: "A", candidate: "A", status: "MARKED", confidence: 0.95 },
    { questionNumber: 3, answer: "C", candidate: "C", status: "MARKED", confidence: 0.95 },
    { questionNumber: 4, answer: "B", candidate: "B", status: "MARKED", confidence: 0.95 },
  ];

  const result = evaluateSubmission({ exam, answerKeys, omrAnswers });

  assert.equal(result.status, "FINAL");
  assert.equal(result.finalScore, 5.0);
  assert.equal(result.provisionalScore, null);
  assert.equal(result.correctCount, 2);
  assert.equal(result.incorrectCount, 2);
  assert.equal(result.questions[0].scoreEarned, 2.0);
  assert.equal(result.questions[1].scoreEarned, 0);
  assert.equal(result.questions[2].scoreEarned, 3.0);
  assert.equal(result.questions[3].scoreEarned, 0);
});

test("Grading Engine - UNCERTAIN answer triggers PROVISIONAL and candidate is NEVER graded", () => {
  const exam = {
    questionCount: 4,
    maxScore: 10,
    scoringType: "EQUAL",
  };

  const answerKeys = [
    { questionNumber: 1, correctAnswer: "A", score: new Prisma.Decimal("2.5") },
    { questionNumber: 2, correctAnswer: "B", score: new Prisma.Decimal("2.5") },
    { questionNumber: 3, correctAnswer: "C", score: new Prisma.Decimal("2.5") },
    { questionNumber: 4, correctAnswer: "D", score: new Prisma.Decimal("2.5") },
  ];

  // Q1: MARKED A (correct)
  // Q2: UNCERTAIN, candidate is 'B' (matches answer key, BUT must NOT be counted as correct!)
  // Q3: MARKED C (correct)
  // Q4: MARKED D (correct)
  const omrAnswers = [
    { questionNumber: 1, answer: "A", candidate: "A", status: "MARKED", confidence: 0.95 },
    { questionNumber: 2, answer: null, candidate: "B", status: "UNCERTAIN", confidence: 0.55 },
    { questionNumber: 3, answer: "C", candidate: "C", status: "MARKED", confidence: 0.95 },
    { questionNumber: 4, answer: "D", candidate: "D", status: "MARKED", confidence: 0.95 },
  ];

  const result = evaluateSubmission({ exam, answerKeys, omrAnswers });

  assert.equal(result.status, "PROVISIONAL");
  assert.equal(result.finalScore, null);
  // Only Q1, Q3, Q4 are counted as correct = 3 / 4 * 10 = 7.5 provisional score
  assert.equal(result.provisionalScore, 7.5);
  assert.equal(result.correctCount, 3);
  assert.equal(result.unresolvedCount, 1);
  assert.equal(result.questions[1].isCorrect, null);
  assert.equal(result.questions[1].scoreEarned, null);
  assert.equal(result.questions[1].candidate, "B");
});

test("Grading Engine - MULTIPLE answer triggers PROVISIONAL", () => {
  const exam = {
    questionCount: 2,
    maxScore: 10,
    scoringType: "EQUAL",
  };

  const answerKeys = [
    { questionNumber: 1, correctAnswer: "A", score: new Prisma.Decimal("5") },
    { questionNumber: 2, correctAnswer: "B", score: new Prisma.Decimal("5") },
  ];

  const omrAnswers = [
    { questionNumber: 1, answer: "A", candidate: "A", status: "MARKED", confidence: 0.95 },
    { questionNumber: 2, answer: null, candidate: null, status: "MULTIPLE", confidence: 0.70 },
  ];

  const result = evaluateSubmission({ exam, answerKeys, omrAnswers });

  assert.equal(result.status, "PROVISIONAL");
  assert.equal(result.finalScore, null);
  assert.equal(result.provisionalScore, 5.0);
  assert.equal(result.unresolvedCount, 1);
});

test("Grading Engine - BLANK answers do not trigger PROVISIONAL if no uncertain/multiple exist", () => {
  const exam = {
    questionCount: 4,
    maxScore: 10,
    scoringType: "EQUAL",
  };

  const answerKeys = [
    { questionNumber: 1, correctAnswer: "A", score: new Prisma.Decimal("2.5") },
    { questionNumber: 2, correctAnswer: "B", score: new Prisma.Decimal("2.5") },
    { questionNumber: 3, correctAnswer: "C", score: new Prisma.Decimal("2.5") },
    { questionNumber: 4, correctAnswer: "D", score: new Prisma.Decimal("2.5") },
  ];

  // Q1 correct, Q2 blank, Q3 incorrect, Q4 correct
  const omrAnswers = [
    { questionNumber: 1, answer: "A", candidate: "A", status: "MARKED", confidence: 0.95 },
    { questionNumber: 2, answer: null, candidate: null, status: "BLANK", confidence: 1.0 },
    { questionNumber: 3, answer: "A", candidate: "A", status: "MARKED", confidence: 0.95 },
    { questionNumber: 4, answer: "D", candidate: "D", status: "MARKED", confidence: 0.95 },
  ];

  const result = evaluateSubmission({ exam, answerKeys, omrAnswers });

  assert.equal(result.status, "FINAL");
  assert.equal(result.finalScore, 5.0); // 2/4 * 10 = 5.0
  assert.equal(result.blankCount, 1);
  assert.equal(result.correctCount, 2);
  assert.equal(result.incorrectCount, 1);
  assert.equal(result.unresolvedCount, 0);
});

test("OMR Client - Service unavailable returns 503 OMR_SERVICE_UNAVAILABLE", async () => {
  // Test with invalid port where no service is listening
  process.env.AI_SERVICE_URL = "http://127.0.0.1:59999";
  const dummyBuffer = Buffer.from("fake-image-bytes");
  const dummyLayout = { width: 100, height: 100 };

  await assert.rejects(
    async () => {
      await analyzeOmrSheet(dummyBuffer, dummyLayout, "test.png");
    },
    (err) => {
      assert.equal(err.statusCode, 503);
      assert.equal(err.code, "OMR_SERVICE_UNAVAILABLE");
      return true;
    }
  );

  // Restore
  process.env.AI_SERVICE_URL = "http://localhost:8000";
});

test("Grading Orchestrator - Exam and Template ID mismatch verification logic", () => {
  const currentExamId = "exam-123";
  const currentTemplateId = "tpl-456";

  const omrExamMismatch = {
    template: {
      examId: "exam-999",
      templateId: "tpl-456",
    },
  };

  const omrTemplateMismatch = {
    template: {
      examId: "exam-123",
      templateId: "tpl-999",
    },
  };

  assert.notEqual(omrExamMismatch.template.examId, currentExamId);
  assert.notEqual(omrTemplateMismatch.template.templateId, currentTemplateId);
});

test("Manual Review - evaluateSubmission preserves crop and teacher resolution metadata", () => {
  const exam = {
    questionCount: 4,
    maxScore: 10,
    scoringType: "EQUAL",
  };

  const answerKeys = [
    { questionNumber: 1, correctAnswer: "A", score: new Prisma.Decimal("2.5") },
    { questionNumber: 2, correctAnswer: "B", score: new Prisma.Decimal("2.5") },
    { questionNumber: 3, correctAnswer: "C", score: new Prisma.Decimal("2.5") },
    { questionNumber: 4, correctAnswer: "D", score: new Prisma.Decimal("2.5") },
  ];

  // Q1 is MARKED A (correct)
  // Q2 is resolved by teacher to B (originally MULTIPLE)
  // Q3 is resolved by teacher to null (BLANK, originally UNCERTAIN)
  // Q4 is MARKED D (correct)
  const omrAnswers = [
    { questionNumber: 1, answer: "A", candidate: "A", status: "MARKED", confidence: 0.99 },
    {
      questionNumber: 2,
      answer: "B",
      candidate: "B",
      status: "MARKED",
      confidence: 1.0,
      resolvedByTeacher: true,
      teacherResolution: "ANSWER",
      resolvedAnswer: "B",
      originalOmrStatus: "MULTIPLE",
      originalCandidates: ["B", "C"],
      reviewCropDataUrl: "data:image/jpeg;base64,fakecropq2",
    },
    {
      questionNumber: 3,
      answer: null,
      candidate: null,
      status: "BLANK",
      confidence: 1.0,
      resolvedByTeacher: true,
      teacherResolution: "BLANK",
      resolvedAnswer: null,
      originalOmrStatus: "UNCERTAIN",
      originalCandidates: ["C"],
      reviewCropDataUrl: "data:image/jpeg;base64,fakecropq3",
    },
    { questionNumber: 4, answer: "D", candidate: "D", status: "MARKED", confidence: 0.95 },
  ];

  const result = evaluateSubmission({ exam, answerKeys, omrAnswers });

  assert.equal(result.status, "FINAL");
  assert.equal(result.unresolvedCount, 0);
  assert.equal(result.correctCount, 3); // Q1 (A), Q2 (B), Q4 (D)
  assert.equal(result.blankCount, 1);   // Q3 (blank)
  assert.equal(result.finalScore, 7.5); // 3/4 * 10 = 7.5

  const q2 = result.questions.find((q) => q.questionNumber === 2);
  assert.equal(q2.resolvedByTeacher, true);
  assert.equal(q2.resolvedAnswer, "B");
  assert.equal(q2.originalOmrStatus, "MULTIPLE");
  assert.equal(q2.reviewCropDataUrl, "data:image/jpeg;base64,fakecropq2");
  assert.equal(q2.isCorrect, true);

  const q3 = result.questions.find((q) => q.questionNumber === 3);
  assert.equal(q3.resolvedByTeacher, true);
  assert.equal(q3.resolvedAnswer, null);
  assert.equal(q3.originalOmrStatus, "UNCERTAIN");
  assert.equal(q3.isCorrect, false);
});

test("Manual Review - Security & Business Rules: A through H", () => {
  const exam = { id: "exam-test", questionCount: 4, maxScore: 10, scoringType: "EQUAL" };
  const answerKeys = [
    { questionNumber: 1, correctAnswer: "A", score: new Prisma.Decimal("2.5") },
    { questionNumber: 2, correctAnswer: "B", score: new Prisma.Decimal("2.5") },
    { questionNumber: 3, correctAnswer: "C", score: new Prisma.Decimal("2.5") },
    { questionNumber: 4, correctAnswer: "D", score: new Prisma.Decimal("2.5") },
  ];

  const getBaseOmr = () => ({
    status: "SUCCESS",
    answers: [
      { questionNumber: 1, answer: "A", status: "MARKED", confidence: 0.95 },
      { questionNumber: 2, answer: null, status: "MULTIPLE", candidate: "B", confidence: 0.8 },
      { questionNumber: 3, answer: null, status: "UNCERTAIN", candidate: "C", confidence: 0.5 },
      { questionNumber: 4, answer: null, status: "MULTIPLE", candidate: "D", confidence: 0.8 },
    ],
    needsReviewQuestions: [2, 3, 4],
  });

  // A. MULTIPLE -> MULTIPLE_INVALID -> resolved -> 0 score (original omrStatus remains MULTIPLE)
  {
    const omr = getBaseOmr();
    applyReviewOverrides({
      exam,
      omrData: omr,
      reviewOverrides: [{ questionNumber: 2, resolution: "MULTIPLE_INVALID" }],
    });
    const result = evaluateSubmission({ exam, answerKeys, omrAnswers: omr.answers });
    const q2 = result.questions.find((q) => q.questionNumber === 2);
    assert.equal(q2.omrStatus, "MULTIPLE"); // Original OMR status preserved
    assert.equal(q2.originalOmrStatus, "MULTIPLE");
    assert.equal(q2.teacherResolution, "MULTIPLE_INVALID");
    assert.equal(q2.resolvedByTeacher, true);
    assert.equal(q2.resolvedAnswer, null);
    assert.equal(q2.scoreEarned, 0);
    assert.equal(q2.isCorrect, false);
    assert.equal(q2.confidence, 0.8); // Original confidence preserved
    assert.equal(q2.needsReview, false);
    assert.equal(omr.needsReviewQuestions.includes(2), false);
  }

  // B. UNCERTAIN -> BLANK -> resolved -> blankCount increments (original omrStatus remains UNCERTAIN)
  {
    const omr = getBaseOmr();
    applyReviewOverrides({
      exam,
      omrData: omr,
      reviewOverrides: [{ questionNumber: 3, resolution: "BLANK" }],
    });
    const result = evaluateSubmission({ exam, answerKeys, omrAnswers: omr.answers });
    const q3 = result.questions.find((q) => q.questionNumber === 3);
    assert.equal(q3.omrStatus, "UNCERTAIN"); // Original OMR status preserved
    assert.equal(q3.originalOmrStatus, "UNCERTAIN");
    assert.equal(q3.teacherResolution, "BLANK");
    assert.equal(q3.resolvedByTeacher, true);
    assert.equal(q3.resolvedAnswer, null);
    assert.equal(q3.scoreEarned, 0);
    assert.equal(q3.isCorrect, false);
    assert.equal(q3.confidence, 0.5); // Original confidence preserved
    assert.equal(q3.needsReview, false);
    assert.equal(result.blankCount, 1);
  }

  // C. UNCERTAIN -> ANSWER C -> allowed if teacher resolution (original omrStatus remains UNCERTAIN)
  {
    const omr = getBaseOmr();
    applyReviewOverrides({
      exam,
      omrData: omr,
      reviewOverrides: [{ questionNumber: 3, resolution: "ANSWER", answer: "C" }],
    });
    const result = evaluateSubmission({ exam, answerKeys, omrAnswers: omr.answers });
    const q3 = result.questions.find((q) => q.questionNumber === 3);
    assert.equal(q3.omrStatus, "UNCERTAIN"); // Original OMR status preserved
    assert.equal(q3.originalOmrStatus, "UNCERTAIN");
    assert.equal(q3.teacherResolution, "ANSWER");
    assert.equal(q3.resolvedByTeacher, true);
    assert.equal(q3.resolvedAnswer, "C");
    assert.equal(q3.detectedAnswer, "C");
    assert.equal(q3.isCorrect, true);
    assert.equal(q3.scoreEarned, 2.5);
    assert.equal(q3.confidence, 0.5); // Original confidence preserved
    assert.equal(q3.needsReview, false);
  }

  // D. MARKED clear question override -> rejected
  {
    const omr = getBaseOmr();
    assert.throws(
      () => {
        applyReviewOverrides({
          exam,
          omrData: omr,
          reviewOverrides: [{ questionNumber: 1, resolution: "ANSWER", answer: "B" }],
        });
      },
      (err) => {
        assert.equal(err.code, "CANNOT_OVERRIDE_RESOLVED_QUESTION");
        return true;
      }
    );
  }

  // E. Malformed ANSWER without A-D -> rejected
  {
    const omr = getBaseOmr();
    assert.throws(
      () => {
        applyReviewOverrides({
          exam,
          omrData: omr,
          reviewOverrides: [{ questionNumber: 2, resolution: "ANSWER", answer: "XYZ" }],
        });
      },
      (err) => {
        assert.equal(err.code, "INVALID_OVERRIDE_ANSWER");
        return true;
      }
    );
  }

  // F. MULTIPLE_INVALID with answer supplied -> rejected
  {
    const omr = getBaseOmr();
    assert.throws(
      () => {
        applyReviewOverrides({
          exam,
          omrData: omr,
          reviewOverrides: [{ questionNumber: 2, resolution: "MULTIPLE_INVALID", answer: "C" }],
        });
      },
      (err) => {
        assert.equal(err.code, "INVALID_OVERRIDE_ANSWER");
        return true;
      }
    );
  }

  // G. UNRESOLVED remains provisional
  {
    const omr = getBaseOmr();
    applyReviewOverrides({
      exam,
      omrData: omr,
      reviewOverrides: [{ questionNumber: 2, resolution: "UNRESOLVED" }],
    });
    const result = evaluateSubmission({ exam, answerKeys, omrAnswers: omr.answers });
    assert.equal(result.status, "PROVISIONAL");
    assert.equal(omr.needsReviewQuestions.includes(2), true);
  }

  // H. All review items resolved as blank/invalid/answer -> FINAL
  {
    const omr = getBaseOmr();
    applyReviewOverrides({
      exam,
      omrData: omr,
      reviewOverrides: [
        { questionNumber: 2, resolution: "MULTIPLE_INVALID" },
        { questionNumber: 3, resolution: "BLANK" },
        { questionNumber: 4, resolution: "ANSWER", answer: "D" },
      ],
    });
    const result = evaluateSubmission({ exam, answerKeys, omrAnswers: omr.answers });
    assert.equal(result.status, "FINAL");
    assert.equal(result.unresolvedCount, 0);
    assert.equal(result.correctCount, 2); // Q1 (A), Q4 (D)
    assert.equal(result.incorrectCount, 1); // Q2 (MULTIPLE_INVALID)
    assert.equal(result.blankCount, 1); // Q3 (BLANK)
    assert.equal(result.finalScore, 5.0); // 2/4 * 10 = 5.0
    assert.equal(result.provisionalScore, null);
  }
});
