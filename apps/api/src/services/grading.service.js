import { Prisma } from "@prisma/client";
import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import { assertExamAccess } from "./exam.service.js";
import { analyzeOmrSheet } from "./omr-client.service.js";

/**
 * Pure evaluation function for student answers against answer keys.
 *
 * @param {object} params
 * @param {object} params.exam - { questionCount, maxScore, scoringType }
 * @param {Array<object>} params.answerKeys - List of AnswerKey records
 * @param {Array<object>} params.omrAnswers - List of answer objects from OMR
 * @returns {object} Grading result object
 */
export function evaluateSubmission({ exam, answerKeys, omrAnswers }) {
  const keyMap = new Map();
  for (const ak of answerKeys) {
    keyMap.set(ak.questionNumber, ak);
  }

  const omrMap = new Map();
  for (const ans of (omrAnswers || [])) {
    omrMap.set(ans.questionNumber, ans);
  }

  const questionCount = exam.questionCount;
  const scoringType = exam.scoringType;
  const maxScore = Number(exam.maxScore);

  let correctCount = 0;
  let incorrectCount = 0;
  let blankCount = 0;
  let unresolvedCount = 0;

  const gradedQuestions = [];
  let customScoreDecimal = new Prisma.Decimal(0);

  for (let qn = 1; qn <= questionCount; qn++) {
    const key = keyMap.get(qn);
    const omr = omrMap.get(qn) || {
      questionNumber: qn,
      answer: null,
      candidate: null,
      status: "BLANK",
      confidence: 0,
    };

    const correctAnswer = key ? key.correctAnswer : null;
    const omrStatus = omr.status || "BLANK";
    const detectedAnswer = omr.answer || null;
    const candidate = omr.candidate || null;
    const confidence = typeof omr.confidence === "number" ? omr.confidence : 0;

    let isCorrect = null;
    let scoreEarned = null;

    if (omrStatus === "MARKED") {
      if (detectedAnswer === correctAnswer) {
        isCorrect = true;
        correctCount++;
        if (scoringType === "CUSTOM" && key) {
          const keyScore = new Prisma.Decimal(key.score);
          customScoreDecimal = customScoreDecimal.plus(keyScore);
          scoreEarned = keyScore.toNumber();
        } else if (scoringType === "EQUAL") {
          scoreEarned = Math.round((maxScore / questionCount) * 10000) / 10000;
        }
      } else {
        isCorrect = false;
        incorrectCount++;
        scoreEarned = 0;
      }
    } else if (omrStatus === "BLANK") {
      isCorrect = false;
      blankCount++;
      scoreEarned = 0;
    } else {
      // MULTIPLE or UNCERTAIN or other unresolved states
      // candidate MUST NEVER be graded as final answer!
      isCorrect = null;
      unresolvedCount++;
      scoreEarned = null;
    }

    gradedQuestions.push({
      questionNumber: qn,
      detectedAnswer,
      candidate,
      omrStatus,
      correctAnswer,
      isCorrect,
      confidence,
      scoreEarned,
    });
  }

  // Calculate score
  let calculatedScore = 0;
  if (scoringType === "EQUAL") {
    if (questionCount > 0) {
      const rawScore = (correctCount / questionCount) * maxScore;
      calculatedScore = Math.round(rawScore * 10000) / 10000;
    }
  } else if (scoringType === "CUSTOM") {
    // Exact Decimal arithmetic, rounded to 4 decimal places
    calculatedScore = customScoreDecimal.toDecimalPlaces(4).toNumber();
  }

  const isProvisional = unresolvedCount > 0;

  return {
    status: isProvisional ? "PROVISIONAL" : "FINAL",
    finalScore: isProvisional ? null : calculatedScore,
    provisionalScore: isProvisional ? calculatedScore : null,
    correctCount,
    incorrectCount,
    blankCount,
    unresolvedCount,
    maxScore,
    questions: gradedQuestions,
  };
}

/**
 * Complete grading orchestration pipeline:
 * Exam ownership -> exam status -> template lookup -> FastAPI call -> QR verification
 * -> ExamCode lookup -> AnswerKey lookup -> grading
 *
 * @param {string} examId
 * @param {Buffer} imageBuffer
 * @param {string} filename
 * @param {object} reqUser
 * @returns {Promise<object>} Full response payload
 */
