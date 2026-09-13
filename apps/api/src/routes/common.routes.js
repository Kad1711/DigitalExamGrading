import { Router } from "express";
import prisma from "../config/prisma.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticate);
const denyStudent = authorizeRoles("ADMIN", "TEACHER");

/**
 * GET /api/subjects
 * Minimal read-only endpoint returning subjects for exam setup dropdowns.
 */
router.get("/subjects", denyStudent, async (req, res, next) => {
  try {
    const subjects = await prisma.subject.findMany({
      select: { id: true, code: true, name: true, description: true },
      orderBy: { name: "asc" },
    });
    return res.status(200).json({ success: true, data: subjects });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/classes
 * Minimal read-only endpoint returning classes for exam setup dropdowns.
 */
router.get("/classes", denyStudent, async (req, res, next) => {
  try {
    const classes = await prisma.class.findMany({
      select: {
        id: true,
        name: true,
        grade: { select: { level: true, name: true } },
        academicYear: { select: { name: true } },
      },
      orderBy: [{ grade: { level: "asc" } }, { name: "asc" }],
    });
    return res.status(200).json({ success: true, data: classes });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/grades
 * Minimal read-only endpoint returning grades for class setup dropdowns.
 */
router.get("/grades", denyStudent, async (req, res, next) => {
  try {
    const grades = await prisma.grade.findMany({
      select: { id: true, level: true, name: true },
      orderBy: { level: "asc" },
    });
    return res.status(200).json({ success: true, data: grades });
  } catch (err) {
    next(err);
  }
});

export default router;
