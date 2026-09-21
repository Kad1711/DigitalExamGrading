import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import {
  listCandidates,
  listEligibleStudents,
  createCandidate,
  deleteCandidate,
  autoAssignCandidatesController,
} from "../controllers/exam-candidate.controller.js";

const router = Router({ mergeParams: true });
const viewCandidatesRoles = [
  authenticate,
  authorizeRoles("ADMIN", "TEACHER", "PRINCIPAL", "VICE_PRINCIPAL", "EXAM_BOARD", "ACADEMIC_BOARD"),
];
const mutateCandidatesRoles = [
  authenticate,
  authorizeRoles("ADMIN", "TEACHER", "EXAM_BOARD"),
];

router.get("/:examId/candidates", viewCandidatesRoles, listCandidates);
router.get("/:examId/eligible-students", viewCandidatesRoles, listEligibleStudents);
router.post("/:examId/candidates", mutateCandidatesRoles, createCandidate);
router.post("/:examId/candidates/auto-assign", mutateCandidatesRoles, autoAssignCandidatesController);
router.delete("/:examId/candidates/:candidateId", mutateCandidatesRoles, deleteCandidate);

export default router;
