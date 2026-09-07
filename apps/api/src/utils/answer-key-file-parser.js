import ExcelJS from "exceljs";
import { parse as parseCsvSync } from "csv-parse/sync";
import { AppError } from "../middlewares/error.middleware.js";

/**
 * Normalize header name: lowercase and strip spaces/underscores.
 */
function normalizeHeader(h) {
  if (!h) return "";
  return String(h).trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/**
 * Parse CSV buffer into normalized rows.
 * @param {Buffer} buffer
 * @returns {Array<{rowNumber: number, examCode: string, questionNumber: number, correctAnswer: string, score: number|null}>}
 */
export function parseAnswerKeyCsv(buffer) {
  let records;
  try {
    records = parseCsvSync(buffer, {
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (err) {
    throw new AppError("File CSV khong dung dinh dang hoac bi loi: " + err.message, 422, "FILE_PARSE_ERROR");
  }

  if (!records || records.length < 2) {
    throw new AppError("File CSV phai co dong tieu de va it nhat 1 dong du lieu.", 422, "FILE_EMPTY");
  }

  const rawHeaders = records[0];
  const headerMap = {};
  rawHeaders.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    if (norm === "examcode" || norm === "code" || norm === "made") headerMap.examCode = idx;
    else if (norm === "questionnumber" || norm === "question" || norm === "cau" || norm === "stt") headerMap.questionNumber = idx;
    else if (norm === "correctanswer" || norm === "answer" || norm === "dapan") headerMap.correctAnswer = idx;
    else if (norm === "score" || norm === "diem") headerMap.score = idx;
  });

  if (headerMap.examCode === undefined || headerMap.questionNumber === undefined || headerMap.correctAnswer === undefined) {
    throw new AppError(
      "File CSV thieu cac cot bat buoc: 'examCode', 'questionNumber', 'correctAnswer'.",
      422,
      "FILE_HEADER_INVALID"
    );
  }

  const rows = [];
  for (let i = 1; i < records.length; i++) {
    const r = records[i];
    if (!r || r.length === 0 || r.every((c) => !c || String(c).trim() === "")) continue;

    const rawCode = r[headerMap.examCode];
    const rawQn = r[headerMap.questionNumber];
    const rawAns = r[headerMap.correctAnswer];
    const rawScore = headerMap.score !== undefined ? r[headerMap.score] : undefined;

    rows.push({
      rowNumber: i + 1, // 1-indexed Excel/file row
      examCode: rawCode ? String(rawCode).trim() : "",
      questionNumber: rawQn !== undefined && rawQn !== "" ? Number(String(rawQn).trim()) : NaN,
      correctAnswer: rawAns ? String(rawAns).trim().toUpperCase() : "",
      score: rawScore !== undefined && String(rawScore).trim() !== "" ? Number(String(rawScore).trim()) : null,
    });
  }

  return rows;
}

/**
 * Parse XLSX buffer into normalized rows.
 * @param {Buffer} buffer
 * @returns {Promise<Array<{rowNumber: number, examCode: string, questionNumber: number, correctAnswer: string, score: number|null}>>}
 */
export async function parseAnswerKeyXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch (err) {
    throw new AppError("File XLSX khong hop le hoac bi loi: " + err.message, 422, "FILE_PARSE_ERROR");
  }

  // Find sheet named 'AnswerKeys' or use first worksheet
  let worksheet = workbook.getWorksheet("AnswerKeys");
  if (!worksheet) {
    worksheet = workbook.worksheets[0];
  }
  if (!worksheet) {
    throw new AppError("File XLSX khong co sheet du lieu nao.", 422, "FILE_EMPTY");
  }

  const rows = [];
  let headerMap = null;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      headerMap = {};
      row.eachCell((cell, colNumber) => {
        const norm = normalizeHeader(cell.value);
        if (norm === "examcode" || norm === "code" || norm === "made") headerMap.examCode = colNumber;
        else if (norm === "questionnumber" || norm === "question" || norm === "cau" || norm === "stt") headerMap.questionNumber = colNumber;
        else if (norm === "correctanswer" || norm === "answer" || norm === "dapan") headerMap.correctAnswer = colNumber;
        else if (norm === "score" || norm === "diem") headerMap.score = colNumber;
      });
      return;
    }

    if (!headerMap) return;

    const rawCode = headerMap.examCode ? row.getCell(headerMap.examCode).value : null;
    const rawQn = headerMap.questionNumber ? row.getCell(headerMap.questionNumber).value : null;
    const rawAns = headerMap.correctAnswer ? row.getCell(headerMap.correctAnswer).value : null;
    const rawScore = headerMap.score ? row.getCell(headerMap.score).value : null;

    // Skip empty row
    if (rawCode === null && rawQn === null && rawAns === null && rawScore === null) return;

    rows.push({
      rowNumber,
      examCode: rawCode ? String(rawCode).trim() : "",
      questionNumber: rawQn !== null && rawQn !== undefined && String(rawQn).trim() !== "" ? Number(String(rawQn).trim()) : NaN,
      correctAnswer: rawAns ? String(rawAns).trim().toUpperCase() : "",
      score: rawScore !== null && rawScore !== undefined && String(rawScore).trim() !== "" ? Number(String(rawScore).trim()) : null,
    });
  });

  if (!headerMap || headerMap.examCode === undefined || headerMap.questionNumber === undefined || headerMap.correctAnswer === undefined) {
    throw new AppError(
      "File XLSX thieu cac cot bat buoc: 'examCode', 'questionNumber', 'correctAnswer'.",
      422,
      "FILE_HEADER_INVALID"
    );
  }

  return rows;
}

/**
 * Generate CSV template string for an Exam.
 */
export function generateCsvTemplate(exam, examCodes) {
  const lines = ["examCode,questionNumber,correctAnswer,score"];
  const count = exam.questionCount || 40;
  const codes = examCodes && examCodes.length > 0 ? examCodes : [{ code: "101" }];

  for (const ec of codes) {
    for (let q = 1; q <= count; q++) {
      lines.push(`${ec.code},${q},,`);
    }
  }

  return lines.join("\r\n");
}

/**
 * Generate XLSX template Buffer for an Exam.
 */
export async function generateXlsxTemplate(exam, examCodes) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DigitalExamGrading";
  const worksheet = workbook.addWorksheet("AnswerKeys");

  worksheet.columns = [
    { header: "examCode", key: "examCode", width: 15 },
    { header: "questionNumber", key: "questionNumber", width: 18 },
    { header: "correctAnswer", key: "correctAnswer", width: 16 },
    { header: "score", key: "score", width: 15 },
  ];

  // Format header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2B579A" },
  };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };

  const count = exam.questionCount || 40;
  const codes = examCodes && examCodes.length > 0 ? examCodes : [{ code: "101" }];

  for (const ec of codes) {
    for (let q = 1; q <= count; q++) {
      worksheet.addRow({
        examCode: ec.code,
        questionNumber: q,
        correctAnswer: "",
        score: "",
      });
    }
  }

  return workbook.xlsx.writeBuffer();
}