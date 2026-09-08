import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import {
  listExamSubmissionsController,
  getExamSubmissionsSummaryController,
} from "../controllers/exam-submission-list.controller.js";

const router = Router({ mergeParams: true });
const requireTeacher = [authenticate, authorizeRoles("TEACHER")];

// GET /api/exams/:examId/submissions
router.get("/:examId/submissions", requireTeacher, listExamSubmissionsController);

// GET /api/exams/:examId/submissions/summary
router.get("/:examId/submissions/summary", requireTeacher, getExamSubmissionsSummaryController);

export default router;
