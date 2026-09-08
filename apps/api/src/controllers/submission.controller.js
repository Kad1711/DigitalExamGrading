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
} from "../services/submission.service.js";

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
