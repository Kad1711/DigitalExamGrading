import {
  getTeacherDashboard,
  getTeacherTeachingAssignments,
  getTeacherClassStatistics,
} from "../services/teacher-dashboard.service.js";

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

export async function getTeacherTeachingAssignmentsController(req, res, next) {
  try {
    const result = await getTeacherTeachingAssignments(req.user.id, req.user.role);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getTeacherClassStatisticsController(req, res, next) {
  try {
    const result = await getTeacherClassStatistics(req.user.id, req.query);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
