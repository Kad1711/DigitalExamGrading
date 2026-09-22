import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { AppError } from "../middlewares/error.middleware.js";
import { gradeImageController } from "../controllers/grading.controller.js";
import { createSubmissionController } from "../controllers/submission.controller.js";
import { gradingUploadLimiter } from "../config/rate-limit.config.js";

const router = Router({ mergeParams: true });

router.use(authenticate);
const canGrade = authorizeRoles("TEACHER", "EXAM_OFFICER", "SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL");

const storage = multer.memoryStorage();
export const uploadImage = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
  },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    const isImage =
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".png") ||
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/png";

    if (isImage) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          "Chỉ chấp nhận file ảnh định dạng .jpg, .jpeg, hoặc .png.",
          400,
          "IMAGE_TYPE_INVALID"
        )
      );
    }
  },
}).single("image");

export function handleImageUpload(req, res, next) {
  uploadImage(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new AppError(
              "Dung lượng ảnh vượt quá giới hạn 15MB.",
              400,
              "IMAGE_TOO_LARGE"
            )
          );
        }
        return next(
          new AppError(`Lỗi tải ảnh lên: ${err.message}`, 400, "FILE_UPLOAD_ERROR")
        );
      }
      return next(err);
    }
    next();
  });
}

export const uploadBatchImages = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB per file
    files: 50, // Max 50 files per batch
  },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    const isImage =
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".png") ||
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/png";

    if (isImage) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          "Chỉ chấp nhận file ảnh định dạng .jpg, .jpeg, hoặc .png.",
          400,
          "IMAGE_TYPE_INVALID"
        )
      );
    }
  },
}).array("images", 50);

export function handleBatchImageUpload(req, res, next) {
  uploadBatchImages(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new AppError("Có file vượt quá giới hạn 15MB.", 400, "IMAGE_TOO_LARGE")
          );
        }
        if (err.code === "LIMIT_FILE_COUNT") {
          return next(
            new AppError("Chỉ được tải lên tối đa 50 file mỗi lần.", 400, "TOO_MANY_FILES")
          );
        }
        return next(
          new AppError(`Lỗi tải ảnh lên: ${err.message}`, 400, "FILE_UPLOAD_ERROR")
        );
      }
      return next(err);
    }
    next();
  });
}

// Stateless regression endpoint
// POST /api/exams/:examId/grade-image
router.post("/:examId/grade-image", canGrade, handleImageUpload, gradeImageController);

// Phase 6 Persistent endpoint
// POST /api/exams/:examId/submissions
router.post("/:examId/submissions", canGrade, gradingUploadLimiter, handleImageUpload, createSubmissionController);

// BullMQ Batch Queue endpoint
// POST /api/exams/:examId/submissions/batch
router.post(
  "/:examId/submissions/batch",
  canGrade,
  handleBatchImageUpload,
  async (req, res, next) => {
    const { createBatchSubmissionController } = await import(
      "../controllers/submission.controller.js"
    );
    return createBatchSubmissionController(req, res, next);
  }
);

// Batch status polling endpoint
// GET /api/exams/:examId/batches/:batchId
router.get(
  "/:examId/batches/:batchId",
  canGrade,
  async (req, res, next) => {
    const { getBatchStatusController } = await import(
      "../controllers/submission.controller.js"
    );
    return getBatchStatusController(req, res, next);
  }
);

export default router;

