import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import {
  publishResultsController,
  unpublishResultsController,
  getPublicationStatusController,
  getPublicationLogsController,
  exportResultsXlsxController,
  exportResultsCsvController,
} from "../controllers/result-publication.controller.js";

const router = Router({ mergeParams: true });
const requireTeacherOrAdmin = [authenticate, authorizeRoles("TEACHER", "ADMIN")];

// GET  /api/exams/:examId/results/publication
router.get("/:examId/results/publication", requireTeacherOrAdmin, getPublicationStatusController);

// GET  /api/exams/:examId/results/publication-logs
router.get("/:examId/results/publication-logs", requireTeacherOrAdmin, getPublicationLogsController);

// POST /api/exams/:examId/results/publish
router.post("/:examId/results/publish", requireTeacherOrAdmin, publishResultsController);

// POST /api/exams/:examId/results/unpublish
router.post("/:examId/results/unpublish", requireTeacherOrAdmin, unpublishResultsController);

// GET  /api/exams/:examId/results/export.xlsx
router.get("/:examId/results/export.xlsx", requireTeacherOrAdmin, exportResultsXlsxController);

// GET  /api/exams/:examId/results/export.csv
router.get("/:examId/results/export.csv", requireTeacherOrAdmin, exportResultsCsvController);

export default router;
