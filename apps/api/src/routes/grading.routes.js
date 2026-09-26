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

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { storageService, cleanupStagedBatch } from "../services/storage/storage.service.js";
import { checkRedisHealth } from "../config/redis.config.js";
import {
  BATCH_MAX_FILES,
  BATCH_MAX_FILE_BYTES,
} from "../config/batch-upload.config.js";

const batchStagingStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      if (!req.stagingBatchId) {
        req.stagingBatchId = `batch_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      }
      const stagingDir = path.join(storageService.getStorageRoot(), "staging", req.stagingBatchId);
      await fs.promises.mkdir(stagingDir, { recursive: true });
      cb(null, stagingDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const unique = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`;
    cb(null, unique);
  },
});

export const uploadBatchImages = multer({
  storage: batchStagingStorage,
  limits: {
    fileSize: BATCH_MAX_FILE_BYTES,
    files: BATCH_MAX_FILES,
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
}).array("images", BATCH_MAX_FILES);

export async function handleBatchImageUpload(req, res, next) {
  // Pre-upload check: verify Redis is available BEFORE accepting or staging large files (FINDING-003)
  const isHealthy = await checkRedisHealth();
  if (!isHealthy) {
    return next(
      new AppError(
        "Hệ thống hàng đợi chấm thi tự động (Redis) không khả dụng. Vui lòng thử lại sau.",
        503,
        "GRADING_QUEUE_UNAVAILABLE"
      )
    );
  }

  uploadBatchImages(req, res, async (err) => {
    if (err) {
      if (req.stagingBatchId) {
        await cleanupStagedBatch(req.stagingBatchId).catch(() => {});
      }
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

