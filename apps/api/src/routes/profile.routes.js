import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import * as profileController from "../controllers/profile.controller.js";
import { AppError } from "../middlewares/error.middleware.js";

const router = Router();

// 1. Route công khai để trình duyệt tải ảnh đại diện qua thẻ <img>
router.get("/avatar/:filename", profileController.getAvatarController);

// 2. Cấu hình multer cho việc upload ảnh đại diện (Tối đa 5MB)
const storage = multer.memoryStorage();
const uploadAvatar = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    const isImage =
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".png") ||
      name.endsWith(".webp") ||
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/png" ||
      file.mimetype === "image/webp";

    if (isImage) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          "Chỉ chấp nhận file ảnh định dạng .jpg, .jpeg, .png hoặc .webp.",
          400,
          "IMAGE_TYPE_INVALID"
        )
      );
    }
  },
}).single("avatar");

function handleAvatarUpload(req, res, next) {
  uploadAvatar(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new AppError("Dung lượng ảnh vượt quá giới hạn 5MB.", 400, "IMAGE_TOO_LARGE")
          );
        }
        return next(new AppError(`Lỗi tải ảnh: ${err.message}`, 400, "IMAGE_UPLOAD_ERROR"));
      }
      return next(err);
    }
    next();
  });
}

// 3. Toàn bộ các route hồ sơ cá nhân bên dưới cần đăng nhập
router.use(authenticate);
router.use(
  authorizeRoles(
    "SUPER_ADMIN",
    "PRINCIPAL",
    "VICE_PRINCIPAL",
    "EXAM_OFFICER",
    "TEACHER",
    "STUDENT"
  )
);

router.get("/", profileController.getProfileController);
router.patch("/", profileController.updateProfileController);
router.post("/avatar", handleAvatarUpload, profileController.uploadAvatarController);
router.post("/change-password", profileController.changePasswordController);

export default router;
