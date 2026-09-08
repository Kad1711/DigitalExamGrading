import { Router } from "express";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";
import {
  getStudentResults,
  getStudentResultByExam,
} from "../controllers/student-result.controller.js";

const router = Router();

router.use(authenticate);
router.use(authorizeRoles("STUDENT"));

router.get("/results", getStudentResults);
router.get("/results/:examId", getStudentResultByExam);

export default router;