export async function gradeExamImage(examId, imageBuffer, filename, reqUser) {
  // 1. Exam access & ownership
  const exam = await assertExamAccess(examId, reqUser);

  // 2. Exam status check (Only PUBLISHED exams can be graded in Phase 5)
  if (exam.status !== "PUBLISHED") {
    throw new AppError(
      "Chỉ có thể chấm bài cho kỳ thi ở trạng thái PUBLISHED.",
      409,
      "EXAM_NOT_AVAILABLE_FOR_GRADING"
    );
  }

  // 3. Load latest AnswerSheetTemplate
  // Phase 5 assumption: Using the latest template is safe because template generation
  // is locked after an exam is PUBLISHED.
  const template = await prisma.answerSheetTemplate.findFirst({
    where: { examId },
    orderBy: { version: "desc" },
  });

  if (!template) {
    throw new AppError(
      "Chưa có phiếu trả lời mẫu nào được tạo cho kỳ thi này.",
      404,
      "ANSWER_SHEET_TEMPLATE_NOT_FOUND"
    );
  }

  if (template.pageCount > 1) {
    throw new AppError(
      "Phiếu nhiều trang chưa được hỗ trợ trong chế độ chấm một ảnh.",
      400,
      "MULTI_PAGE_GRADING_NOT_SUPPORTED_YET"
    );
  }

  // 4. Call FastAPI OMR service
  const omrData = await analyzeOmrSheet(imageBuffer, template.layoutJson, filename);

  // 5. Strict QR / Template Integrity Verification
  if (!omrData.template || omrData.template.examId !== exam.id) {
    throw new AppError(
      "Phiếu trả lời không thuộc về kỳ thi này (Mã kỳ thi trên QR không khớp).",
      422,
      "OMR_EXAM_MISMATCH"
    );
  }

  if (omrData.template.templateId !== template.id) {
    throw new AppError(
      "Phiếu trả lời không khớp với mẫu phiếu chuẩn của kỳ thi (Template ID không khớp).",
      422,
      "OMR_TEMPLATE_MISMATCH"
    );
  }

  const identityNeedsReview = !omrData.studentNumber?.value;

  // 6. ExamCode resolution
  if (!omrData.examCode?.value) {
    return {
      exam: {
        id: exam.id,
        title: exam.title,
        questionCount: exam.questionCount,
        maxScore: Number(exam.maxScore),
        scoringType: exam.scoringType,
      },
      omr: {
        status: omrData.status,
        studentNumber: omrData.studentNumber,
        examCode: omrData.examCode,
        quality: omrData.quality,
        needsReviewQuestions: omrData.needsReviewQuestions,
        identityNeedsReview,
      },
      grading: null,
      status: "NEEDS_REVIEW",
      reason: "EXAM_CODE_UNCERTAIN",
    };
  }

  const detectedCode = omrData.examCode.value;
  const examCode = await prisma.examCode.findUnique({
    where: {
      examId_code: {
        examId,
        code: detectedCode,
      },
    },
    include: {
      answerKeys: {
        orderBy: { questionNumber: "asc" },
      },
    },
  });

  if (!examCode) {
    throw new AppError(
      `Mã đề '${detectedCode}' không tồn tại trong kỳ thi này.`,
      404,
      "OMR_EXAM_CODE_NOT_FOUND"
    );
  }

  // 7. Grade submission
  const grading = evaluateSubmission({
    exam,
    answerKeys: examCode.answerKeys,
    omrAnswers: omrData.answers,
  });

  return {
    exam: {
      id: exam.id,
      title: exam.title,
      questionCount: exam.questionCount,
      maxScore: Number(exam.maxScore),
      scoringType: exam.scoringType,
    },
    omr: {
      status: omrData.status,
      studentNumber: omrData.studentNumber,
      examCode: omrData.examCode,
      quality: omrData.quality,
      needsReviewQuestions: omrData.needsReviewQuestions,
      identityNeedsReview,
    },
    grading,
  };
}
