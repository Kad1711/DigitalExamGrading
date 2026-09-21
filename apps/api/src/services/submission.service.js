import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import { Prisma } from "@prisma/client";
import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import { assertExamAccess, assertExamManageAccess, getTeacherProfile } from "./exam.service.js";
import { analyzeOmrSheet } from "./omr-client.service.js";
import { normalizeExamCode } from "../utils/exam-code.js";
import { evaluateSubmission } from "./grading.service.js";
import {
  saveOriginalSubmissionImage,
  saveReviewCropImage,
  cleanupSubmissionStorage,
  storageService,
} from "./storage/storage.service.js";
import { assertResultsNotPublished } from "./result-publication.service.js";

/**
 * Asserts access to a submission for a requesting user.
 * Teachers can only access submissions for exams they own.
 *
 * @param {string} submissionId
 * @param {object} reqUser
 * @returns {Promise<object>} ExamSubmission with exam, examCode, template
 */
export async function assertSubmissionAccess(submissionId, reqUser) {
  const submission = await prisma.examSubmission.findUnique({
    where: { id: submissionId },
    include: {
      exam: {
        include: {
          teacher: { select: { id: true, fullName: true, teacherCode: true } },
          subject: { select: { id: true, name: true, code: true } },
          class: { select: { id: true, name: true } },
          examClasses: { include: { class: { select: { id: true, name: true } } } },
        },
      },
      examCode: { select: { id: true, code: true } },
      template: { select: { id: true, version: true, templateVersion: true } },
      gradedByUser: { select: { id: true, email: true } },
      identityReviewedByUser: { select: { id: true, email: true } },
    },
  });

  if (!submission) {
    throw new AppError("Không tìm thấy bài nộp trong hệ thống.", 404, "SUBMISSION_NOT_FOUND");
  }

  await assertExamAccess(submission.examId, reqUser);
  return submission;
}

/**
 * Formats a submission model into a clean API response DTO.
 */
export function formatSubmissionResponse(sub, answers = [], auditLogs = []) {
  const isProvisional = sub.status === "PROVISIONAL";

  const formattedAnswers = answers.map((ans) => ({
    id: ans.id,
    questionNumber: ans.questionNumber,
    detectedAnswer: ans.detectedAnswer,
    candidate: ans.candidate,
    originalCandidates: ans.originalCandidates,
    omrStatus: ans.omrStatus,
    confidence: ans.confidence !== null ? Number(ans.confidence) : null,
    manualResolvedAnswer: ans.manualResolvedAnswer,
    isOverridden: ans.isOverridden,
    isCorrect: ans.isCorrect,
    score: ans.score !== null ? Number(ans.score) : null,
    hasReviewCrop: !!ans.reviewCropStorageKey,
    needsReview: ans.omrStatus === "MULTIPLE" || ans.omrStatus === "UNCERTAIN",
  }));

  return {
    id: sub.id,
    examId: sub.examId,
    examTitle: sub.exam?.title || null,
    student: {
      detectedSbd: sub.detectedStudentNumber,
      resolvedSbd: sub.resolvedStudentNumber,
      sbdConfidence: sub.studentNumberConfidence !== null ? Number(sub.studentNumberConfidence) : null,
      identityNeedsReview: sub.identityNeedsReview,
      identityReviewReason: sub.identityReviewReason,
      identityReviewedBy: sub.identityReviewedByUser,
      identityReviewedAt: sub.identityReviewedAt,
    },
    examCode: {
      id: sub.examCodeId,
      detectedCode: sub.detectedExamCode,
      code: sub.examCode?.code || sub.detectedExamCode || null,
      confidence: sub.examCodeConfidence !== null ? Number(sub.examCodeConfidence) : null,
    },
    omr: {
      overallStatus: sub.omrOverallStatus,
      templateVersion: sub.templateVersion,
      quality: sub.qualityMetadata,
      timing: sub.timingMetadata,
    },
    grading: {
      status: sub.status,
      finalScore: sub.finalScore !== null ? Number(sub.finalScore) : null,
      provisionalScore: sub.provisionalScore !== null ? Number(sub.provisionalScore) : null,
      correctCount: sub.correctCount,
      incorrectCount: sub.incorrectCount,
      blankCount: sub.blankCount,
      unresolvedCount: sub.unresolvedCount,
      maxScore: Number(sub.maxScoreSnapshot),
      questions: formattedAnswers,
    },
    image: {
      url: `/api/submissions/${sub.id}/image`,
      mimeType: sub.originalImageMimeType,
      sizeBytes: sub.originalImageSizeBytes,
      width: sub.originalImageWidth,
      height: sub.originalImageHeight,
    },
    auditLogs: auditLogs.map((log) => ({
      id: log.id,
      eventType: log.eventType,
      questionNumber: log.questionNumber,
      beforeState: log.beforeState,
      afterState: log.afterState,
      reason: log.reason,
      actor: log.actorUser
        ? {
            id: log.actorUser.id,
            email: log.actorUser.email,
            fullName: log.actorUser.teacher?.fullName || log.actorUser.email,
          }
        : null,
      createdAt: log.createdAt,
    })),
    createdAt: sub.createdAt,
    updatedAt: sub.updatedAt,
    finalizedAt: sub.finalizedAt,
  };
}

