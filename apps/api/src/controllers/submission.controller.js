import { AppError } from "../middlewares/error.middleware.js";
import {
  reviewAnswersSchema,
  reviewIdentitySchema,
} from "../schemas/submission.schema.js";
import {
  createSubmission,
  getSubmissionDetail,
  getSubmissionImageStream,
  getSubmissionReviewCropStream,
  reviewSubmissionAnswers,
  reviewSubmissionIdentity,
  getSubmissionAuditLogs,
  deleteSubmission,
} from "../services/submission.service.js";
import { validateImageBuffer, validateImageFile } from "../utils/image-validation.js";
import { BATCH_MAX_TOTAL_BYTES } from "../config/batch-upload.config.js";
import { cleanupStagedBatch } from "../services/storage/storage.service.js";

/**
 * POST /api/exams/:examId/submissions
 */
export async function createSubmissionController(req, res, next) {
  try {
    const { examId } = req.params;
    if (!examId) {
      return next(new AppError("Thiếu mã kỳ thi (examId).", 400, "EXAM_ID_REQUIRED"));
    }

    if (!req.file || !req.file.buffer) {
      return next(
        new AppError(
          "Vui lòng tải lên file ảnh bài thi (.jpg, .jpeg, .png).",
          400,
          "IMAGE_FILE_REQUIRED"
        )
      );
    }

    // Binary magic bytes validation (FINDING-005)
    const imgValidation = validateImageBuffer(req.file.buffer);
    if (!imgValidation.valid) {
      return next(
        new AppError(
          imgValidation.error || "File ảnh không hợp lệ.",
          400,
          "IMAGE_INVALID_BINARY"
        )
      );
    }

    const result = await createSubmission({
      examId,
      imageBuffer: req.file.buffer,
      originalFilename: req.file.originalname || "sheet.jpg",
      mimeType: req.file.mimetype || "image/jpeg",
      user: req.user,
    });

    return res.status(201).json({
      success: true,
      message: "Chấm và lưu bài thi thành công.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/submissions/:submissionId
 */
export async function getSubmissionController(req, res, next) {
  try {
    const { submissionId } = req.params;
    const result = await getSubmissionDetail({ submissionId, user: req.user });
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/submissions/:submissionId/image
 */
export async function getSubmissionImageController(req, res, next) {
  try {
    const { submissionId } = req.params;
    const { stream, mimeType, size } = await getSubmissionImageStream({
      submissionId,
      user: req.user,
    });

    res.setHeader("Content-Type", mimeType || "image/jpeg");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    if (size) {
      res.setHeader("Content-Length", size);
    }

    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/submissions/:submissionId/answers/:questionNumber/review-crop
 */
export async function getSubmissionReviewCropController(req, res, next) {
  try {
    const { submissionId, questionNumber } = req.params;
    const { stream, mimeType } = await getSubmissionReviewCropStream({
      submissionId,
      questionNumber,
      user: req.user,
    });

    res.setHeader("Content-Type", mimeType || "image/jpeg");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");

    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/submissions/:submissionId/review
 */
export async function reviewSubmissionAnswersController(req, res, next) {
  try {
    const { submissionId } = req.params;
    const parsed = reviewAnswersSchema.parse(req.body);

    const result = await reviewSubmissionAnswers({
      submissionId,
      reviews: parsed.reviews,
      user: req.user,
    });

    return res.status(200).json({
      success: true,
      message: "Cập nhật kết quả duyệt bài thành công.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/submissions/:submissionId/identity
 */
export async function reviewSubmissionIdentityController(req, res, next) {
  try {
    const { submissionId } = req.params;
    const parsed = reviewIdentitySchema.parse(req.body);

    const result = await reviewSubmissionIdentity({
      submissionId,
      studentNumber: parsed.studentNumber,
      user: req.user,
    });

    return res.status(200).json({
      success: true,
      message: "Cập nhật số báo danh thành công.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/submissions/:submissionId/audit
 */
export async function getSubmissionAuditLogsController(req, res, next) {
  try {
    const { submissionId } = req.params;
    const result = await getSubmissionAuditLogs({ submissionId, user: req.user });
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/exams/:examId/submissions/batch
 * Enqueues up to 50 exam sheets for asynchronous batch grading with BullMQ
 */
export async function createBatchSubmissionController(req, res, next) {
  try {
    const { examId } = req.params;
    if (!examId) {
      if (req.stagingBatchId) {
        await cleanupStagedBatch(req.stagingBatchId);
      }
      return next(new AppError("Thiếu mã kỳ thi (examId).", 400, "EXAM_ID_REQUIRED"));
    }

    if (!req.files || req.files.length === 0) {
      if (req.stagingBatchId) {
        await cleanupStagedBatch(req.stagingBatchId);
      }
      return next(
        new AppError(
          "Vui lòng tải lên ít nhất một file ảnh bài thi (tối đa 50 file).",
          400,
          "NO_FILES_UPLOADED"
        )
      );
    }

    // 1. Enforce aggregate batch size limit (FINDING-005)
    let totalBatchBytes = 0;
    for (const file of req.files) {
      totalBatchBytes += file.size || 0;
    }
    if (totalBatchBytes > BATCH_MAX_TOTAL_BYTES) {
      if (req.stagingBatchId) {
        await cleanupStagedBatch(req.stagingBatchId);
      }
      const mbTotal = Math.round(totalBatchBytes / (1024 * 1024));
      const mbMax = Math.round(BATCH_MAX_TOTAL_BYTES / (1024 * 1024));
      return next(
        new AppError(
          `Tổng dung lượng đợt tải lên (${mbTotal}MB) vượt quá giới hạn tối đa (${mbMax}MB).`,
          400,
          "BATCH_SIZE_EXCEEDED"
        )
      );
    }

    // 2. Validate binary magic bytes of each staged file on disk (FINDING-005)
    for (const file of req.files) {
      const validation = await validateImageFile(file.path);
      if (!validation.valid) {
        if (req.stagingBatchId) {
          await cleanupStagedBatch(req.stagingBatchId);
        }
        return next(
          new AppError(
            `File '${file.originalname}' không hợp lệ: ${validation.error}`,
            400,
            "IMAGE_INVALID_BINARY"
          )
        );
      }
    }

    // 3. Enqueue into BullMQ with storage references only
    const { enqueueBatchGrading } = await import("../queue/grading.queue.js");
    const { batchId, total } = await enqueueBatchGrading({
      examId,
      user: req.user,
      files: req.files,
      batchId: req.stagingBatchId,
    });

    return res.status(202).json({
      success: true,
      message: `Đã tiếp nhận ${total} bài thi vào hàng đợi chấm tự động.`,
      data: {
        batchId,
        total,
        statusUrl: `/api/exams/${examId}/batches/${batchId}`,
      },
    });
  } catch (err) {
    if (req.stagingBatchId) {
      await cleanupStagedBatch(req.stagingBatchId).catch(() => {});
    }
    next(err);
  }
}

/**
 * GET /api/exams/:examId/batches/:batchId
 * Returns current processing status, progress percentage, and individual results
 */
export async function getBatchStatusController(req, res, next) {
  try {
    const { batchId } = req.params;
    if (!batchId) {
      return next(new AppError("Thiếu mã đợt chấm (batchId).", 400, "BATCH_ID_REQUIRED"));
    }

    const { getBatchRecord } = await import("../queue/grading.queue.js");
    const record = await getBatchRecord(batchId);

    if (!record) {
      return next(new AppError("Không tìm thấy thông tin đợt chấm.", 404, "BATCH_NOT_FOUND"));
    }

    const completed = record.completed || 0;
    const failed = record.failed || 0;
    const total = record.total || 1;
    const progressPercent = Math.min(100, Math.round(((completed + failed) / total) * 100));

    return res.status(200).json({
      success: true,
      data: {
        ...record,
        progressPercent,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/submissions/:submissionId
 */
export async function deleteSubmissionController(req, res, next) {
  try {
    const { submissionId } = req.params;
    await deleteSubmission({
      submissionId,
      user: req.user,
    });
    return res.status(200).json({
      success: true,
      message: "Xoá bài nộp thành công.",
    });
  } catch (err) {
    next(err);
  }
}

