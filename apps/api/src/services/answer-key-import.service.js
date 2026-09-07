import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import { assertExamAccess, assertExamDraft } from "./exam.service.js";
import {
  parseAnswerKeyCsv,
  parseAnswerKeyXlsx,
  generateCsvTemplate,
  generateXlsxTemplate,
} from "../utils/answer-key-file-parser.js";

/**
 * Tinh score tham khao moi cau khi EQUAL de hien thi / luu tru.
 */
function calcEqualScore(maxScore, questionCount) {
  return Math.round((Number(maxScore) / questionCount) * 10000) / 10000;
}

/**
 * Detect file format from originalname and mimetype.
 */
function detectFormat(originalName, mimeType) {
  const name = (originalName || "").toLowerCase();
  if (name.endsWith(".csv") || mimeType === "text/csv" || mimeType === "application/csv") {
    return "csv";
  }
  if (
    name.endsWith(".xlsx") ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "xlsx";
  }
  throw new AppError("Dinh dang file khong hop le. Chi chap nhan .xlsx hoac .csv.", 400, "ANSWER_KEY_FILE_TYPE_INVALID");
}

/**
 * Parse file buffer into rows based on format.
 */
async function parseRows(buffer, format) {
  if (format === "csv") {
    return parseAnswerKeyCsv(buffer);
  }
  return parseAnswerKeyXlsx(buffer);
}

/**
 * Get download template for an Exam (prefilled with current codes and 1..questionCount).
 */
export async function getImportTemplate(examId, format, reqUser) {
  const exam = await assertExamAccess(examId, reqUser);

  const examCodes = await prisma.examCode.findMany({
    where: { examId },
    select: { code: true },
    orderBy: { code: "asc" },
  });

  if (format === "csv") {
    const csvContent = generateCsvTemplate(exam, examCodes);
    return {
      buffer: Buffer.from(csvContent, "utf-8"),
      contentType: "text/csv",
      filename: `answer-key-template-${exam.id}.csv`,
    };
  }

  const xlsxBuffer = await generateXlsxTemplate(exam, examCodes);
  return {
    buffer: xlsxBuffer,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `answer-key-template-${exam.id}.xlsx`,
  };
}

/**
 * Core validation logic for parsed rows against an Exam.
 */
export function validateImportRows(rows, exam, existingCodes) {
  const errors = [];
  const validAnswers = new Set(["A", "B", "C", "D"]);
  const codeMap = new Map(); // code -> examCode object
  existingCodes.forEach((c) => codeMap.set(c.code, c));

  const seen = new Set(); // "code:qn"
  const groupedByCode = new Map(); // code -> array of rows

  for (const row of rows) {
    const { rowNumber, examCode, questionNumber, correctAnswer, score } = row;

    // 1. ExamCode check
    if (!examCode) {
      errors.push({
        row: rowNumber,
        field: "examCode",
        message: "Ma de khong duoc de trong.",
      });
      continue;
    }

    if (!codeMap.has(examCode)) {
      errors.push({
        row: rowNumber,
        field: "examCode",
        message: `Ma de '${examCode}' khong ton tai trong ky thi nay.`,
      });
      continue;
    }

    // 2. Question number check
    if (isNaN(questionNumber) || !Number.isInteger(questionNumber)) {
      errors.push({
        row: rowNumber,
        field: "questionNumber",
        message: "So thu tu cau hoi phai la so nguyen.",
      });
      continue;
    }

    if (questionNumber < 1 || questionNumber > exam.questionCount) {
      errors.push({
        row: rowNumber,
        field: "questionNumber",
        message: `So cau ${questionNumber} vuot khoang hop le [1, ${exam.questionCount}].`,
      });
      continue;
    }

    // 3. Duplicate check
    const dupKey = `${examCode}:${questionNumber}`;
    if (seen.has(dupKey)) {
      errors.push({
        row: rowNumber,
        field: "questionNumber",
        message: `Ma de '${examCode}' bi trung lap cau hoi so ${questionNumber}.`,
      });
      continue;
    }
    seen.add(dupKey);

    // 4. Correct answer check
    if (!correctAnswer || !validAnswers.has(correctAnswer)) {
      errors.push({
        row: rowNumber,
        field: "correctAnswer",
        message: "Dap an phai la A, B, C hoac D.",
      });
      continue;
    }

    // 5. Score check for CUSTOM
    if (exam.scoringType === "CUSTOM") {
      if (score === null || score === undefined || isNaN(score) || score <= 0) {
        errors.push({
          row: rowNumber,
          field: "score",
          message: "score la bat buoc va phai lon hon 0 khi scoringType = CUSTOM.",
        });
        continue;
      }
    }

    if (!groupedByCode.has(examCode)) {
      groupedByCode.set(examCode, []);
    }
    groupedByCode.get(examCode).push({
      examCodeId: codeMap.get(examCode).id,
      code: examCode,
      questionNumber,
      correctAnswer,
      score,
    });
  }

  // 6. Completeness check per ExamCode
  const maxScore = Number(exam.maxScore);

  for (const [code, items] of groupedByCode.entries()) {
    // Check if exactly 1..questionCount are present
    const qnSet = new Set(items.map((it) => it.questionNumber));
    const missing = [];
    for (let q = 1; q <= exam.questionCount; q++) {
      if (!qnSet.has(q)) missing.push(q);
    }

    if (missing.length > 0) {
      errors.push({
        row: null,
        field: "completeness",
        message: `Ma de '${code}' chua du dap an. Thieu ${missing.length} cau: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "..." : ""}.`,
      });
    }

    // CUSTOM score sum check
    if (exam.scoringType === "CUSTOM" && missing.length === 0) {
      const total = items.reduce((sum, it) => sum + Number(it.score), 0);
      const rounded = Math.round(total * 10000) / 10000;
      if (Math.abs(rounded - maxScore) > 0.0001) {
        errors.push({
          row: null,
          field: "score",
          message: `Ma de '${code}': tong score (${rounded}) khong bang maxScore cua ky thi (${maxScore}).`,
        });
      }
    }
  }

  const valid = errors.length === 0;
  const codesSummary = Array.from(groupedByCode.entries()).map(([code, items]) => ({
    code,
    answerCount: items.length,
  }));

  return {
    valid,
    errors,
    groupedByCode,
    summary: {
      rows: rows.length,
      examCodes: groupedByCode.size,
      questionCount: exam.questionCount,
    },
    codes: codesSummary,
  };
}

