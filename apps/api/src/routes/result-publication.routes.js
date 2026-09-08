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
const requireTeacher = [authenticate, authorizeRoles("TEACHER")];

// GET  /api/exams/:examId/results/publication
router.get("/:examId/results/publication", requireTeacher, getPublicationStatusController);

// GET  /api/exams/:examId/results/publication-logs
router.get("/:examId/results/publication-logs", requireTeacher, getPublicationLogsController);

// POST /api/exams/:examId/results/publish
router.post("/:examId/results/publish", requireTeacher, publishResultsController);

// POST /api/exams/:examId/results/unpublish
router.post("/:examId/results/unpublish", requireTeacher, unpublishResultsController);

// GET  /api/exams/:examId/results/export.xlsx
router.get("/:examId/results/export.xlsx", requireTeacher, exportResultsXlsxController);

// GET  /api/exams/:examId/results/export.csv
router.get("/:examId/results/export.csv", requireTeacher, exportResultsCsvController);

export default router;
