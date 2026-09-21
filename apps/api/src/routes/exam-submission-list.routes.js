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
  authorizeRoles("TEACHER", "EXAM_BOARD", "ACADEMIC_BOARD", "PRINCIPAL", "VICE_PRINCIPAL", "ADMIN"),
];

// GET /api/exams/:examId/submissions
router.get("/:examId/submissions", canViewSubmissions, listExamSubmissionsController);

// GET /api/exams/:examId/submissions/summary
router.get("/:examId/submissions/summary", canViewSubmissions, getExamSubmissionsSummaryController);

export default router;
