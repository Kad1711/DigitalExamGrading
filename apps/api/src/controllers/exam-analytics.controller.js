import { getExamAnalytics } from "../services/exam-analytics.service.js";

export async function getExamAnalyticsController(req, res, next) {
  try {
    const analytics = await getExamAnalytics(req.user.id, req.params.examId);
    res.json({
      success: true,
      data: analytics,
    });
  } catch (err) {
    next(err);
  }
}
