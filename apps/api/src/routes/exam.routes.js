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
  approveAnswerKeyController,
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

const allStaffRoles = authorizeRoles(
  "SUPER_ADMIN",
  "TEACHER",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "EXAM_OFFICER"
);
const examCreators = authorizeRoles("SUPER_ADMIN", "TEACHER", "EXAM_OFFICER");
const adminOnly = authorizeRoles("SUPER_ADMIN");

// Exam CRUD
router.post("/", examCreators, createExamController);
router.get("/", allStaffRoles, listExamsController);
router.post("/bulk-delete", adminOnly, bulkDeleteExamsController);
router.get("/:examId", allStaffRoles, getExamController);
router.patch("/:examId", examCreators, updateExamController);
router.delete("/:examId", examCreators, deleteExamController);
router.post("/:examId/clone", examCreators, cloneExamController);

// Exam lifecycle
router.post("/:examId/publish", examCreators, publishExamController);
router.post("/:examId/close", examCreators, closeExamController);
router.post("/:examId/archive", examCreators, archiveExamController);

// ExamCode
router.post("/:examId/codes", examCreators, createExamCodeController);
router.get("/:examId/codes", allStaffRoles, listExamCodesController);
router.delete("/:examId/codes/:codeId", examCreators, deleteExamCodeController);

// AnswerKey
router.put("/:examId/codes/:codeId/answer-key", examCreators, putAnswerKeyController);
router.get("/:examId/codes/:codeId/answer-key", allStaffRoles, getAnswerKeyController);
router.post("/:examId/answer-key/approve", approveAnswerKeyController);
router.post("/:examId/answer-keys/approve", approveAnswerKeyController);

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