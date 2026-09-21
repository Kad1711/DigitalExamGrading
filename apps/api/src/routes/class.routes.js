import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import {
  getGrades,
  getClasses,
  createClass,
  createBatchClasses,
  updateClass,
  deleteClass,
  bulkDeleteClasses,
  getClassStudents,
  addStudent,
  updateStudent,
  removeStudent,
  clearClassStudents,
  bulkRemoveStudents,
  handleExcelUpload,
  previewExcelImport,
  executeExcelImport,
  standardizeClassSbd,
} from "../controllers/class.controller.js";

const router = Router();

// Protect all class & student routes with authentication
router.use(authenticate);

const canReadClasses = authorizeRoles(
  "ADMIN",
  "ACADEMIC_BOARD",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "EXAM_BOARD",
  "TEACHER"
);

const canManageClasses = authorizeRoles("ACADEMIC_BOARD", "ADMIN");

// Grades
router.get("/grades", canReadClasses, getGrades);

// Classes Read
router.get("/", canReadClasses, getClasses);

// Classes Mutations (ACADEMIC_BOARD primary owner, ADMIN fallback)
router.post("/", canManageClasses, createClass);
router.post("/batch", canManageClasses, createBatchClasses);
router.post("/bulk-delete", canManageClasses, bulkDeleteClasses);
router.patch("/:classId", canManageClasses, updateClass);
router.delete("/:classId", canManageClasses, deleteClass);

// Class Students Read
router.get("/:classId/students", canReadClasses, getClassStudents);

// Class Students Mutations (ACADEMIC_BOARD primary owner, ADMIN fallback)
router.post("/:classId/students", canManageClasses, addStudent);
router.delete("/:classId/students", canManageClasses, clearClassStudents);
router.post("/:classId/students/bulk-delete", canManageClasses, bulkRemoveStudents);
router.patch("/:classId/students/:studentId", canManageClasses, updateStudent);
router.delete("/:classId/students/:studentId", canManageClasses, removeStudent);
router.post("/:classId/standardize-sbd", canManageClasses, standardizeClassSbd);

// Smart Excel Import
router.post("/:classId/students/import-preview", canManageClasses, handleExcelUpload, previewExcelImport);
router.post("/:classId/students/import", canManageClasses, handleExcelUpload, executeExcelImport);

export default router;

