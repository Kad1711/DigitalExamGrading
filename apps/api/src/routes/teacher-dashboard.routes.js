import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { getTeacherDashboardController } from "../controllers/teacher-dashboard.controller.js";

const router = Router();
const requireTeacher = [authenticate, authorizeRoles("TEACHER")];

router.get("/dashboard", requireTeacher, getTeacherDashboardController);

export default router;
