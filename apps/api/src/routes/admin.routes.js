import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import * as adminTeacherController from "../controllers/admin-teacher.controller.js";
import * as adminDashboardController from "../controllers/admin-dashboard.controller.js";

const router = Router();

// Toan bo routes cua admin deu can dang nhap
router.use(authenticate);

const adminOnly = authorizeRoles("ADMIN");
const canViewOversight = authorizeRoles("ADMIN", "PRINCIPAL", "VICE_PRINCIPAL");

/**
 * GET /api/admin/test
 * Chi ADMIN truy cap duoc. Dung de verify RBAC.
 */
router.get("/test", adminOnly, (req, res) => {
  res.status(200).json({
    success: true,
    message: "RBAC OK - ban la ADMIN.",
    data: { user: req.user },
  });
});

/**
 * GET /api/admin/dashboard
 * Tong quan thong ke he thong danh cho ADMIN, PRINCIPAL, VICE_PRINCIPAL.
 */
router.get("/dashboard", canViewOversight, adminDashboardController.getAdminDashboardController);

/**
 * Quan ly tai khoan giao vien
 */
router.get("/teachers", canViewOversight, adminTeacherController.listTeachersController);
router.get("/teachers/next-code", adminOnly, adminTeacherController.nextTeacherCodeController);
router.post("/teachers", adminOnly, adminTeacherController.createTeacherController);
router.get("/teachers/:teacherId", canViewOversight, adminTeacherController.getTeacherDetailController);
router.patch("/teachers/:teacherId", adminOnly, adminTeacherController.updateTeacherController);
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

export default router;