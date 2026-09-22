import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import {
  handleFileUpload,
  getImportTemplateController,
  previewImportController,
  applyImportController,
} from "../controllers/answer-key-import.controller.js";

const router = Router({ mergeParams: true });

router.use(authenticate);
const staffRoles = authorizeRoles("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "EXAM_OFFICER", "TEACHER");

// Template download (xlsx or csv)
router.get("/:examId/answer-key/import-template", staffRoles, getImportTemplateController);

// Preview import (validate without writing to DB)
router.post(
  "/:examId/answer-key/import/preview",
  staffRoles,
  handleFileUpload,
  previewImportController
);

// Apply import (atomic replace in DB)
router.post(
  "/:examId/answer-key/import",
  staffRoles,
  handleFileUpload,
  applyImportController
);

export default router;