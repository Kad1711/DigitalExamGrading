import { getTeacherDashboard } from "../services/teacher-dashboard.service.js";

export async function getTeacherDashboardController(req, res, next) {
  try {
    const dashboard = await getTeacherDashboard(req.user.id, req.user.role);
    res.json({
      success: true,
      data: dashboard,
    });
  } catch (err) {
    next(err);
  }
}
