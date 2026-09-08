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
const requireTeacher = [authenticate, authorizeRoles("TEACHER")];

router.get("/:examId/candidates", requireTeacher, listCandidates);
router.get("/:examId/eligible-students", requireTeacher, listEligibleStudents);
router.post("/:examId/candidates", requireTeacher, createCandidate);
router.delete("/:examId/candidates/:candidateId", requireTeacher, deleteCandidate);

export default router;