/**
 * Preview import from file buffer without writing to DB.
 */
export async function previewImport(examId, fileBuffer, mimeType, originalName, reqUser) {
  const exam = await assertExamAccess(examId, reqUser);
  assertExamDraft(exam);

  const format = detectFormat(originalName, mimeType);
  const rows = await parseRows(fileBuffer, format);

  const existingCodes = await prisma.examCode.findMany({
    where: { examId },
    select: { id: true, code: true },
  });

  const validation = validateImportRows(rows, exam, existingCodes);

  return {
    valid: validation.valid,
    format,
    summary: validation.summary,
    codes: validation.codes,
    errors: validation.errors,
  };
}

/**
 * Apply import from file buffer: atomic replace for affected ExamCodes.
 */
export async function applyImport(examId, fileBuffer, mimeType, originalName, reqUser) {
  const exam = await assertExamAccess(examId, reqUser);
  assertExamDraft(exam);

  const format = detectFormat(originalName, mimeType);
  const rows = await parseRows(fileBuffer, format);

  const existingCodes = await prisma.examCode.findMany({
    where: { examId },
    select: { id: true, code: true },
  });

  const validation = validateImportRows(rows, exam, existingCodes);

  if (!validation.valid) {
    const errorDetails = validation.errors.map((e) => `[${e.field || "row"}] ${e.message}`).join(" | ");
    throw new AppError(
      `Du lieu import khong hop le: ${errorDetails}`,
      422,
      "ANSWER_KEY_IMPORT_INVALID"
    );
  }

  const equalScore =
    exam.scoringType === "EQUAL" ? calcEqualScore(exam.maxScore, exam.questionCount) : null;

  // Atomic replace via Prisma transaction
  const importedCodes = [];
  let totalAnswers = 0;

  await prisma.$transaction(async (tx) => {
    for (const [code, items] of validation.groupedByCode.entries()) {
      const examCodeId = items[0].examCodeId;

      // Delete old answer keys for this exam code
      await tx.answerKey.deleteMany({ where: { examCodeId } });

      // Insert new answer keys
      const dataToInsert = items.map((it) => ({
        examCodeId,
        questionNumber: it.questionNumber,
        correctAnswer: it.correctAnswer,
        score: exam.scoringType === "EQUAL" ? equalScore : Number(it.score),
      }));

      await tx.answerKey.createMany({ data: dataToInsert });

      importedCodes.push({ code, count: dataToInsert.length });
      totalAnswers += dataToInsert.length;
    }
  });

  return {
    importedCodes,
    totalAnswers,
  };
}