import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import {
  createExamController,
  listExamsController,
  getExamController,
  updateExamController,
  deleteExamController,
  bulkDeleteExamsController,
  cloneExamController,
  publishExamController,
  closeExamController,
  archiveExamController,
  createExamCodeController,
  listExamCodesController,
  deleteExamCodeController,
  putAnswerKeyController,
  getAnswerKeyController,
} from "../controllers/exam.controller.js";
import answerKeyImportRoutes from "./answer-key-import.routes.js";
import answerSheetRoutes from "./answer-sheet.routes.js";
import gradingRoutes from "./grading.routes.js";
import examSubmissionListRoutes from "./exam-submission-list.routes.js";
import resultPublicationRoutes from "./result-publication.routes.js";
import examCandidateRoutes from "./exam-candidate.routes.js";
import examAnalyticsRoutes from "./exam-analytics.routes.js";

const router = Router();

router.use(authenticate);
const denyStudent = authorizeRoles("ADMIN", "TEACHER");
const adminOnly = authorizeRoles("ADMIN");

// Exam CRUD
router.post("/", adminOnly, createExamController);
router.get("/", denyStudent, listExamsController);
router.post("/bulk-delete", adminOnly, bulkDeleteExamsController);
router.get("/:examId", denyStudent, getExamController);
router.patch("/:examId", adminOnly, updateExamController);
router.delete("/:examId", adminOnly, deleteExamController);
router.post("/:examId/clone", adminOnly, cloneExamController);

// Exam lifecycle
router.post("/:examId/publish", adminOnly, publishExamController);
router.post("/:examId/close", adminOnly, closeExamController);
router.post("/:examId/archive", adminOnly, archiveExamController);

// ExamCode
router.post("/:examId/codes", adminOnly, createExamCodeController);
router.get("/:examId/codes", denyStudent, listExamCodesController);
router.delete("/:examId/codes/:codeId", adminOnly, deleteExamCodeController);

// AnswerKey
router.put("/:examId/codes/:codeId/answer-key", adminOnly, putAnswerKeyController);
router.get("/:examId/codes/:codeId/answer-key", denyStudent, getAnswerKeyController);

// Sub-modules: Answer Key Import, OMR Answer Sheet Template, & Grading
router.use("/", answerKeyImportRoutes);
router.use("/", answerSheetRoutes);
router.use("/", gradingRoutes);

// Phase 7: Submission Management
router.use("/", examSubmissionListRoutes);

// Phase 8: Result Publication & Export
router.use("/", resultPublicationRoutes);

// Phase 9: Candidate Management
router.use("/", examCandidateRoutes);

// Phase 10: Exam Analytics
router.use("/", examAnalyticsRoutes);

export default router;