import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import {
  getSubmissionController,
  getSubmissionImageController,
  getSubmissionReviewCropController,
  reviewSubmissionAnswersController,
  reviewSubmissionIdentityController,
  getSubmissionAuditLogsController,
  deleteSubmissionController,
} from "../controllers/submission.controller.js";

const router = Router();

router.use(authenticate);

const viewSubmissionRoles = authorizeRoles(
  "SUPER_ADMIN",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "EXAM_OFFICER",
  "TEACHER"
);
const mutateSubmissionRoles = authorizeRoles("SUPER_ADMIN", "EXAM_OFFICER", "TEACHER");

// Submission Details & Deletion
router.get("/:submissionId", viewSubmissionRoles, getSubmissionController);
router.delete("/:submissionId", mutateSubmissionRoles, deleteSubmissionController);

// Authenticated image streaming routes
router.get("/:submissionId/image", viewSubmissionRoles, getSubmissionImageController);
router.get(
  "/:submissionId/answers/:questionNumber/review-crop",
  viewSubmissionRoles,
  getSubmissionReviewCropController
);

// Review actions
router.patch("/:submissionId/review", mutateSubmissionRoles, reviewSubmissionAnswersController);
router.patch("/:submissionId/identity", mutateSubmissionRoles, reviewSubmissionIdentityController);

// Audit history
router.get("/:submissionId/audit", viewSubmissionRoles, getSubmissionAuditLogsController);
router.get("/:submissionId/audit-logs", viewSubmissionRoles, getSubmissionAuditLogsController);

export default router;
