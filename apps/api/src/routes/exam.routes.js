import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import {
  createExamController,
  listExamsController,
  getExamController,
  updateExamController,
  deleteExamController,
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

const router = Router();

router.use(authenticate);
const denyStudent = authorizeRoles("ADMIN", "TEACHER");

// Exam CRUD
router.post("/", denyStudent, createExamController);
router.get("/", denyStudent, listExamsController);
router.get("/:examId", denyStudent, getExamController);
router.patch("/:examId", denyStudent, updateExamController);
router.delete("/:examId", denyStudent, deleteExamController);

// Exam lifecycle
router.post("/:examId/publish", denyStudent, publishExamController);
router.post("/:examId/close", denyStudent, closeExamController);
router.post("/:examId/archive", denyStudent, archiveExamController);

// ExamCode
router.post("/:examId/codes", denyStudent, createExamCodeController);
router.get("/:examId/codes", denyStudent, listExamCodesController);
router.delete("/:examId/codes/:codeId", denyStudent, deleteExamCodeController);

// AnswerKey
router.put("/:examId/codes/:codeId/answer-key", denyStudent, putAnswerKeyController);
router.get("/:examId/codes/:codeId/answer-key", denyStudent, getAnswerKeyController);

// Sub-modules: Answer Key Import & OMR Answer Sheet Template
router.use("/", answerKeyImportRoutes);
router.use("/", answerSheetRoutes);

export default router;