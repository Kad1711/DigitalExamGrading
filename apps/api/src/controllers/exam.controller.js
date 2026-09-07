import {
  createExamSchema,
  updateExamSchema,
  createExamCodeSchema,
  putAnswerKeyEqualSchema,
  putAnswerKeyCustomSchema,
  listExamsQuerySchema,
} from "../schemas/exam.schema.js";

import * as examService from "../services/exam.service.js";
import * as examCodeService from "../services/exam-code.service.js";
import * as answerKeyService from "../services/answer-key.service.js";
import { AppError } from "../middlewares/error.middleware.js";

function zodMsg(zodError) {
  const issues = zodError.issues || zodError.errors || [];
  return issues.map((e) => e.message).join(" | ");
}

// =====================================================
// EXAM CONTROLLERS
// =====================================================

export async function createExamController(req, res, next) {
  try {
    const parsed = createExamSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new AppError(zodMsg(parsed.error), 422, "VALIDATION_ERROR"));
    }
    const exam = await examService.createExam(parsed.data, req.user);
    return res.status(201).json({
      success: true,
      message: "Tao ky thi thanh cong.",
      data: exam,
    });
  } catch (err) {
    next(err);
  }
}

export async function listExamsController(req, res, next) {
  try {
    const parsed = listExamsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return next(new AppError(zodMsg(parsed.error), 422, "VALIDATION_ERROR"));
    }
    const result = await examService.listExams(parsed.data, req.user);
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getExamController(req, res, next) {
  try {
    const exam = await examService.getExamById(req.params.examId, req.user);
    return res.status(200).json({ success: true, data: exam });
  } catch (err) {
    next(err);
  }
}

export async function updateExamController(req, res, next) {
  try {
    const parsed = updateExamSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new AppError(zodMsg(parsed.error), 422, "VALIDATION_ERROR"));
    }
    const updated = await examService.updateExam(
      req.params.examId,
      parsed.data,
      req.user
    );
    return res.status(200).json({
      success: true,
      message: "Cap nhat ky thi thanh cong.",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteExamController(req, res, next) {
  try {
    await examService.deleteExam(req.params.examId, req.user);
    return res.status(200).json({ success: true, message: "Da xoa ky thi." });
  } catch (err) {
    next(err);
  }
}

export async function publishExamController(req, res, next) {
  try {
    const published = await examService.publishExam(req.params.examId, req.user);
    return res.status(200).json({
      success: true,
      message: "Publish ky thi thanh cong.",
      data: published,
    });
  } catch (err) {
    next(err);
  }
}

export async function closeExamController(req, res, next) {
  try {
    const closed = await examService.closeExam(req.params.examId, req.user);
    return res.status(200).json({ success: true, message: "Da dong ky thi.", data: closed });
  } catch (err) {
    next(err);
  }
}

export async function archiveExamController(req, res, next) {
  try {
    const archived = await examService.archiveExam(req.params.examId, req.user);
    return res.status(200).json({
      success: true,
      message: "Da luu tru ky thi.",
      data: archived,
    });
  } catch (err) {
    next(err);
  }
}

// =====================================================
// EXAM CODE CONTROLLERS
// =====================================================

export async function createExamCodeController(req, res, next) {
  try {
    const parsed = createExamCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new AppError(zodMsg(parsed.error), 422, "VALIDATION_ERROR"));
    }
    const code = await examCodeService.createExamCode(
      req.params.examId,
      parsed.data.code,
      req.user
    );
    return res.status(201).json({
      success: true,
      message: "Tao ma de thanh cong.",
      data: code,
    });
  } catch (err) {
    next(err);
  }
}

export async function listExamCodesController(req, res, next) {
  try {
    const codes = await examCodeService.listExamCodes(req.params.examId, req.user);
    return res.status(200).json({ success: true, data: codes });
  } catch (err) {
    next(err);
  }
}

export async function deleteExamCodeController(req, res, next) {
  try {
    await examCodeService.deleteExamCode(
      req.params.examId,
      req.params.codeId,
      req.user
    );
    return res.status(200).json({ success: true, message: "Da xoa ma de." });
  } catch (err) {
    next(err);
  }
}

// =====================================================
// ANSWER KEY CONTROLLERS
// =====================================================

export async function putAnswerKeyController(req, res, next) {
  try {
    const hasScore =
      Array.isArray(req.body.answers) &&
      req.body.answers.some((a) => a.score !== undefined);

    const schema = hasScore ? putAnswerKeyCustomSchema : putAnswerKeyEqualSchema;
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next(new AppError(zodMsg(parsed.error), 422, "VALIDATION_ERROR"));
    }

    const result = await answerKeyService.putAnswerKey(
      req.params.examId,
      req.params.codeId,
      parsed.data.answers,
      req.user
    );
    return res.status(200).json({
      success: true,
      message: "Cap nhat dap an thanh cong.",
      data: { count: result.count },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAnswerKeyController(req, res, next) {
  try {
    const data = await answerKeyService.getAnswerKey(
      req.params.examId,
      req.params.codeId,
      req.user
    );
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}