/**
 * Creates a persisted exam submission:
 * Validates, deduplicates via SHA-256, runs OMR, stores image and crops,
 * saves submission and 40 answers atomically, and logs SUBMISSION_CREATED audit.
 */
export async function createSubmission({
  examId,
  imageBuffer,
  originalFilename = "sheet.jpg",
  mimeType = "image/jpeg",
  user,
}) {
  const t0 = performance.now();

  // 1. Verify exam access & status
  if (!["TEACHER", "EXAM_BOARD", "ADMIN"].includes(user.role)) {
    throw new AppError("Chỉ giáo viên phụ trách, Ban khảo thí hoặc Quản trị viên mới có quyền chấm bài.", 403, "FORBIDDEN");
  }
  const exam = await assertExamAccess(examId, user);
  await assertExamManageAccess(exam, user);

  if (exam.status !== "PUBLISHED") {
    throw new AppError(
      `Kỳ thi đang ở trạng thái ${exam.status}, không thể chấm bài mới (chỉ chấp nhận PUBLISHED).`,
      400,
      "EXAM_NOT_AVAILABLE_FOR_GRADING"
    );
  }

  // 2. Validate image buffer & compute SHA-256
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new AppError("Dữ liệu ảnh không hợp lệ hoặc bị rỗng.", 400, "IMAGE_FILE_REQUIRED");
  }
  const sha256 = crypto.createHash("sha256").update(imageBuffer).digest("hex");

  // 3. Exact duplicate pre-check for early rejection
  const existingSub = await prisma.examSubmission.findUnique({
    where: {
      examId_originalImageSha256: {
        examId,
        originalImageSha256: sha256,
      },
    },
    select: { id: true },
  });
  if (existingSub) {
    throw new AppError(
      "Ảnh này đã được chấm trước đó cho kỳ thi này.",
      409,
      "DUPLICATE_SUBMISSION_IMAGE",
      { existingSubmissionId: existingSub.id }
    );
  }

  // 4. Load AnswerSheetTemplate
  const template = await prisma.answerSheetTemplate.findFirst({
    where: { examId },
    orderBy: { version: "desc" },
  });
  if (!template) {
    throw new AppError(
      "Chưa có mẫu phiếu trả lời OMR nào được tạo cho kỳ thi này.",
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

  // 5. Call FastAPI OMR analysis
  const omrStart = performance.now();
  const omrData = await analyzeOmrSheet(imageBuffer, template.layoutJson, originalFilename);
  const omrTimeMs = Math.round(performance.now() - omrStart);

  // 6. Verify QR / Template integrity
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

  // 7. Exam code resolution & normalization
  if (!omrData.examCode?.value) {
    throw new AppError(
      "Không thể xác định mã đề thi trên phiếu trả lời.",
      422,
      "OMR_EXAM_CODE_NOT_FOUND"
    );
  }

  const detectedCode = omrData.examCode.value;
  let normalizedDetectedCode;
  try {
    normalizedDetectedCode = normalizeExamCode(detectedCode);
  } catch {
    normalizedDetectedCode = detectedCode;
  }

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

  // 8. Deterministic grading
  const gradingStart = performance.now();
  const grading = evaluateSubmission({
    exam,
    answerKeys: examCode.answerKeys,
    omrAnswers: omrData.answers,
  });
  const gradingTimeMs = Math.round(performance.now() - gradingStart);
  const totalTimeMs = Math.round(performance.now() - t0);

  // 9. Identity observation
  const detectedStudentNumber = omrData.studentNumber?.value || null;
  const candidateStudentNumber = omrData.studentNumber?.candidateValue || null;
  const studentNumberOmrStatus = omrData.studentNumber?.status || "UNKNOWN";
  const identityNeedsReview = !detectedStudentNumber;
  const resolvedStudentNumber = detectedStudentNumber;

  // 10. Sanitized raw OMR snapshot (Zero base64)
  const rawOmrSnapshot = {
    status: omrData.status,
    template: omrData.template,
    quality: omrData.quality,
    studentNumber: {
      value: detectedStudentNumber,
      candidateValue: candidateStudentNumber,
      status: studentNumberOmrStatus,
      confidence: omrData.studentNumber?.confidence || 0,
    },
    examCode: omrData.examCode,
    needsReviewQuestions: omrData.needsReviewQuestions,
  };

  // 11. Storage persistence with private namespace
  const namespace = crypto.randomUUID();
  let savedOriginal = null;
  const cropStorageKeys = new Map();

  try {
    savedOriginal = await saveOriginalSubmissionImage({
      namespace,
      buffer: imageBuffer,
      mimeType,
    });

    for (const ans of (omrData.answers || [])) {
      if (ans.reviewCropDataUrl) {
        const cropKey = await saveReviewCropImage({
          namespace,
          questionNumber: ans.questionNumber,
          base64DataUrl: ans.reviewCropDataUrl,
        });
        if (cropKey) {
          cropStorageKeys.set(ans.questionNumber, cropKey);
        }
      }
    }
  } catch (storageErr) {
    await cleanupSubmissionStorage(namespace);
    throw new AppError(
      `Lỗi khi lưu trữ file bài thi: ${storageErr.message}`,
      500,
      "STORAGE_SAVE_FAILED"
    );
  }

  // 12. Atomic Prisma transaction (with compensation on failure or race condition)
  const keyMap = new Map();
  for (const ak of examCode.answerKeys) {
    keyMap.set(ak.questionNumber, ak);
  }

  let createdSubmission = null;
  let createdAnswers = [];
  let createdAudit = null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 12a. Insert ExamSubmission
      const sub = await tx.examSubmission.create({
        data: {
          examId: exam.id,
          examCodeId: examCode.id,
          answerSheetTemplateId: template.id,
          gradedByUserId: user.id,
          status: grading.status,

          detectedStudentNumber,
          candidateStudentNumber,
          studentNumberOmrStatus,

          resolvedStudentNumber,
          identityNeedsReview,

          originalImageStorageKey: savedOriginal.storageKey,
          originalImageSha256: sha256,
          originalImageMimeType: mimeType,
          originalImageSizeBytes: imageBuffer.length,
          originalImageWidth: omrData.quality?.width || null,
          originalImageHeight: omrData.quality?.height || null,

          omrOverallStatus: omrData.status,
          templateVersion: template.templateVersion,
          qualityMetadata: omrData.quality || undefined,
          timingMetadata: { omrTimeMs, gradingTimeMs, totalTimeMs },
          rawOmrSnapshot,

          questionCountSnapshot: exam.questionCount,
          maxScoreSnapshot: exam.maxScore,
          scoringTypeSnapshot: exam.scoringType,
          examCodeSnapshot: examCode.code,

          correctCount: grading.correctCount,
          incorrectCount: grading.incorrectCount,
          blankCount: grading.blankCount,
          unresolvedCount: grading.unresolvedCount,
          provisionalScore:
            grading.provisionalScore !== null ? new Prisma.Decimal(grading.provisionalScore) : null,
          finalScore: grading.finalScore !== null ? new Prisma.Decimal(grading.finalScore) : null,
          finalizedAt: grading.status === "FINAL" ? new Date() : null,
        },
      });

      // 12b. Insert 40 SubmissionAnswer rows
      const answerInserts = [];
      for (const q of grading.questions) {
        const key = keyMap.get(q.questionNumber);
        if (!key) {
          throw new AppError(
            `Thiếu đáp án chuẩn cho câu ${q.questionNumber} trong mã đề ${examCode.code}.`,
            500,
            "MISSING_ANSWER_KEY_SNAPSHOT"
          );
        }

        let outcome = "UNRESOLVED";
        if (q.omrStatus === "MARKED") {
          outcome = q.isCorrect ? "CORRECT" : "INCORRECT";
        } else if (q.omrStatus === "BLANK") {
          outcome = "BLANK";
        } else {
          outcome = "UNRESOLVED";
        }

        answerInserts.push({
          submissionId: sub.id,
          questionNumber: q.questionNumber,
          detectedAnswer: q.detectedAnswer,
          candidate: q.candidate,
          originalCandidates: q.originalCandidates || (q.candidate ? [q.candidate] : []),
          omrStatus: q.omrStatus,
          confidence: q.confidence,
          fillRatios: q.fillRatios || {},
          reviewCropStorageKey: cropStorageKeys.get(q.questionNumber) || null,

          correctAnswerSnapshot: key.correctAnswer,
          scoreSnapshot: key.score,

          resolvedByTeacher: false,
          teacherResolution: null,
          resolvedAnswer: null,

          effectiveAnswer: q.detectedAnswer,
          result: outcome,
          scoreEarned: q.scoreEarned !== null ? new Prisma.Decimal(q.scoreEarned) : null,
          needsReview: q.needsReview,
        });
      }

      await tx.submissionAnswer.createMany({
        data: answerInserts,
      });

      // 12c. Insert initial SUBMISSION_CREATED audit log
      const audit = await tx.examSubmissionAuditLog.create({
        data: {
          submissionId: sub.id,
          actorUserId: user.id,
          eventType: "SUBMISSION_CREATED",
          afterState: {
            status: grading.status,
            finalScore: grading.finalScore !== null ? String(grading.finalScore) : null,
            provisionalScore:
              grading.provisionalScore !== null ? String(grading.provisionalScore) : null,
            correctCount: grading.correctCount,
            incorrectCount: grading.incorrectCount,
            blankCount: grading.blankCount,
            unresolvedCount: grading.unresolvedCount,
            examCode: examCode.code,
            identityNeedsReview,
          },
        },
      });

      return { sub, audit };
    });

    createdSubmission = result.sub;
    createdAudit = result.audit;
  } catch (dbErr) {
    // Clean up newly created storage files on DB transaction failure
    await cleanupSubmissionStorage(namespace);

    // Race-safe handling of exact duplicate upload (Prisma unique violation P2002)
    if (
      dbErr.code === "P2002" &&
      Array.isArray(dbErr.meta?.target) &&
      dbErr.meta.target.includes("originalImageSha256")
    ) {
      const dup = await prisma.examSubmission.findUnique({
        where: {
          examId_originalImageSha256: {
            examId,
            originalImageSha256: sha256,
          },
        },
        select: { id: true },
      });
      throw new AppError(
        "Ảnh này đã được chấm trước đó cho kỳ thi này.",
        409,
        "DUPLICATE_SUBMISSION_IMAGE",
        { existingSubmissionId: dup?.id }
      );
    }

    throw dbErr;
  }

  // Tự động liên kết học sinh trong lớp với SBD nếu chưa được gán
  const allExamClassIds = [
    ...(exam.classId ? [exam.classId] : []),
    ...(exam.examClasses ? exam.examClasses.map((ec) => ec.classId) : []),
  ];
  if (resolvedStudentNumber && allExamClassIds.length > 0 && !identityNeedsReview) {
    try {
      const existingCandidate = await prisma.examCandidate.findFirst({
        where: { examId, studentNumber: resolvedStudentNumber },
      });
      if (!existingCandidate) {
        const enrollments = await prisma.studentEnrollment.findMany({
          where: { classId: { in: allExamClassIds } },
          include: {
            student: {
              include: { user: { select: { email: true } } },
            },
          },
        });
        const matched = enrollments.map((e) => e.student).find((st) => {
          const code = (st.studentCode || "").trim();
          const emailPrefix = (st.user?.email || "").split("@")[0];
          return (
            code === resolvedStudentNumber ||
            code.endsWith(resolvedStudentNumber) ||
            emailPrefix.includes(resolvedStudentNumber) ||
            (resolvedStudentNumber.length >= 4 && code.includes(resolvedStudentNumber))
          );
        });
        if (matched) {
          const alreadyLinked = await prisma.examCandidate.findUnique({
            where: { examId_studentId: { examId, studentId: matched.id } },
          });
          if (!alreadyLinked) {
            await prisma.examCandidate.create({
              data: {
                examId,
                studentId: matched.id,
                studentNumber: resolvedStudentNumber,
              },
            });
          }
        }
      }
    } catch {
      // Non-blocking auto-link
    }
  }

  // Load created answers to return full response
  createdAnswers = await prisma.submissionAnswer.findMany({
    where: { submissionId: createdSubmission.id },
    orderBy: { questionNumber: "asc" },
  });

  return formatSubmissionResponse(
    {
      ...createdSubmission,
      exam,
      examCode,
    },
    createdAnswers,
    [createdAudit]
  );
}

