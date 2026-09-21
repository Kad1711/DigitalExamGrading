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
  requestPublicationController,
  approvePublicationController,
  rejectPublicationController,
  getPublicationApprovalQueueController,
} from "../controllers/result-publication.controller.js";

const router = Router({ mergeParams: true });

router.use(authenticate);

const oversightRoles = authorizeRoles(
  "TEACHER",
  "EXAM_BOARD",
  "ACADEMIC_BOARD",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "ADMIN"
);
const examBoardOrAdmin = authorizeRoles("EXAM_BOARD", "ADMIN");
const academicBoardOrAdmin = authorizeRoles("ACADEMIC_BOARD", "ADMIN");
const canPublishOrUnpublish = authorizeRoles("TEACHER", "EXAM_BOARD", "ADMIN");

// Approval queue for Academic Board & School Management
router.get("/publication/approval-queue", oversightRoles, getPublicationApprovalQueueController);

// Publication Status & Logs
router.get("/:examId/results/publication", oversightRoles, getPublicationStatusController);
router.get("/:examId/publication", oversightRoles, getPublicationStatusController);

router.get("/:examId/results/publication-logs", oversightRoles, getPublicationLogsController);
router.get("/:examId/publication-logs", oversightRoles, getPublicationLogsController);

// Request publication (Exam Board or Admin)
router.post("/:examId/publication/request", examBoardOrAdmin, requestPublicationController);
router.post("/:examId/results/publication/request", examBoardOrAdmin, requestPublicationController);

// Approve publication (Academic Board or Admin)
router.post("/:examId/publication/approve", academicBoardOrAdmin, approvePublicationController);
router.post("/:examId/results/publication/approve", academicBoardOrAdmin, approvePublicationController);

// Reject publication (Academic Board or Admin)
router.post("/:examId/publication/reject", academicBoardOrAdmin, rejectPublicationController);
router.post("/:examId/results/publication/reject", academicBoardOrAdmin, rejectPublicationController);

// Publish & Unpublish actions
router.post("/:examId/results/publish", canPublishOrUnpublish, publishResultsController);
router.post("/:examId/publication/publish", canPublishOrUnpublish, publishResultsController);

router.post("/:examId/results/unpublish", canPublishOrUnpublish, unpublishResultsController);
router.post("/:examId/publication/unpublish", canPublishOrUnpublish, unpublishResultsController);

// Export results (Excel / CSV)
router.get("/:examId/results/export.xlsx", oversightRoles, exportResultsXlsxController);
router.get("/:examId/results/export.csv", oversightRoles, exportResultsCsvController);

export default router;
