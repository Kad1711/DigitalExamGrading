import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import { assertExamAccess } from "./exam.service.js";

// =====================================================
// ANSWER KEY SERVICE
// =====================================================

async function assertExamCodeBelongsToExam(examId, codeId) {
  const examCode = await prisma.examCode.findUnique({
    where: { id: codeId },
    include: { exam: true },
  });
  if (!examCode || examCode.examId !== examId) {
    throw new AppError(
      "Ma de khong ton tai trong ky thi nay.",
      404,
      "EXAM_CODE_NOT_FOUND"
    );
  }
  return examCode;
}

/**
 * =====================================================================
 * SCORING SYSTEM DESIGN SPECIFICATION:
 * =====================================================================
 *
 * 1. SCORING_TYPE = EQUAL:
 *    - Final score của học sinh KHÔNG ĐƯỢC tính bằng: SUM(AnswerKey.score).
 *    - Khi chấm bài (Grading Engine):
 *        finalScore = (correctCount / questionCount) * maxScore
 *    - Ví dụ:
 *        questionCount = 30, maxScore = 10:
 *        30/30 câu đúng -> (30 / 30) * 10 = 10.0
 *        27/30 câu đúng -> (27 / 30) * 10 = 9.0
 *    - Giá trị `AnswerKey.score` lưu trong DB (maxScore / questionCount) CHỈ mang tính chất
 *      THAM KHẢO / HIỂN THỊ (informational / display reference), KHÔNG PHẢI nguồn sự thật
 *      (source of truth) cho kết quả chấm thi cuối cùng.
 *      Không bắt buộc per-question score * questionCount == exactly maxScore khi chia lẻ
 *      (ví dụ 0.3333 * 30 = 9.999 vẫn hoàn toàn hợp lệ cho hiển thị).
 *
 * 2. SCORING_TYPE = CUSTOM:
 *    - Mỗi câu hỏi có điểm số riêng `AnswerKey.score`.
 *    - Tổng điểm thi của học sinh:
 *        finalScore = SUM(score của các câu trả lời đúng)
 *    - Bắt buộc khi publish: SUM(AnswerKey.score) == Exam.maxScore.
 * =====================================================================
 */

/**
 * Helper tinh diem thi chinh thuc cho hoc sinh (dung cho Grading Engine).
 * Dam bao tinh dung theo quy tac:
 * - EQUAL: (correctCount / questionCount) * maxScore
 * - CUSTOM: SUM(score cac cau dung)
 */
export function calculateExamScore({ scoringType, questionCount, maxScore, correctCount, correctQuestionScores = [] }) {
  if (scoringType === "EQUAL") {
    if (!questionCount || questionCount <= 0) return 0;
    const score = (Number(correctCount) / Number(questionCount)) * Number(maxScore);
    return Math.round(score * 10000) / 10000;
  }

  if (scoringType === "CUSTOM") {
    const total = correctQuestionScores.reduce((sum, s) => sum + Number(s), 0);
    return Math.round(total * 10000) / 10000;
  }

  throw new AppError("scoringType khong hop le.", 400, "INVALID_SCORING_TYPE");
}

/**
 * Tinh score tham khao moi cau khi EQUAL de hien thi / luu tru (informational only).
 * maxScore / questionCount, lam tron 4 chu so thap phan.
 */
function calcEqualScore(maxScore, questionCount) {
  return Math.round((Number(maxScore) / questionCount) * 10000) / 10000;
}

function validateAnswers(answers, questionCount, scoringType) {
  const seen = new Set();
  const errors = [];

  for (const ans of answers) {
    const qn = ans.questionNumber;

    if (qn < 1 || qn > questionCount) {
      errors.push(`questionNumber ${qn} vuot khoang hop le [1, ${questionCount}].`);
    }
    if (seen.has(qn)) {
      errors.push(`questionNumber ${qn} bi trung lap.`);
    }
    seen.add(qn);

    if (scoringType === "CUSTOM" && (ans.score === undefined || ans.score === null)) {
      errors.push(`questionNumber ${qn}: score la bat buoc khi scoringType = CUSTOM.`);
    }
  }

  if (errors.length > 0) {
    throw new AppError(errors.join(" | "), 422, "ANSWER_KEY_INVALID");
  }
}

export async function putAnswerKey(examId, codeId, answers, reqUser) {
  const exam = await assertExamAccess(examId, reqUser);
  const examCode = await assertExamCodeBelongsToExam(examId, codeId);

  if (exam.status !== "DRAFT") {
    throw new AppError(
      "Khong the sua AnswerKey khi ky thi da duoc publish.",
      409,
      "EXAM_NOT_DRAFT"
    );
  }

  const { questionCount, maxScore, scoringType } = exam;

  if (answers.length !== questionCount) {
    throw new AppError(
      `Can dung ${questionCount} dap an, ban gui ${answers.length}.`,
      422,
      "INVALID_QUESTION_COUNT"
    );
  }

  validateAnswers(answers, questionCount, scoringType);

  const equalScore =
    scoringType === "EQUAL" ? calcEqualScore(maxScore, questionCount) : null;

  // Kiem tra CUSTOM: tong score
  if (scoringType === "CUSTOM") {
    const total = answers.reduce((sum, a) => sum + Number(a.score), 0);
    const rounded = Math.round(total * 10000) / 10000;
    const ms = Number(maxScore);
    if (Math.abs(rounded - ms) > 0.0001) {
      throw new AppError(
        `Tong score CUSTOM ${rounded} khong bang maxScore ${ms}.`,
        422,
        "CUSTOM_SCORE_TOTAL_MISMATCH"
      );
    }
  }

  // Transaction: replace toan bo
  const result = await prisma.$transaction(async (tx) => {
    await tx.answerKey.deleteMany({ where: { examCodeId: codeId } });
    return tx.answerKey.createMany({
      data: answers.map((a) => ({
        examCodeId: codeId,
        questionNumber: a.questionNumber,
        correctAnswer: a.correctAnswer,
        score: scoringType === "EQUAL" ? equalScore : Number(a.score),
      })),
    });
  });

  return result;
}

export async function getAnswerKey(examId, codeId, reqUser) {
  await assertExamAccess(examId, reqUser);
  const examCode = await assertExamCodeBelongsToExam(examId, codeId);

  const answerKeys = await prisma.answerKey.findMany({
    where: { examCodeId: codeId },
    orderBy: { questionNumber: "asc" },
    select: { questionNumber: true, correctAnswer: true, score: true },
  });

  return {
    examCode: examCode.code,
    answers: answerKeys.map((ak) => ({
      questionNumber: ak.questionNumber,
      correctAnswer: ak.correctAnswer,
      score: Number(ak.score),
    })),
  };
}