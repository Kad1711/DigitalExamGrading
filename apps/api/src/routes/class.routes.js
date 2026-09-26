import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import {
  requireClassStudentManagement,
  requireClassStudentAccess,
} from "../middlewares/class-access.middleware.js";
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
  "SUPER_ADMIN",
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "EXAM_OFFICER",
  "TEACHER"
);

const canManageClasses = authorizeRoles("VICE_PRINCIPAL", "SUPER_ADMIN");

// Class Students Mutations: VICE_PRINCIPAL & SUPER_ADMIN (any class), TEACHER (assigned classes)
const canManageStudents = [
  authorizeRoles("VICE_PRINCIPAL", "SUPER_ADMIN", "TEACHER"),
  requireClassStudentManagement,
];

// Grades
router.get("/grades", canReadClasses, getGrades);

// Classes Read
router.get("/", canReadClasses, getClasses);

// Classes Mutations (VICE_PRINCIPAL primary owner, SUPER_ADMIN fallback)
router.post("/", canManageClasses, createClass);
router.post("/batch", canManageClasses, createBatchClasses);
router.post("/bulk-delete", canManageClasses, bulkDeleteClasses);
router.patch("/:classId", canManageClasses, updateClass);
router.delete("/:classId", canManageClasses, deleteClass);

// Class Students Read
router.get("/:classId/students", requireClassStudentAccess, getClassStudents);

// Class Students Mutations (VICE_PRINCIPAL, SUPER_ADMIN, or TEACHER of assigned class)
router.post("/:classId/students", ...canManageStudents, addStudent);
router.delete("/:classId/students", ...canManageStudents, clearClassStudents);
router.post("/:classId/students/bulk-delete", ...canManageStudents, bulkRemoveStudents);
router.patch("/:classId/students/:studentId", ...canManageStudents, updateStudent);
router.delete("/:classId/students/:studentId", ...canManageStudents, removeStudent);
router.post("/:classId/standardize-sbd", ...canManageStudents, standardizeClassSbd);

// Smart Excel Import
router.post("/:classId/students/import-preview", ...canManageStudents, handleExcelUpload, previewExcelImport);
router.post("/:classId/students/import", ...canManageStudents, handleExcelUpload, executeExcelImport);

export default router;

