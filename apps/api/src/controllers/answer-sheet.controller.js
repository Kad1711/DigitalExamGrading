import { AppError } from "../middlewares/error.middleware.js";
import { createAnswerSheetTemplateSchema } from "../schemas/answer-sheet.schema.js";
import * as sheetService from "../services/answer-sheet.service.js";

function zodMsg(zodError) {
  const issues = zodError.issues || zodError.errors || [];
  return issues.map((e) => e.message).join(" | ");
}

/**
 * POST /api/exams/:examId/answer-sheet-template
 */
export async function createTemplateController(req, res, next) {
  try {
    const parsed = createAnswerSheetTemplateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return next(new AppError(zodMsg(parsed.error), 422, "VALIDATION_ERROR"));
    }

    const template = await sheetService.createOrRegenerateTemplate(
      req.params.examId,
      parsed.data,
      req.user
    );

    return res.status(201).json({
      success: true,
      message: "Tao phieu tra loi thanh cong.",
      data: template,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/exams/:examId/answer-sheet-template
 */
export async function getLatestTemplateController(req, res, next) {
  try {
    const template = await sheetService.getLatestTemplate(
      req.params.examId,
      req.user
    );

    return res.status(200).json({
      success: true,
      data: template,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/exams/:examId/answer-sheet-template/layout
 */
export async function getTemplateLayoutController(req, res, next) {
  try {
    const layout = await sheetService.getTemplateLayout(
      req.params.examId,
      req.user
    );

    return res.status(200).json({
      success: true,
      data: layout,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/exams/:examId/answer-sheet-template/pdf
 */
export async function downloadTemplatePdfController(req, res, next) {
  try {
    const { pdfBuffer, filename } = await sheetService.downloadTemplatePdf(
      req.params.examId,
      req.user
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}