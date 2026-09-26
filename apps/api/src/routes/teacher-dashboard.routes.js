import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import {
  getTeacherDashboardController,
  getTeacherTeachingAssignmentsController,
  getTeacherClassStatisticsController,
} from "../controllers/teacher-dashboard.controller.js";

const router = Router();
const requireTeacherOrAdmin = [authenticate, authorizeRoles("TEACHER", "SUPER_ADMIN")];

router.get("/dashboard", requireTeacherOrAdmin, getTeacherDashboardController);
router.get("/assignments", requireTeacherOrAdmin, getTeacherTeachingAssignmentsController);
router.get("/class-statistics", requireTeacherOrAdmin, getTeacherClassStatisticsController);

export default router;
