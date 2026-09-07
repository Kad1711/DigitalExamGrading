import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import {
  createTemplateController,
  getLatestTemplateController,
  getTemplateLayoutController,
  downloadTemplatePdfController,
} from "../controllers/answer-sheet.controller.js";

const router = Router({ mergeParams: true });

router.use(authenticate);
const denyStudent = authorizeRoles("ADMIN", "TEACHER");

// Create / regenerate template (DRAFT only)
router.post("/:examId/answer-sheet-template", denyStudent, createTemplateController);

// Get latest template metadata
router.get("/:examId/answer-sheet-template", denyStudent, getLatestTemplateController);

// Get full layoutJson
router.get("/:examId/answer-sheet-template/layout", denyStudent, getTemplateLayoutController);

// Download vector PDF
router.get("/:examId/answer-sheet-template/pdf", denyStudent, downloadTemplatePdfController);

export default router;