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
const staffRoles = authorizeRoles("SUPER_ADMIN", "TEACHER", "EXAM_OFFICER", "PRINCIPAL", "VICE_PRINCIPAL");

// Create / regenerate template (DRAFT only)
router.post("/:examId/answer-sheet-template", staffRoles, createTemplateController);

// Get latest template metadata
router.get("/:examId/answer-sheet-template", staffRoles, getLatestTemplateController);

// Get full layoutJson
router.get("/:examId/answer-sheet-template/layout", staffRoles, getTemplateLayoutController);

// Download vector PDF
router.get("/:examId/answer-sheet-template/pdf", staffRoles, downloadTemplatePdfController);

export default router;