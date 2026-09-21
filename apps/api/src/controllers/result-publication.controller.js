import {
  publishExamResults,
  unpublishExamResults,
  getPublicationStatus,
  getPublicationLogs,
  requestPublication,
  approvePublication,
  rejectPublication,
  principalApprovePublication,
  principalRejectPublication,
  getPublicationApprovalQueue,
} from "../services/result-publication.service.js";
import {
  exportResultsXlsx,
  exportResultsCsv,
} from "../services/result-export.service.js";

export async function publishResultsController(req, res, next) {
  try {
    const { examId } = req.params;
    const { note } = req.body || {};
    const data = await publishExamResults({ examId, user: req.user, note });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function unpublishResultsController(req, res, next) {
  try {
    const { examId } = req.params;
    const { note } = req.body || {};
    const data = await unpublishExamResults({ examId, user: req.user, note });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function requestPublicationController(req, res, next) {
  try {
    const { examId } = req.params;
    const { note } = req.body || {};
    const data = await requestPublication({ examId, user: req.user, note });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function approvePublicationController(req, res, next) {
  try {
    const { examId } = req.params;
    const { note } = req.body || {};
    const data = await approvePublication({ examId, user: req.user, note });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function rejectPublicationController(req, res, next) {
  try {
    const { examId } = req.params;
    const { reason } = req.body || {};
    const data = await rejectPublication({ examId, user: req.user, reason });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function principalApprovePublicationController(req, res, next) {
  try {
    const { examId } = req.params;
    const { note } = req.body || {};
    const data = await principalApprovePublication({ examId, user: req.user, note });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function principalRejectPublicationController(req, res, next) {
  try {
    const { examId } = req.params;
    const { reason } = req.body || {};
    const data = await principalRejectPublication({ examId, user: req.user, reason });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function getPublicationApprovalQueueController(req, res, next) {
  try {
    const data = await getPublicationApprovalQueue({ user: req.user, query: req.query });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function getPublicationStatusController(req, res, next) {
  try {
    const { examId } = req.params;
    const data = await getPublicationStatus({ examId, user: req.user });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getPublicationLogsController(req, res, next) {
  try {
    const { examId } = req.params;
    const data = await getPublicationLogs({ examId, user: req.user });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function exportResultsXlsxController(req, res, next) {
  try {
    const { examId } = req.params;
    const buffer = await exportResultsXlsx({ examId, user: req.user });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="results_${examId}.xlsx"`);
    res.end(buffer);
  } catch (err) {
    next(err);
  }
}

export async function exportResultsCsvController(req, res, next) {
  try {
    const { examId } = req.params;
    const csv = await exportResultsCsv({ examId, user: req.user });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="results_${examId}.csv"`);
    res.end(csv);
  } catch (err) {
    next(err);
  }
}