/**
 * Gets submission detail with answers and audit history.
 */
export async function getSubmissionDetail({ submissionId, user }) {
  const submission = await assertSubmissionAccess(submissionId, user);

  const answers = await prisma.submissionAnswer.findMany({
    where: { submissionId },
    orderBy: { questionNumber: "asc" },
  });

  const auditLogs = await prisma.examSubmissionAuditLog.findMany({
    where: { submissionId },
    include: {
      actorUser: {
        select: {
          id: true,
          email: true,
          teacher: { select: { fullName: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return formatSubmissionResponse(submission, answers, auditLogs);
}

/**
 * Streams original image file for a submission.
 */
export async function getSubmissionImageStream({ submissionId, user }) {
  const submission = await assertSubmissionAccess(submissionId, user);
  const stream = storageService.getFileStream(submission.originalImageStorageKey);
  return {
    stream,
    mimeType: submission.originalImageMimeType,
    size: submission.originalImageSizeBytes,
  };
}

/**
 * Streams review crop image for a specific question.
 */
export async function getSubmissionReviewCropStream({ submissionId, questionNumber, user }) {
  const submission = await assertSubmissionAccess(submissionId, user);

  const answer = await prisma.submissionAnswer.findUnique({
    where: {
      submissionId_questionNumber: {
        submissionId,
        questionNumber: Number(questionNumber),
      },
    },
  });

  if (!answer || !answer.reviewCropStorageKey) {
    throw new AppError(
      `Không tìm thấy ảnh cắt vùng làm bài của câu hỏi ${questionNumber}.`,
      404,
      "SUBMISSION_REVIEW_CROP_NOT_FOUND"
    );
  }

  const stream = storageService.getFileStream(answer.reviewCropStorageKey);
  return {
    stream,
    mimeType: "image/jpeg",
  };
}

// Re-export review functions for full backwards compatibility
export {
  reviewSubmissionAnswers,
  reviewSubmissionIdentity,
} from "./submission-review.service.js";


/**
 * Gets chronological audit history for a submission.
 */
export async function getSubmissionAuditLogs({ submissionId, user }) {
  await assertSubmissionAccess(submissionId, user);

  const logs = await prisma.examSubmissionAuditLog.findMany({
    where: { submissionId },
    include: {
      actorUser: {
        select: {
          id: true,
          email: true,
          teacher: { select: { fullName: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return logs.map((log) => ({
    id: log.id,
    eventType: log.eventType,
    questionNumber: log.questionNumber,
    beforeState: log.beforeState,
    afterState: log.afterState,
    reason: log.reason,
    actor: log.actorUser
      ? {
          id: log.actorUser.id,
          email: log.actorUser.email,
          fullName: log.actorUser.teacher?.fullName || log.actorUser.email,
        }
      : null,
    createdAt: log.createdAt,
  }));
}

/**
 * Xoá một bài nộp và dọn dẹp các tệp ảnh lưu trữ.
 * Chỉ cho phép giáo viên sở hữu kỳ thi hoặc Quản trị viên xoá.
 * Chặn xoá nếu kỳ thi đã công bố kết quả.
 */
export async function deleteSubmission({ submissionId, user }) {
  const submission = await assertSubmissionAccess(submissionId, user);

  // Chặn xoá nếu kết quả đã được công bố
  await assertResultsNotPublished(submission.examId);

  // 1. Dọn dẹp tệp ảnh lưu trữ (ảnh crop câu hỏi và ảnh bài thi gốc)
  try {
    await cleanupSubmissionStorage(submissionId);
  } catch (storageErr) {
    console.warn(`[STORAGE] Cảnh báo dọn dẹp lưu trữ cho bài nộp ${submissionId}:`, storageErr.message);
  }

  // 2. Xoá bản ghi bài nộp trong Database (Cascade tự động dọn SubmissionAnswer và ExamSubmissionAuditLog)
  await prisma.examSubmission.delete({
    where: { id: submissionId },
  });

  return { success: true };
}
