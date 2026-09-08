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
} from "../controllers/submission.controller.js";

const router = Router();

router.use(authenticate, authorizeRoles("TEACHER"));

// Submission Details
router.get("/:submissionId", getSubmissionController);

// Authenticated image streaming routes
router.get("/:submissionId/image", getSubmissionImageController);
router.get(
  "/:submissionId/answers/:questionNumber/review-crop",
  getSubmissionReviewCropController
);

// Review actions
router.patch("/:submissionId/review", reviewSubmissionAnswersController);
router.patch("/:submissionId/identity", reviewSubmissionIdentityController);

// Audit history
router.get("/:submissionId/audit", getSubmissionAuditLogsController);
router.get("/:submissionId/audit-logs", getSubmissionAuditLogsController);

export default router;
