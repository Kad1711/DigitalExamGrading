import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import { assertExamAccess, assertExamDraft } from "./exam.service.js";
import {
  buildAnswerSheetGeometry,
  TEMPLATE_VERSION,
  DEFAULT_STUDENT_DIGITS,
  DEFAULT_EXAM_CODE_DIGITS,
  QUESTIONS_PER_PAGE,
} from "../utils/answer-sheet-layout.js";
import { renderAnswerSheetPdf } from "./answer-sheet-pdf.service.js";
import crypto from "crypto";

/**
 * Validate that all exam codes are OMR-compatible (numeric string and length <= maxDigits).
 */
export function assertExamCodesOmrCompatible(examCodes, maxDigits) {
  for (const ec of examCodes) {
    const code = String(ec.code || "").trim();
    if (!/^\d+$/.test(code)) {
      throw new AppError(
        `Ma de khong hop le cho OMR: Ma de '${ec.code}' phai la cac chu so tu 0-9.`,
        400,
        "EXAM_CODE_NOT_OMR_COMPATIBLE"
      );
    }
    if (code.length > maxDigits) {
      throw new AppError(
        `Ma de khong hop le cho OMR: Ma de '${ec.code}' co ${code.length} chu so, vuot qua gioi han ${maxDigits} chu so.`,
        400,
        "EXAM_CODE_NOT_OMR_COMPATIBLE"
      );
    }
  }
}

/**
 * Create or regenerate an AnswerSheetTemplate for an Exam.
 * Only allowed in DRAFT status.
 */
export async function createOrRegenerateTemplate(examId, options = {}, reqUser) {
  const exam = await assertExamAccess(examId, reqUser);
  assertExamDraft(exam);

  const studentNumberDigits = options.studentNumberDigits || DEFAULT_STUDENT_DIGITS;
  const examCodeDigits = options.examCodeDigits || DEFAULT_EXAM_CODE_DIGITS;
  const questionsPerPage = options.questionsPerPage || QUESTIONS_PER_PAGE;

  // Fetch current exam codes to validate OMR compatibility
  const examCodes = await prisma.examCode.findMany({
    where: { examId },
    select: { id: true, code: true },
  });

  if (examCodes.length > 0) {
    assertExamCodesOmrCompatible(examCodes, examCodeDigits);
  }

  // Get next version number
  const latest = await prisma.answerSheetTemplate.findFirst({
    where: { examId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const nextVersion = (latest ? latest.version : 0) + 1;
  const templateId = crypto.randomUUID();

  // Build canonical layout geometry
  const layout = buildAnswerSheetGeometry({
    exam,
    templateId,
    templateVersion: TEMPLATE_VERSION,
    studentNumberDigits,
    examCodeDigits,
    questionsPerPage,
  });

  const created = await prisma.answerSheetTemplate.create({
    data: {
      id: templateId,
      examId,
      version: nextVersion,
      templateVersion: TEMPLATE_VERSION,
      studentNumberDigits,
      examCodeDigits,
      questionsPerPage,
      pageCount: layout.pages.length,
      layoutJson: layout,
    },
  });

  return {
    id: created.id,
    examId: created.examId,
    version: created.version,
    templateVersion: created.templateVersion,
    pageCount: created.pageCount,
    settings: layout.settings,
    createdAt: created.createdAt,
  };
}

/**
 * Get latest template metadata for an Exam.
 */
export async function getLatestTemplate(examId, reqUser) {
  await assertExamAccess(examId, reqUser);

  const template = await prisma.answerSheetTemplate.findFirst({
    where: { examId },
    orderBy: { version: "desc" },
    select: {
      id: true,
      examId: true,
      version: true,
      templateVersion: true,
      studentNumberDigits: true,
      examCodeDigits: true,
      questionsPerPage: true,
      pageCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!template) {
    throw new AppError("Chua co phieu tra loi nao duoc tao cho ky thi nay.", 404, "ANSWER_SHEET_TEMPLATE_NOT_FOUND");
  }

  return template;
}

/**
 * Get full layoutJson of the latest template for an Exam.
 */
export async function getTemplateLayout(examId, reqUser) {
  await assertExamAccess(examId, reqUser);

  const template = await prisma.answerSheetTemplate.findFirst({
    where: { examId },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      templateVersion: true,
      layoutJson: true,
    },
  });

  if (!template) {
    throw new AppError("Chua co phieu tra loi nao duoc tao cho ky thi nay.", 404, "ANSWER_SHEET_TEMPLATE_NOT_FOUND");
  }

  return template.layoutJson;
}

/**
 * Download vector PDF for the latest template.
 * Allowed even if Exam is PUBLISHED!
 */
export async function downloadTemplatePdf(examId, reqUser) {
  const exam = await assertExamAccess(examId, reqUser);

  const template = await prisma.answerSheetTemplate.findFirst({
    where: { examId },
    orderBy: { version: "desc" },
  });

  if (!template) {
    throw new AppError("Chua co phieu tra loi nao duoc tao cho ky thi nay.", 404, "ANSWER_SHEET_TEMPLATE_NOT_FOUND");
  }

  const pdfBuffer = await renderAnswerSheetPdf(template.layoutJson);
  const cleanTitle = (exam.title || "exam")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const filename = `answer-sheet-${cleanTitle}-v${template.version}.pdf`;

  return {
    pdfBuffer,
    filename,
  };
}