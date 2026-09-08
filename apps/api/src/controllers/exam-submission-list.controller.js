import {
  listExamSubmissions,
  getExamSubmissionsSummary,
} from "../services/submission-list.service.js";

export async function listExamSubmissionsController(req, res) {
  const { examId } = req.params;
  const data = await listExamSubmissions({ examId, user: req.user, query: req.query });
  res.json(data);
}

export async function getExamSubmissionsSummaryController(req, res) {
  const { examId } = req.params;
  const data = await getExamSubmissionsSummary({ examId, user: req.user });
  res.json(data);
}
