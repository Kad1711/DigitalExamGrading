import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import * as adminTeacherController from "../controllers/admin-teacher.controller.js";
import * as adminDashboardController from "../controllers/admin-dashboard.controller.js";
import * as adminManagementController from "../controllers/admin-management.controller.js";

const router = Router();

// Toan bo routes cua admin deu can dang nhap
router.use(authenticate);

const adminOnly = authorizeRoles("SUPER_ADMIN");
const canViewOversight = authorizeRoles("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL");
const canManageTeacherProfessional = authorizeRoles("SUPER_ADMIN", "VICE_PRINCIPAL");
const canViewTeachers = authorizeRoles("SUPER_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL");

/**
 * GET /api/admin/test
 * Chi SUPER_ADMIN truy cap duoc. Dung de verify RBAC.
 */
router.get("/test", adminOnly, (req, res) => {
  res.status(200).json({
    success: true,
    message: "RBAC OK - ban la SUPER_ADMIN.",
    data: { user: req.user },
  });
});

/**
 * GET /api/admin/dashboard
 * Tong quan thong ke he thong danh cho ADMIN, PRINCIPAL, VICE_PRINCIPAL.
 */
router.get("/dashboard", canViewOversight, adminDashboardController.getAdminDashboardController);

/**
 * Quan ly tai khoan giao vien & Chuyen mon giao vien
 */
router.get("/teachers", canViewTeachers, adminTeacherController.listTeachersController);
router.get("/teachers/next-code", adminOnly, adminTeacherController.nextTeacherCodeController);
router.post("/teachers", adminOnly, adminTeacherController.createTeacherController);
router.get("/teachers/:teacherId", canViewTeachers, adminTeacherController.getTeacherDetailController);
router.patch("/teachers/:teacherId", canManageTeacherProfessional, adminTeacherController.updateTeacherController);
router.get("/teachers/:teacherId/assignments", canViewTeachers, adminTeacherController.getTeacherAssignmentsController);
router.put("/teachers/:teacherId/assignments", canManageTeacherProfessional, adminTeacherController.updateTeacherAssignmentsController);
router.post("/teachers/:teacherId/lock", adminOnly, adminTeacherController.lockTeacherController);
router.post("/teachers/:teacherId/unlock", adminOnly, adminTeacherController.unlockTeacherController);
router.post(
  "/teachers/:teacherId/reset-password",
  adminOnly,
  adminTeacherController.resetTeacherPasswordController
);
router.post("/teachers/:teacherId/approve", adminOnly, adminTeacherController.approveTeacherController);
router.post("/teachers/:teacherId/reject", adminOnly, adminTeacherController.rejectTeacherController);
router.delete("/teachers/:teacherId", adminOnly, adminTeacherController.deleteTeacherController);
router.post("/teachers/bulk-delete-locked", adminOnly, adminTeacherController.bulkDeleteLockedTeachersController);

/**
 * Quan ly tai khoan Ban Giam Hieu & Ban Chuyen Mon / Khao Thi (Chi ADMIN)
 */
router.get("/management-accounts", adminOnly, adminManagementController.listManagementAccountsController);
router.post(
  "/management-accounts",
  adminOnly,
  adminManagementController.createManagementAccountController
);
router.delete(
  "/management-accounts/:userId",
  adminOnly,
  adminManagementController.deleteManagementAccountController
);
router.post(
  "/management-accounts/:userId/reset-password",
  adminOnly,
  adminManagementController.resetManagementPasswordController
);
router.post(
  "/management-accounts/:userId/toggle-status",
  adminOnly,
  adminManagementController.toggleManagementStatusController
);
router.patch(
  "/management-accounts/:userId",
  adminOnly,
  adminManagementController.updateManagementAccountController
);

export default router;