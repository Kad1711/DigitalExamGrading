import {
  listExamCandidates,
  getEligibleStudents,
  assignCandidate,
  removeCandidate,
} from "../services/exam-candidate.service.js";
import { assignCandidateSchema } from "../schemas/exam-candidate.schema.js";

export async function listCandidates(req, res, next) {
  try {
    const candidates = await listExamCandidates(req.user.id, req.params.examId);
    res.json({
      success: true,
      data: candidates,
    });
  } catch (err) {
    next(err);
  }
}

export async function listEligibleStudents(req, res, next) {
  try {
    const students = await getEligibleStudents(req.user.id, req.params.examId);
    res.json({
      success: true,
      data: students,
    });
  } catch (err) {
    next(err);
  }
}

export async function createCandidate(req, res, next) {
  try {
    const validated = assignCandidateSchema.parse(req.body);
    const candidate = await assignCandidate(req.user.id, req.params.examId, validated);
    res.status(201).json({
      success: true,
      message: "Đã gán học sinh vào số báo danh thành công.",
      data: candidate,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteCandidate(req, res, next) {
  try {
    const result = await removeCandidate(req.user.id, req.params.examId, req.params.candidateId);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
