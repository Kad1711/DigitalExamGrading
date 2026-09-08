import {
  listStudentResults,
  getStudentResultDetail,
} from "../services/student-result.service.js";

export async function getStudentResults(req, res, next) {
  try {
    const results = await listStudentResults(req.user.id);
    res.json({
      success: true,
      data: results,
    });
  } catch (err) {
    next(err);
  }
}

export async function getStudentResultByExam(req, res, next) {
  try {
    const result = await getStudentResultDetail(req.user.id, req.params.examId);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
