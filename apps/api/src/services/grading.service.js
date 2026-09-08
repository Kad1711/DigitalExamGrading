import { Prisma } from "@prisma/client";
import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import { assertExamAccess } from "./exam.service.js";
import { analyzeOmrSheet } from "./omr-client.service.js";
import { normalizeExamCode } from "../utils/exam-code.js";

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

    if (omr.resolvedByTeacher) {
      const resolution =
        omr.teacherResolution ||
        (omr.resolvedAnswer ? "ANSWER" : omr.resolvedAnswer === null ? "BLANK" : null);

      if (resolution === "ANSWER") {
        const teacherAns = omr.resolvedAnswer;
        if (teacherAns === correctAnswer) {
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
      } else if (resolution === "BLANK") {
        isCorrect = false;
        blankCount++;
        scoreEarned = 0;
      } else if (resolution === "MULTIPLE_INVALID") {
        isCorrect = false;
        incorrectCount++;
        scoreEarned = 0;
      }
    } else {
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
    }

    gradedQuestions.push({
      questionNumber: qn,
      detectedAnswer:
        omr.resolvedByTeacher && omr.teacherResolution === "ANSWER"
          ? omr.resolvedAnswer
          : detectedAnswer,
      candidate,
      omrStatus,
      correctAnswer,
      isCorrect,
      confidence,
      scoreEarned,
      fillRatios: omr.fillRatios || null,
      reviewCropDataUrl: omr.reviewCropDataUrl || null,
      resolvedByTeacher: omr.resolvedByTeacher || false,
      teacherResolution: omr.teacherResolution || undefined,
      resolvedAnswer: omr.resolvedAnswer !== undefined ? omr.resolvedAnswer : undefined,
      originalOmrStatus: omr.originalOmrStatus || omrStatus,
      originalCandidates: omr.originalCandidates || undefined,
      needsReview: !omr.resolvedByTeacher && (omrStatus === "MULTIPLE" || omrStatus === "UNCERTAIN"),
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
 * Applies teacher review overrides onto OMR answers (stateless manual review).
 *
 * Supported resolutions:
 * - "ANSWER": requires valid "A", "B", "C", or "D" answer.
 * - "BLANK": student left blank. Answer must not be supplied.
 * - "MULTIPLE_INVALID": student marked multiple bubbles. Answer must not be supplied.
 * - "UNRESOLVED": student mark cannot be determined. Answer must not be supplied.
 *
 * @param {object} params
 * @param {object} params.exam - { id, questionCount }
 * @param {object} params.omrData - OMR recognition output { answers, needsReviewQuestions, ... }
 * @param {Array<object>} params.reviewOverrides - list of override items
 * @returns {object} updated omrData
 */
export function applyReviewOverrides({ exam, omrData, reviewOverrides }) {
  if (!reviewOverrides || !Array.isArray(reviewOverrides) || reviewOverrides.length === 0) {
    return omrData;
  }

  const seenQuestions = new Set();
  const VALID_RESOLUTIONS = ["ANSWER", "BLANK", "MULTIPLE_INVALID", "UNRESOLVED"];

  for (const ro of reviewOverrides) {
    if (!ro || typeof ro !== "object") {
      throw new AppError(
        "Mục xác nhận bài thi không đúng định dạng đối tượng.",
        400,
        "INVALID_REVIEW_OVERRIDE_ITEM"
      );
    }

    const qn = Number(ro.questionNumber);
    if (!Number.isInteger(qn) || qn < 1 || qn > exam.questionCount) {
      throw new AppError(
        `Số thứ tự câu hỏi không hợp lệ trong yêu cầu xác nhận: ${ro.questionNumber}`,
        400,
        "INVALID_OVERRIDE_QUESTION_NUMBER"
      );
    }
    if (seenQuestions.has(qn)) {
      throw new AppError(
        `Trùng lặp câu hỏi số ${qn} trong danh sách xác nhận.`,
        400,
        "DUPLICATE_REVIEW_OVERRIDE"
      );
    }
    seenQuestions.add(qn);

    const targetAns = omrData.answers.find((a) => a.questionNumber === qn);
    if (!targetAns) {
      throw new AppError(
        `Không tìm thấy kết quả nhận diện của câu hỏi ${qn}.`,
        404,
        "OMR_QUESTION_NOT_FOUND"
      );
    }

    // SECURITY RULE: Only MULTIPLE or UNCERTAIN questions can be manually resolved
    if (!["MULTIPLE", "UNCERTAIN"].includes(targetAns.status)) {
      throw new AppError(
        `Không thể can thiệp câu hỏi ${qn} vì câu hỏi này đã được AI nhận diện rõ ràng (${targetAns.status}).`,
        400,
        "CANNOT_OVERRIDE_RESOLVED_QUESTION"
      );
    }

    const resolution = ro.resolution;
    if (!VALID_RESOLUTIONS.includes(resolution)) {
      throw new AppError(
        `Loại xác nhận không hợp lệ cho câu ${qn}: ${resolution}. Các loại hợp lệ: ${VALID_RESOLUTIONS.join(", ")}`,
        400,
        "INVALID_REVIEW_RESOLUTION"
      );
    }

    // Preserve original OMR state for teacher-resolution metadata
    targetAns.originalOmrStatus = targetAns.originalOmrStatus || targetAns.status;
    targetAns.originalCandidates = targetAns.originalCandidates || (
      targetAns.candidate
        ? [targetAns.candidate]
        : targetAns.fillRatios
        ? Object.keys(targetAns.fillRatios).filter((k) => targetAns.fillRatios[k] >= 0.35)
        : []
    );

    if (resolution === "ANSWER") {
      const ans = ro.answer ? String(ro.answer).toUpperCase() : null;
      if (!ans || !["A", "B", "C", "D"].includes(ans)) {
        throw new AppError(
          `Phương án xác nhận không hợp lệ cho câu ${qn}: ${ro.answer}. Khi chọn ANSWER, bắt buộc phải chọn A, B, C hoặc D.`,
          400,
          "INVALID_OVERRIDE_ANSWER"
        );
      }

      targetAns.resolvedByTeacher = true;
      targetAns.teacherResolution = "ANSWER";
      targetAns.resolvedAnswer = ans;

      omrData.needsReviewQuestions = (omrData.needsReviewQuestions || []).filter((qNum) => qNum !== qn);
    } else if (resolution === "BLANK") {
      if (ro.answer !== undefined && ro.answer !== null) {
        throw new AppError(
          `Không được cung cấp đáp án (answer) khi chọn xác nhận BLANK cho câu ${qn}.`,
          400,
          "INVALID_OVERRIDE_ANSWER"
        );
      }

      targetAns.resolvedByTeacher = true;
      targetAns.teacherResolution = "BLANK";
      targetAns.resolvedAnswer = null;

      omrData.needsReviewQuestions = (omrData.needsReviewQuestions || []).filter((qNum) => qNum !== qn);
    } else if (resolution === "MULTIPLE_INVALID") {
      if (ro.answer !== undefined && ro.answer !== null) {
        throw new AppError(
          `Không được cung cấp đáp án (answer) khi chọn xác nhận MULTIPLE_INVALID cho câu ${qn}.`,
          400,
          "INVALID_OVERRIDE_ANSWER"
        );
      }

      targetAns.resolvedByTeacher = true;
      targetAns.teacherResolution = "MULTIPLE_INVALID";
      targetAns.resolvedAnswer = null;

      omrData.needsReviewQuestions = (omrData.needsReviewQuestions || []).filter((qNum) => qNum !== qn);
    } else if (resolution === "UNRESOLVED") {
      if (ro.answer !== undefined && ro.answer !== null) {
        throw new AppError(
          `Không được cung cấp đáp án (answer) khi trạng thái là UNRESOLVED cho câu ${qn}.`,
          400,
          "INVALID_OVERRIDE_ANSWER"
        );
      }

      targetAns.resolvedByTeacher = false;
      targetAns.teacherResolution = "UNRESOLVED";
      targetAns.resolvedAnswer = null;

      if (!omrData.needsReviewQuestions.includes(qn)) {
        omrData.needsReviewQuestions.push(qn);
      }
    }
  }

  return omrData;
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
 * @param {Array<object>} reviewOverrides
 * @returns {Promise<object>} Full response payload
 */
export async function gradeExamImage(examId, imageBuffer, filename, reqUser, reviewOverrides = null) {
  const t0 = performance.now();

  // 1. Exam access & ownership
  const exam = await assertExamAccess(examId, reqUser);

  // 2. Exam status check (Only PUBLISHED exams can be graded in Phase 5)
  if (exam.status !== "PUBLISHED") {
    throw new AppError(
      "Chỉ có thể chấm bài cho kỳ thi đã phát hành.",
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

  // 4. Call FastAPI OMR service with timing
  const omrStart = performance.now();
  const omrData = await analyzeOmrSheet(imageBuffer, template.layoutJson, filename);
  const omrTimeMs = Math.round(performance.now() - omrStart);

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
    const totalTimeMs = Math.round(performance.now() - t0);
    console.log(
      `[GRADE] examId=${exam.id} status=NEEDS_REVIEW reason=EXAM_CODE_UNCERTAIN omrMs=${omrTimeMs} totalMs=${totalTimeMs}`
    );
    return {
      status: "NEEDS_REVIEW",
      reason: "EXAM_CODE_UNCERTAIN",
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
      meta: {
        processingTimeMs: totalTimeMs,
        omrTimeMs,
        gradingTimeMs: 0,
      },
    };
  }

  const detectedCode = omrData.examCode.value;
  let normalizedDetectedCode;
  try {
    normalizedDetectedCode = normalizeExamCode(detectedCode);
  } catch {
    normalizedDetectedCode = detectedCode;
  }

  // Load tat ca ma de cua ky thi de so sanh ca ma goc va ma da chuan hoa (vi du: "001" khop voi "01")
  const allExamCodes = await prisma.examCode.findMany({
    where: { examId },
    include: {
      answerKeys: {
        orderBy: { questionNumber: "asc" },
      },
    },
  });

  const examCode = allExamCodes.find((ec) => {
    try {
      return normalizeExamCode(ec.code) === normalizedDetectedCode;
    } catch {
      return ec.code === detectedCode;
    }
  });

  if (!examCode) {
    throw new AppError(
      `Mã đề '${detectedCode}' (chuẩn hóa: '${normalizedDetectedCode}') không tồn tại trong kỳ thi này.`,
      404,
      "OMR_EXAM_CODE_NOT_FOUND"
    );
  }

  // 6b. Apply Teacher Review Overrides (stateless manual review)
  if (reviewOverrides && Array.isArray(reviewOverrides) && reviewOverrides.length > 0) {
    applyReviewOverrides({ exam, omrData, reviewOverrides });
  }

  // 7. Grade submission with timing
  const gradingStart = performance.now();
  const grading = evaluateSubmission({
    exam,
    answerKeys: examCode.answerKeys,
    omrAnswers: omrData.answers,
  });
  const gradingTimeMs = Math.round(performance.now() - gradingStart);
  const totalTimeMs = Math.round(performance.now() - t0);

  console.log(
    `[GRADE] examId=${exam.id} code=${detectedCode} status=${grading.status} score=${grading.finalScore ?? grading.provisionalScore} omrMs=${omrTimeMs} gradingMs=${gradingTimeMs} totalMs=${totalTimeMs}`
  );

  return {
    status: grading.status,
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
    meta: {
      processingTimeMs: totalTimeMs,
      omrTimeMs,
      gradingTimeMs,
    },
  };
}
