import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import { Prisma } from "@prisma/client";
import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import { assertExamAccess, getTeacherProfile } from "./exam.service.js";
import { analyzeOmrSheet } from "./omr-client.service.js";
import { normalizeExamCode } from "../utils/exam-code.js";
import { evaluateSubmission } from "./grading.service.js";
import {
  saveOriginalSubmissionImage,
  saveReviewCropImage,
  cleanupSubmissionStorage,
  storageService,
} from "./storage/storage.service.js";

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

  if (reqUser.role !== "TEACHER") {
    throw new AppError("Chỉ giáo viên sở hữu kỳ thi mới có quyền truy cập bài nộp.", 403, "FORBIDDEN");
  }

  const teacher = await getTeacherProfile(reqUser.id);
  if (submission.exam.teacherId !== teacher.id) {
    throw new AppError("Bạn không có quyền truy cập bài nộp này.", 403, "SUBMISSION_ACCESS_DENIED");
  }

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
    confidence: ans.confidence,
    fillRatios: ans.fillRatios,
    reviewCropUrl: ans.reviewCropStorageKey
      ? `/api/submissions/${sub.id}/answers/${ans.questionNumber}/review-crop`
      : null,
    correctAnswerSnapshot: ans.correctAnswerSnapshot,
    scoreSnapshot: Number(ans.scoreSnapshot),
    resolvedByTeacher: ans.resolvedByTeacher,
    teacherResolution: ans.teacherResolution,
    resolvedAnswer: ans.resolvedAnswer,
    reviewedAt: ans.reviewedAt,
    effectiveAnswer: ans.effectiveAnswer,
    result: ans.result,
    scoreEarned: ans.scoreEarned !== null ? Number(ans.scoreEarned) : null,
    needsReview: ans.needsReview,
  }));

  return {
    id: sub.id,
    status: sub.status,
    exam: {
      id: sub.exam?.id || sub.examId,
      title: sub.exam?.title,
      subject: sub.exam?.subject?.name,
      class: sub.exam?.class?.name,
      questionCount: sub.questionCountSnapshot,
      maxScore: Number(sub.maxScoreSnapshot),
      scoringType: sub.scoringTypeSnapshot,
    },
    examCode: {
      id: sub.examCodeId,
      code: sub.examCodeSnapshot,
    },
    identity: {
      detectedStudentNumber: sub.detectedStudentNumber,
      candidateStudentNumber: sub.candidateStudentNumber,
      studentNumberOmrStatus: sub.studentNumberOmrStatus,
      resolvedStudentNumber: sub.resolvedStudentNumber,
      identityNeedsReview: sub.identityNeedsReview,
      identityReviewedAt: sub.identityReviewedAt,
    },
    image: {
      url: `/api/submissions/${sub.id}/image`,
      mimeType: sub.originalImageMimeType,
      sizeBytes: sub.originalImageSizeBytes,
      width: sub.originalImageWidth,
      height: sub.originalImageHeight,
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
  if (user.role !== "TEACHER") {
    throw new AppError("Chỉ giáo viên sở hữu kỳ thi mới có quyền chấm bài.", 403, "FORBIDDEN");
  }
  const exam = await assertExamAccess(examId, user);
  const teacher = await getTeacherProfile(user.id);
  if (exam.teacherId !== teacher.id) {
    throw new AppError("Bạn không có quyền chấm bài cho kỳ thi này.", 403, "EXAM_ACCESS_DENIED");
  }
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

/**
 * Persistently reviews submission answers, re-grades deterministically using snapshots,
 * and appends audit logs inside a single transaction.
 */
export async function reviewSubmissionAnswers({ submissionId, reviews, user }) {
  const submission = await assertSubmissionAccess(submissionId, user);

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
                Math.round((maxScore / qCount) * 10000) / 10000
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
                Math.round((maxScore / qCount) * 10000) / 10000
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
          // MULTIPLE / UNCERTAIN without resolution
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

      // Update answer row in tx
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
      if (qCount > 0) {
        const rawScore = (correctCount / qCount) * maxScore;
        calculatedScore = Math.round(rawScore * 10000) / 10000;
      }
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

  await prisma.$transaction(async (tx) => {
    await tx.examSubmission.update({
      where: { id: submissionId },
      data: {
        resolvedStudentNumber: cleanSbd,
        identityNeedsReview: false,
        identityReviewedByUserId: user.id,
        identityReviewedAt: new Date(),
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
