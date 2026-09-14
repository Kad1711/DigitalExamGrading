import { Router } from "express";
import {
  loginController,
  meController,
  refreshController,
  logoutController,
  registerTeacherController,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register-teacher", registerTeacherController);
router.post("/login", loginController);
router.get("/me", authenticate, meController);
router.post("/refresh", refreshController);
router.post("/logout", logoutController);

export default router;