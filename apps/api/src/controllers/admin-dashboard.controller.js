import * as adminDashboardService from "../services/admin-dashboard.service.js";

/**
 * GET /api/admin/dashboard
 * Return aggregated system metrics and statistics for Admin
 */
export async function getAdminDashboardController(req, res, next) {
  try {
    const dashboard = await adminDashboardService.getAdminSystemDashboard();
    return res.status(200).json({
      success: true,
      message: "Lấy thống kê hệ thống thành công.",
      data: dashboard,
    });
  } catch (err) {
    next(err);
  }
}
