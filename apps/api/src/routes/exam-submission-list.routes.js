import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import {
  listExamSubmissionsController,
  getExamSubmissionsSummaryController,
} from "../controllers/exam-submission-list.controller.js";

const router = Router({ mergeParams: true });
const canViewSubmissions = [
  authenticate,
  authorizeRoles("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "EXAM_OFFICER", "TEACHER"),
];

// GET /api/exams/:examId/submissions
router.get("/:examId/submissions", canViewSubmissions, listExamSubmissionsController);

// GET /api/exams/:examId/submissions/summary
router.get("/:examId/submissions/summary", canViewSubmissions, getExamSubmissionsSummaryController);

export default router;
