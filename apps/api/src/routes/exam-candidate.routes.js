import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import {
  listCandidates,
  listEligibleStudents,
  createCandidate,
  deleteCandidate,
} from "../controllers/exam-candidate.controller.js";

const router = Router({ mergeParams: true });
const requireTeacherOrAdmin = [authenticate, authorizeRoles("TEACHER", "ADMIN")];

router.get("/:examId/candidates", requireTeacherOrAdmin, listCandidates);
router.get("/:examId/eligible-students", requireTeacherOrAdmin, listEligibleStudents);
router.post("/:examId/candidates", requireTeacherOrAdmin, createCandidate);
router.delete("/:examId/candidates/:candidateId", requireTeacherOrAdmin, deleteCandidate);

export default router;
