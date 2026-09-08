import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import * as profileController from "../controllers/profile.controller.js";

const router = Router();

// Toan bo cac route ho so ca nhan giao vien deu can dang nhap va quyen TEACHER
router.use(authenticate);
router.use(authorizeRoles("TEACHER"));

router.get("/", profileController.getProfileController);
router.patch("/", profileController.updateProfileController);
router.post("/change-password", profileController.changePasswordController);

export default router;
