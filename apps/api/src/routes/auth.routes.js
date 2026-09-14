import { Router } from "express";
import {
  loginController,
  meController,
  refreshController,
  logoutController,
  registerTeacherController,
  nextTeacherCodeController,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authLimiter } from "../config/rate-limit.config.js";

const router = Router();

router.get("/next-teacher-code", nextTeacherCodeController);
router.post("/register-teacher", authLimiter, registerTeacherController);
router.post("/login", authLimiter, loginController);
router.get("/me", authenticate, meController);
router.post("/refresh", refreshController);
router.post("/logout", logoutController);

export default router;