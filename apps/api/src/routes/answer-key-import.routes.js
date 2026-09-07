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
const denyStudent = authorizeRoles("ADMIN", "TEACHER");

// Template download (xlsx or csv)
router.get("/:examId/answer-key/import-template", denyStudent, getImportTemplateController);

// Preview import (validate without writing to DB)
router.post(
  "/:examId/answer-key/import/preview",
  denyStudent,
  handleFileUpload,
  previewImportController
);

// Apply import (atomic replace in DB)
router.post(
  "/:examId/answer-key/import",
  denyStudent,
  handleFileUpload,
  applyImportController
);

export default router;