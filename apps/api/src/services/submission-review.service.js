import { Prisma } from "@prisma/client";
import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import {
  assertSubmissionAccess,
  getSubmissionDetail,
} from "./submission.service.js";
import { assertResultsNotPublished } from "./result-publication.service.js";
import { calculateEqualScore } from "../utils/scoring.rules.js";

/**
 * Persistently reviews submission answers, re-grades deterministically using snapshots,
 * and appends audit logs inside a single transaction.
 */
export async function reviewSubmissionAnswers({ submissionId, reviews, user }) {
  const submission = await assertSubmissionAccess(submissionId, user);

  // Block mutations if results are published
  await assertResultsNotPublished(submission.examId);

  // Lifecycle check: ARCHIVED is read-only. Both PUBLISHED and CLOSED allow review.
  if (submission.exam.status === "ARCHIVED") {
    throw new AppError(
      "Kỳ thi đã được lưu trữ (ARCHIVED), không thể chỉnh sửa duyệt bài.",
      400,
      "SUBMISSION_REVIEW_NOT_ALLOWED"
    );
  }

  if (!Array.isArray(reviews) || reviews.length === 0) {
    throw new AppError("Danh sách câu hỏi cần duyệt không được rỗng.", 400, "INVALID_REVIEWS_ARRAY");
  }

  // Load all current answers for the submission
  const currentAnswers = await prisma.submissionAnswer.findMany({
    where: { submissionId },
    orderBy: { questionNumber: "asc" },
  });
  const answerMap = new Map();
  for (const ans of currentAnswers) {
    answerMap.set(ans.questionNumber, ans);
  }

  // Validate review items & eligibility
  const seenQuestions = new Set();
  const VALID_RESOLUTIONS = ["ANSWER", "BLANK", "MULTIPLE_INVALID", "UNRESOLVED"];

  for (const item of reviews) {
    const qn = item.questionNumber;
    if (seenQuestions.has(qn)) {
      throw new AppError(
        `Trùng lặp câu hỏi số ${qn} trong danh sách duyệt bài.`,
        400,
        "DUPLICATE_REVIEW_OVERRIDE"
      );
    }
    seenQuestions.add(qn);

    const targetAns = answerMap.get(qn);
    if (!targetAns) {
      throw new AppError(
        `Câu hỏi số ${qn} không tồn tại trong bài thi này.`,
        404,
        "OMR_QUESTION_NOT_FOUND"
      );
    }

    // ELIGIBILITY INVARIANT: Only original MULTIPLE or UNCERTAIN questions can receive manual review
    if (!["MULTIPLE", "UNCERTAIN"].includes(targetAns.omrStatus)) {
      throw new AppError(
        `Không thể can thiệp câu hỏi ${qn} vì AI đã nhận diện rõ ràng (${targetAns.omrStatus}).`,
        400,
        "CANNOT_OVERRIDE_RESOLVED_QUESTION"
      );
    }

    const resolution = item.resolution;
    if (!VALID_RESOLUTIONS.includes(resolution)) {
      throw new AppError(
        `Loại xác nhận không hợp lệ cho câu ${qn}: ${resolution}.`,
        400,
        "INVALID_REVIEW_RESOLUTION"
      );
    }

    if (resolution === "ANSWER") {
      const ansLetter = item.answer ? String(item.answer).toUpperCase() : null;
      if (!ansLetter || !["A", "B", "C", "D"].includes(ansLetter)) {
        throw new AppError(
          `Khi chọn loại xác nhận ANSWER cho câu ${qn}, bắt buộc phải chọn A, B, C hoặc D.`,
          400,
          "INVALID_OVERRIDE_ANSWER"
        );
      }
    } else {
      if (item.answer !== undefined && item.answer !== null) {
        throw new AppError(
          `Không được cung cấp đáp án khi chọn loại xác nhận ${resolution} cho câu ${qn}.`,
          400,
          "INVALID_OVERRIDE_ANSWER"
        );
      }
    }
  }

  // Transactional update & deterministic regrade
  await prisma.$transaction(async (tx) => {
    // 1. Update targeted answers and log audit events
    for (const item of reviews) {
      const qn = item.questionNumber;
      const targetAns = answerMap.get(qn);

      let newResolvedByTeacher = false;
      let newTeacherResolution = item.resolution;
      let newResolvedAnswer = null;

      if (item.resolution === "ANSWER") {
        newResolvedByTeacher = true;
        newTeacherResolution = "ANSWER";
        newResolvedAnswer = String(item.answer).toUpperCase();
      } else if (item.resolution === "BLANK") {
        newResolvedByTeacher = true;
        newTeacherResolution = "BLANK";
        newResolvedAnswer = null;
      } else if (item.resolution === "MULTIPLE_INVALID") {
        newResolvedByTeacher = true;
        newTeacherResolution = "MULTIPLE_INVALID";
        newResolvedAnswer = null;
      } else if (item.resolution === "UNRESOLVED") {
        newResolvedByTeacher = false;
        newTeacherResolution = "UNRESOLVED";
        newResolvedAnswer = null;
      }

      // Check if actually changed to prevent duplicate audit noise (no-op safety)
      const hasChanged =
        targetAns.teacherResolution !== newTeacherResolution ||
        targetAns.resolvedAnswer !== newResolvedAnswer ||
        targetAns.resolvedByTeacher !== newResolvedByTeacher;

      if (hasChanged) {
        // Append ANSWER_REVIEWED audit log
        await tx.examSubmissionAuditLog.create({
          data: {
            submissionId,
            actorUserId: user.id,
            eventType: "ANSWER_REVIEWED",
            questionNumber: qn,
            beforeState: {
              teacherResolution: targetAns.teacherResolution,
              resolvedAnswer: targetAns.resolvedAnswer,
              resolvedByTeacher: targetAns.resolvedByTeacher,
            },
            afterState: {
              teacherResolution: newTeacherResolution,
              resolvedAnswer: newResolvedAnswer,
              resolvedByTeacher: newResolvedByTeacher,
            },
          },
        });

        // Update in-memory answer for regrade calculation
        targetAns.teacherResolution = newTeacherResolution;
        targetAns.resolvedAnswer = newResolvedAnswer;
        targetAns.resolvedByTeacher = newResolvedByTeacher;
        targetAns.reviewedByUserId = user.id;
        targetAns.reviewedAt = new Date();
      }
    }

    // 2. Deterministic regrade using stored snapshots
    const qCount = submission.questionCountSnapshot;
    const maxScore = Number(submission.maxScoreSnapshot);
    const scoringType = submission.scoringTypeSnapshot;

    let correctCount = 0;
    let incorrectCount = 0;
    let blankCount = 0;
    let unresolvedCount = 0;
    let customScoreDecimal = new Prisma.Decimal(0);

    const updatedAnswersData = [];

    for (const ans of currentAnswers) {
      let isCorrect = null;
      let scoreEarned = null;
      let result = "UNRESOLVED";
      let needsReview = false;
      let effectiveAnswer = null;

      if (ans.resolvedByTeacher) {
        if (ans.teacherResolution === "ANSWER") {
          effectiveAnswer = ans.resolvedAnswer;
          if (ans.resolvedAnswer === ans.correctAnswerSnapshot) {
            isCorrect = true;
            result = "CORRECT";
            correctCount++;
            if (scoringType === "CUSTOM") {
              const weight = new Prisma.Decimal(ans.scoreSnapshot);
              customScoreDecimal = customScoreDecimal.plus(weight);
              scoreEarned = weight;
            } else if (scoringType === "EQUAL") {
              scoreEarned = new Prisma.Decimal(
                calculateEqualScore(1, qCount, maxScore)
              );
            }
          } else {
            isCorrect = false;
            result = "INCORRECT";
            incorrectCount++;
            scoreEarned = new Prisma.Decimal(0);
          }
        } else if (ans.teacherResolution === "BLANK") {
          effectiveAnswer = null;
          isCorrect = false;
          result = "BLANK";
          blankCount++;
          scoreEarned = new Prisma.Decimal(0);
        } else if (ans.teacherResolution === "MULTIPLE_INVALID") {
          effectiveAnswer = null;
          isCorrect = false;
          result = "INVALID_MULTIPLE";
          incorrectCount++;
          scoreEarned = new Prisma.Decimal(0);
        }
        needsReview = false;
      } else {
        if (ans.omrStatus === "MARKED") {
          effectiveAnswer = ans.detectedAnswer;
          if (ans.detectedAnswer === ans.correctAnswerSnapshot) {
            isCorrect = true;
            result = "CORRECT";
            correctCount++;
            if (scoringType === "CUSTOM") {
              const weight = new Prisma.Decimal(ans.scoreSnapshot);
              customScoreDecimal = customScoreDecimal.plus(weight);
              scoreEarned = weight;
            } else if (scoringType === "EQUAL") {
              scoreEarned = new Prisma.Decimal(
                calculateEqualScore(1, qCount, maxScore)
              );
            }
          } else {
            isCorrect = false;
            result = "INCORRECT";
            incorrectCount++;
            scoreEarned = new Prisma.Decimal(0);
          }
          needsReview = false;
        } else if (ans.omrStatus === "BLANK") {
          effectiveAnswer = null;
          isCorrect = false;
          result = "BLANK";
          blankCount++;
          scoreEarned = new Prisma.Decimal(0);
          needsReview = false;
        } else {
          effectiveAnswer = null;
          isCorrect = null;
          result = "UNRESOLVED";
          unresolvedCount++;
          scoreEarned = null;
          needsReview = true;
        }
      }

      updatedAnswersData.push({
        id: ans.id,
        resolvedByTeacher: ans.resolvedByTeacher,
        teacherResolution: ans.teacherResolution,
        resolvedAnswer: ans.resolvedAnswer,
        reviewedByUserId: ans.reviewedByUserId,
        reviewedAt: ans.reviewedAt,
        effectiveAnswer,
        result,
        scoreEarned,
        needsReview,
      });

      await tx.submissionAnswer.update({
        where: { id: ans.id },
        data: {
          resolvedByTeacher: ans.resolvedByTeacher,
          teacherResolution: ans.teacherResolution,
          resolvedAnswer: ans.resolvedAnswer,
          reviewedByUserId: ans.reviewedByUserId,
          reviewedAt: ans.reviewedAt,
          effectiveAnswer,
          result,
          scoreEarned,
          needsReview,
        },
      });
    }

    // 3. Compute final/provisional score
    let calculatedScore = 0;
    if (scoringType === "EQUAL") {
      calculatedScore = calculateEqualScore(correctCount, qCount, maxScore);
    } else if (scoringType === "CUSTOM") {
      calculatedScore = customScoreDecimal.toDecimalPlaces(4).toNumber();
    }

    const isProvisional = unresolvedCount > 0;
    const newStatus = isProvisional ? "PROVISIONAL" : "FINAL";
    const newFinalScore = isProvisional ? null : new Prisma.Decimal(calculatedScore);
    const newProvisionalScore = isProvisional ? new Prisma.Decimal(calculatedScore) : null;
    const newFinalizedAt = isProvisional ? null : new Date();

    // 4. Update ExamSubmission summary
    await tx.examSubmission.update({
      where: { id: submissionId },
      data: {
        status: newStatus,
        correctCount,
        incorrectCount,
        blankCount,
        unresolvedCount,
        provisionalScore: newProvisionalScore,
        finalScore: newFinalScore,
        finalizedAt: newFinalizedAt,
      },
    });

    // 5. Append REGRADED audit log
    await tx.examSubmissionAuditLog.create({
      data: {
        submissionId,
        actorUserId: user.id,
        eventType: "REGRADED",
        afterState: {
          status: newStatus,
          finalScore: newFinalScore !== null ? String(newFinalScore) : null,
          provisionalScore: newProvisionalScore !== null ? String(newProvisionalScore) : null,
          correctCount,
          incorrectCount,
          blankCount,
          unresolvedCount,
        },
      },
    });
  });

  return getSubmissionDetail({ submissionId, user });
}

