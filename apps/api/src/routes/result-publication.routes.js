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
  principalApprovePublicationController,
  principalRejectPublicationController,
  getPublicationApprovalQueueController,
} from "../controllers/result-publication.controller.js";

const router = Router({ mergeParams: true });

router.use(authenticate);

const oversightRoles = authorizeRoles(
  "SUPER_ADMIN",
  "TEACHER",
  "EXAM_OFFICER",
  "PRINCIPAL",
  "VICE_PRINCIPAL"
);
const examOfficerOrAdmin = authorizeRoles("SUPER_ADMIN", "EXAM_OFFICER");
const vicePrincipalOnly = authorizeRoles("VICE_PRINCIPAL");
const principalOnly = authorizeRoles("PRINCIPAL");
const canPublishOrUnpublish = authorizeRoles("SUPER_ADMIN", "TEACHER", "EXAM_OFFICER", "PRINCIPAL", "VICE_PRINCIPAL");

// Approval queue for Vice Principal, Principal & School Management
router.get("/publication/approval-queue", oversightRoles, getPublicationApprovalQueueController);

// Publication Status & Logs
router.get("/:examId/results/publication", oversightRoles, getPublicationStatusController);
router.get("/:examId/publication", oversightRoles, getPublicationStatusController);

router.get("/:examId/results/publication-logs", oversightRoles, getPublicationLogsController);
router.get("/:examId/publication-logs", oversightRoles, getPublicationLogsController);

// Request publication (Exam Officer or Admin)
router.post("/:examId/publication/request", examOfficerOrAdmin, requestPublicationController);
router.post("/:examId/results/publication/request", examOfficerOrAdmin, requestPublicationController);

// Approve publication (Vice Principal)
router.post("/:examId/publication/approve", vicePrincipalOnly, approvePublicationController);
router.post("/:examId/results/publication/approve", vicePrincipalOnly, approvePublicationController);

// Reject publication (Vice Principal)
router.post("/:examId/publication/reject", vicePrincipalOnly, rejectPublicationController);
router.post("/:examId/results/publication/reject", vicePrincipalOnly, rejectPublicationController);

// Principal Final Approval for FINAL (Principal)
router.post("/:examId/publication/principal-approve", principalOnly, principalApprovePublicationController);
router.post("/:examId/results/publication/principal-approve", principalOnly, principalApprovePublicationController);

// Principal Rejection for MIDTERM / FINAL (Principal)
router.post("/:examId/publication/principal-reject", principalOnly, principalRejectPublicationController);
router.post("/:examId/results/publication/principal-reject", principalOnly, principalRejectPublicationController);

// Publish & Unpublish actions
router.post("/:examId/results/publish", canPublishOrUnpublish, publishResultsController);
router.post("/:examId/publication/publish", canPublishOrUnpublish, publishResultsController);

router.post("/:examId/results/unpublish", canPublishOrUnpublish, unpublishResultsController);
router.post("/:examId/publication/unpublish", canPublishOrUnpublish, unpublishResultsController);

// Export results (Excel / CSV)
router.get("/:examId/results/export.xlsx", oversightRoles, exportResultsXlsxController);
router.get("/:examId/results/export.csv", oversightRoles, exportResultsCsvController);

export default router;
