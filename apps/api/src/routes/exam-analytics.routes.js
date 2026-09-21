import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { getExamAnalyticsController } from "../controllers/exam-analytics.controller.js";

const router = Router({ mergeParams: true });
const allStaffRoles = [
  authenticate,
  authorizeRoles("SUPER_ADMIN", "TEACHER", "PRINCIPAL", "VICE_PRINCIPAL", "EXAM_OFFICER"),
];

router.get("/:examId/analytics", allStaffRoles, getExamAnalyticsController);

export default router;
