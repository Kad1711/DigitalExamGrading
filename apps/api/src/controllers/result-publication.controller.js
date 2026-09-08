import {
  publishExamResults,
  unpublishExamResults,
  getPublicationStatus,
  getPublicationLogs,
} from "../services/result-publication.service.js";
import {
  exportResultsXlsx,
  exportResultsCsv,
} from "../services/result-export.service.js";

export async function publishResultsController(req, res) {
  const { examId } = req.params;
  const { note } = req.body || {};
  const data = await publishExamResults({ examId, user: req.user, note });
  res.status(200).json(data);
}

export async function unpublishResultsController(req, res) {
  const { examId } = req.params;
  const { note } = req.body || {};
  const data = await unpublishExamResults({ examId, user: req.user, note });
  res.status(200).json(data);
}

export async function getPublicationStatusController(req, res) {
  const { examId } = req.params;
  const data = await getPublicationStatus({ examId, user: req.user });
  res.json(data);
}

export async function getPublicationLogsController(req, res) {
  const { examId } = req.params;
  const data = await getPublicationLogs({ examId, user: req.user });
  res.json(data);
}

export async function exportResultsXlsxController(req, res) {
  const { examId } = req.params;
  const buffer = await exportResultsXlsx({ examId, user: req.user });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="results_${examId}.xlsx"`);
  res.end(buffer);
}

export async function exportResultsCsvController(req, res) {
  const { examId } = req.params;
  const csv = await exportResultsCsv({ examId, user: req.user });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="results_${examId}.csv"`);
  res.end(csv);
}
