import ExcelJS from "exceljs";
import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import { getTeacherProfile } from "./exam.service.js";

/**
 * Sanitizes a cell value to prevent formula injection.
 * Prefixes dangerous chars (=, +, -, @) with a single quote.
 */
function sanitizeCellValue(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (["=", "+", "-", "@"].includes(str[0])) {
    return "'" + str;
  }
  return str;
}

/**
 * Asserts that the requesting teacher owns the exam, results are published,
 * and the published dataset is consistent.
 */
async function assertExportAccess(examId, user) {
  if (user.role !== "TEACHER") {
    throw new AppError("Chỉ giáo viên sở hữu kỳ thi mới có quyền xuất kết quả.", 403, "FORBIDDEN");
  }
  const teacher = await getTeacherProfile(user.id);

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      teacherId: true,
      status: true,
      questionCount: true,
      maxScore: true,
      scoringType: true,
      resultsPublishedAt: true,
    },
  });
  if (!exam) throw new AppError("Kỳ thi không tồn tại.", 404, "EXAM_NOT_FOUND");
  if (exam.teacherId !== teacher.id) {
    throw new AppError("Bạn không có quyền xuất kết quả kỳ thi này.", 403, "EXAM_ACCESS_DENIED");
  }
  if (!exam.resultsPublishedAt) {
    throw new AppError(
      "Kết quả kỳ thi chưa được công bố. Chỉ có thể xuất sau khi đã công bố.",
      422,
      "RESULTS_NOT_PUBLISHED"
    );
  }

  // Section 21: Export dataset consistency guard
  // Verify that there are no corrupted/provisional/unconfirmed submissions when published
  const inconsistentCount = await prisma.examSubmission.count({
    where: {
      examId,
      OR: [
        { status: { not: "FINAL" } },
        { resolvedStudentNumber: null },
        { identityNeedsReview: true },
      ],
    },
  });
  if (inconsistentCount > 0) {
    throw new AppError(
      "Dữ liệu bài thi không đồng nhất để xuất kết quả chính thức (tồn tại bài chưa hoàn tất hoặc chưa xác nhận số báo danh).",
      422,
      "PUBLISHED_RESULTS_INCONSISTENT"
    );
  }

  return exam;
}

/**
 * Loads FINAL submissions for export.
 */
async function loadFinalSubmissions(examId) {
  return prisma.examSubmission.findMany({
    where: {
      examId,
      status: "FINAL",
      identityNeedsReview: false,
      resolvedStudentNumber: { not: null },
    },
    select: {
      id: true,
      examCodeSnapshot: true,
      resolvedStudentNumber: true,
      detectedStudentNumber: true,
      correctCount: true,
      incorrectCount: true,
      blankCount: true,
      finalScore: true,
      maxScoreSnapshot: true,
      questionCountSnapshot: true,
      finalizedAt: true,
      createdAt: true,
    },
    orderBy: [
      { resolvedStudentNumber: "asc" },
      { examCodeSnapshot: "asc" },
      { createdAt: "asc" },
    ],
  });
}

/**
 * Exports results as XLSX buffer.
 */
export async function exportResultsXlsx({ examId, user }) {
  const exam = await assertExportAccess(examId, user);
  const submissions = await loadFinalSubmissions(examId);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DigitalExamGrading";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Kết quả", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // Header row - Section 22 clean columns
  sheet.columns = [
    { header: "STT", key: "stt", width: 6 },
    { header: "Số báo danh", key: "sbd", width: 14 },
    { header: "Mã đề", key: "examCode", width: 10 },
    { header: "Số câu đúng", key: "correct", width: 12 },
    { header: "Sai / Không hợp lệ", key: "incorrect", width: 18 },
    { header: "Bỏ trống", key: "blank", width: 12 },
    { header: "Điểm", key: "score", width: 10 },
    { header: "Điểm tối đa", key: "maxScore", width: 12 },
    { header: "Thời gian hoàn thành", key: "finalizedAt", width: 22 },
  ];

  // Style header
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9E1F2" },
  };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.border = {
    bottom: { style: "thin" },
  };

  submissions.forEach((sub, idx) => {
    sheet.addRow({
      stt: idx + 1,
      sbd: sanitizeCellValue(sub.resolvedStudentNumber || ""),
      examCode: sanitizeCellValue(sub.examCodeSnapshot),
      correct: sub.correctCount,
      incorrect: sub.incorrectCount,
      blank: sub.blankCount,
      // Section 27: numeric persisted finalScore values (not formulas)
      score: sub.finalScore !== null ? Number(sub.finalScore) : "",
      maxScore: Number(sub.maxScoreSnapshot),
      finalizedAt: sub.finalizedAt
        ? sub.finalizedAt.toISOString().replace("T", " ").slice(0, 19)
        : "",
    });
  });

  // Summary row - Section 27: System-generated formula for totals
  const lastDataRow = submissions.length + 1;
  if (submissions.length > 0) {
    const summaryRow = sheet.addRow({
      stt: "",
      sbd: "TỔNG CỘNG",
      examCode: "",
      correct: { formula: `SUM(D2:D${lastDataRow})` },
      incorrect: { formula: `SUM(E2:E${lastDataRow})` },
      blank: { formula: `SUM(F2:F${lastDataRow})` },
      score: { formula: `AVERAGE(G2:G${lastDataRow})` },
      maxScore: "",
      finalizedAt: `${submissions.length} bài`,
    });
    summaryRow.font = { bold: true };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Exports results as CSV with UTF-8 BOM.
 */
export async function exportResultsCsv({ examId, user }) {
  const exam = await assertExportAccess(examId, user);
  const submissions = await loadFinalSubmissions(examId);

  const BOM = "\uFEFF";
  const headers = [
    "STT",
    "Số báo danh",
    "Mã đề",
    "Số câu đúng",
    "Sai / Không hợp lệ",
    "Bỏ trống",
    "Điểm",
    "Điểm tối đa",
    "Thời gian hoàn thành",
  ];

  const escapeCell = (val) => {
    const sanitized = sanitizeCellValue(val);
    if (sanitized.includes(",") || sanitized.includes('"') || sanitized.includes("\n") || sanitized.includes("\r")) {
      return '"' + sanitized.replace(/"/g, '""') + '"';
    }
    return sanitized;
  };

  const rows = [
    headers.map(escapeCell).join(","),
    ...submissions.map((sub, idx) =>
      [
        idx + 1,
        sanitizeCellValue(sub.resolvedStudentNumber || ""),
        sanitizeCellValue(sub.examCodeSnapshot),
        sub.correctCount,
        sub.incorrectCount,
        sub.blankCount,
        sub.finalScore !== null ? Number(sub.finalScore) : "",
        Number(sub.maxScoreSnapshot),
        sub.finalizedAt
          ? sub.finalizedAt.toISOString().replace("T", " ").slice(0, 19)
          : "",
      ]
        .map(escapeCell)
        .join(",")
    ),
  ];

  return BOM + rows.join("\r\n");
}