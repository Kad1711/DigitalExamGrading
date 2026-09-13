import { Router } from "express";
import authRoutes from "./auth.routes.js";
import adminRoutes from "./admin.routes.js";
import examRoutes from "./exam.routes.js";
import profileRoutes from "./profile.routes.js";
import submissionRoutes from "./submission.routes.js";
import commonRoutes from "./common.routes.js";
import studentResultRoutes from "./student-result.routes.js";
import teacherDashboardRoutes from "./teacher-dashboard.routes.js";
import classRoutes from "./class.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/exams", examRoutes);
router.use("/submissions", submissionRoutes);
router.use("/profile", profileRoutes);
router.use("/student", studentResultRoutes);
router.use("/teacher", teacherDashboardRoutes);
router.use("/classes", classRoutes);
router.use("/", commonRoutes);

export default router;