/**
 * Persistently reviews student candidate number (SBD).
 */
export async function reviewSubmissionIdentity({ submissionId, studentNumber, user }) {
  const submission = await assertSubmissionAccess(submissionId, user);

  // Block mutations if results are published
  await assertResultsNotPublished(submission.examId);

  if (submission.exam.status === "ARCHIVED") {
    throw new AppError(
      "Kỳ thi đã được lưu trữ (ARCHIVED), không thể chỉnh sửa danh tính thí sinh.",
      400,
      "SUBMISSION_REVIEW_NOT_ALLOWED"
    );
  }

  const cleanSbd = String(studentNumber || "").trim();
  if (!/^\d{6}$/.test(cleanSbd)) {
    throw new AppError(
      "Số báo danh phải bao gồm đúng 6 chữ số.",
      400,
      "INVALID_STUDENT_NUMBER"
    );
  }

  const beforeState = {
    resolvedStudentNumber: submission.resolvedStudentNumber,
    identityNeedsReview: submission.identityNeedsReview,
  };

  const afterState = {
    resolvedStudentNumber: cleanSbd,
    identityNeedsReview: false,
  };

  const shouldFinalize = submission.unresolvedCount === 0;
  const newStatus = shouldFinalize ? "FINAL" : "PROVISIONAL";
  const calculatedScore = submission.provisionalScore ?? submission.finalScore;
  const newFinalScore = shouldFinalize ? calculatedScore : null;
  const newProvisionalScore = shouldFinalize ? null : calculatedScore;
  const newFinalizedAt = shouldFinalize ? new Date() : null;

  await prisma.$transaction(async (tx) => {
    await tx.examSubmission.update({
      where: { id: submissionId },
      data: {
        resolvedStudentNumber: cleanSbd,
        identityNeedsReview: false,
        identityReviewedByUserId: user.id,
        identityReviewedAt: new Date(),
        status: newStatus,
        finalScore: newFinalScore,
        provisionalScore: newProvisionalScore,
        finalizedAt: newFinalizedAt,
      },
    });

    await tx.examSubmissionAuditLog.create({
      data: {
        submissionId,
        actorUserId: user.id,
        eventType: "IDENTITY_REVIEWED",
        beforeState,
        afterState,
      },
    });
  });

  return getSubmissionDetail({ submissionId, user });
}
