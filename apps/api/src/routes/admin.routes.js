import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import * as adminTeacherController from "../controllers/admin-teacher.controller.js";
import * as adminDashboardController from "../controllers/admin-dashboard.controller.js";

const router = Router();

// Toan bo routes cua admin deu can dang nhap va phan quyen ADMIN
router.use(authenticate);
router.use(authorizeRoles("ADMIN"));

/**
 * GET /api/admin/test
 * Chi ADMIN truy cap duoc. Dung de verify RBAC.
 */
router.get("/test", (req, res) => {
  res.status(200).json({
    success: true,
    message: "RBAC OK - ban la ADMIN.",
    data: { user: req.user },
  });
});

/**
 * GET /api/admin/dashboard
 * Tong quan thong ke he thong danh rieng cho ADMIN.
 */
router.get("/dashboard", adminDashboardController.getAdminDashboardController);

/**
 * Quan ly tai khoan giao vien
 */
router.get("/teachers", adminTeacherController.listTeachersController);
router.post("/teachers", adminTeacherController.createTeacherController);
router.get("/teachers/:teacherId", adminTeacherController.getTeacherDetailController);
router.patch("/teachers/:teacherId", adminTeacherController.updateTeacherController);
router.post("/teachers/:teacherId/lock", adminTeacherController.lockTeacherController);
router.post("/teachers/:teacherId/unlock", adminTeacherController.unlockTeacherController);
router.post(
  "/teachers/:teacherId/reset-password",
  adminTeacherController.resetTeacherPasswordController
);
router.delete("/teachers/:teacherId", adminTeacherController.deleteTeacherController);
router.post("/teachers/bulk-delete-locked", adminTeacherController.bulkDeleteLockedTeachersController);

export default router;