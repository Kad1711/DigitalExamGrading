import { AppError } from "../middlewares/error.middleware.js";
import { gradeExamImage } from "../services/grading.service.js";

/**
 * POST /api/exams/:examId/grade-image
 *
 * Thin controller: validates basic file presence and delegates
 * the entire orchestration pipeline to grading.service.js.
 */
export async function gradeImageController(req, res, next) {
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

    let reviewOverrides = null;
    if (req.body.reviewOverrides) {
      if (typeof req.body.reviewOverrides === "string") {
        try {
          reviewOverrides = JSON.parse(req.body.reviewOverrides);
        } catch {
          return next(
            new AppError(
              "Định dạng reviewOverrides không hợp lệ (cần là mảng JSON).",
              400,
              "INVALID_REVIEW_OVERRIDES_FORMAT"
            )
          );
        }
      } else if (Array.isArray(req.body.reviewOverrides)) {
        reviewOverrides = req.body.reviewOverrides;
      }
    }

    const result = await gradeExamImage(
      examId,
      req.file.buffer,
      req.file.originalname || "sheet.png",
      req.user,
      reviewOverrides
    );

    return res.status(200).json({
      success: true,
      message: "Chấm bài thi thành công.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
