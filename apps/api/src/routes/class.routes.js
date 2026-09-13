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

// Protect all class & student management routes for TEACHER and ADMIN
router.use(authenticate);
const requireTeacherOrAdmin = authorizeRoles("TEACHER", "ADMIN");
router.use(requireTeacherOrAdmin);

// Grades
router.get("/grades", getGrades);

// Classes CRUD
router.get("/", getClasses);
router.post("/", createClass);
router.post("/batch", createBatchClasses);
router.post("/bulk-delete", bulkDeleteClasses);
router.patch("/:classId", updateClass);
router.delete("/:classId", deleteClass);

// Class Students Management
router.get("/:classId/students", getClassStudents);
router.post("/:classId/students", addStudent);
router.delete("/:classId/students", clearClassStudents);
router.post("/:classId/students/bulk-delete", bulkRemoveStudents);
router.patch("/:classId/students/:studentId", updateStudent);
router.delete("/:classId/students/:studentId", removeStudent);
router.post("/:classId/standardize-sbd", standardizeClassSbd);

// Smart Excel Import
router.post("/:classId/students/import-preview", handleExcelUpload, previewExcelImport);
router.post("/:classId/students/import", handleExcelUpload, executeExcelImport);

export default router;

