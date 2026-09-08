import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { getExamAnalyticsController } from "../controllers/exam-analytics.controller.js";

const router = Router({ mergeParams: true });
const requireTeacher = [authenticate, authorizeRoles("TEACHER")];

router.get("/:examId/analytics", requireTeacher, getExamAnalyticsController);

export default router;
