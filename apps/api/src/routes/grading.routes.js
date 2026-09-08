import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { AppError } from "../middlewares/error.middleware.js";
import { gradeImageController } from "../controllers/grading.controller.js";
import { createSubmissionController } from "../controllers/submission.controller.js";

const router = Router({ mergeParams: true });

router.use(authenticate);
const requireTeacher = authorizeRoles("TEACHER");

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

// Stateless regression endpoint
// POST /api/exams/:examId/grade-image
router.post("/:examId/grade-image", requireTeacher, handleImageUpload, gradeImageController);

// Phase 6 Persistent endpoint
// POST /api/exams/:examId/submissions
router.post("/:examId/submissions", requireTeacher, handleImageUpload, createSubmissionController);

export default router;
