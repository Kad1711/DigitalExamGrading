/**
 * =====================================================================
 * OMR ANSWER SHEET LAYOUT BUILDER - SINGLE SOURCE OF TRUTH FOR GEOMETRY
 * =====================================================================
 *
 * All coordinates are in millimeters (mm) on standard A4 portrait (210mm x 297mm).
 * Both layoutJson and PDFKit rendering MUST use the exact geometry built here.
 */

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const PT_PER_MM = 72 / 25.4; // 2.83464567

export const TEMPLATE_VERSION = "OMR_V1";
export const DEFAULT_STUDENT_DIGITS = 6;
export const DEFAULT_EXAM_CODE_DIGITS = 3;
export const QUESTIONS_PER_PAGE = 50;

export const MARKER_SIZE_MM = 7.0;
export const MARKER_MARGIN_MM = 8.0;
export const BUBBLE_RADIUS_MM = 2.0;

/**
 * Standard 4 corner alignment markers for OpenCV perspective transform.
 */
export function getCornerMarkers() {
  return [
    { id: "TOP_LEFT", xMm: MARKER_MARGIN_MM, yMm: MARKER_MARGIN_MM, sizeMm: MARKER_SIZE_MM },
    { id: "TOP_RIGHT", xMm: A4_WIDTH_MM - MARKER_MARGIN_MM - MARKER_SIZE_MM, yMm: MARKER_MARGIN_MM, sizeMm: MARKER_SIZE_MM },
    { id: "BOTTOM_LEFT", xMm: MARKER_MARGIN_MM, yMm: A4_HEIGHT_MM - MARKER_MARGIN_MM - MARKER_SIZE_MM, sizeMm: MARKER_SIZE_MM },
    { id: "BOTTOM_RIGHT", xMm: A4_WIDTH_MM - MARKER_MARGIN_MM - MARKER_SIZE_MM, yMm: A4_HEIGHT_MM - MARKER_MARGIN_MM - MARKER_SIZE_MM, sizeMm: MARKER_SIZE_MM },
  ];
}

/**
 * Build geometry for SBD grid (student number).
 */
export function buildStudentNumberGrid(xMm, yMm, digits) {
  const colWidth = 6.0;
  const headerHeight = 6.0;
  const rowHeight = 5.0;
  const columns = [];

  for (let c = 0; c < digits; c++) {
    const colLeft = xMm + c * colWidth;
    const digitBoxes = [];

    for (let d = 0; d <= 9; d++) {
      const rowTop = yMm + headerHeight + d * rowHeight;
      digitBoxes.push({
        digit: d,
        centerX: Math.round((colLeft + colWidth / 2) * 100) / 100,
        centerY: Math.round((rowTop + rowHeight / 2) * 100) / 100,
        radiusMm: 1.8,
      });
    }

    columns.push({
      columnIndex: c,
      writeBox: {
        xMm: Math.round(colLeft * 100) / 100,
        yMm: Math.round(yMm * 100) / 100,
        widthMm: colWidth,
        heightMm: headerHeight,
      },
      bubbles: digitBoxes,
    });
  }

  return {
    xMm,
    yMm,
    digits,
    widthMm: digits * colWidth,
    heightMm: headerHeight + 10 * rowHeight,
    columns,
  };
}

/**
 * Build geometry for Exam Code grid (ma de).
 */
export function buildExamCodeGrid(xMm, yMm, digits) {
  const colWidth = 6.0;
  const headerHeight = 6.0;
  const rowHeight = 5.0;
  const columns = [];

  for (let c = 0; c < digits; c++) {
    const colLeft = xMm + c * colWidth;
    const digitBoxes = [];

    for (let d = 0; d <= 9; d++) {
      const rowTop = yMm + headerHeight + d * rowHeight;
      digitBoxes.push({
        digit: d,
        centerX: Math.round((colLeft + colWidth / 2) * 100) / 100,
        centerY: Math.round((rowTop + rowHeight / 2) * 100) / 100,
        radiusMm: 1.8,
      });
    }

    columns.push({
      columnIndex: c,
      writeBox: {
        xMm: Math.round(colLeft * 100) / 100,
        yMm: Math.round(yMm * 100) / 100,
        widthMm: colWidth,
        heightMm: headerHeight,
      },
      bubbles: digitBoxes,
    });
  }

  return {
    xMm,
    yMm,
    digits,
    widthMm: digits * colWidth,
    heightMm: headerHeight + 10 * rowHeight,
    columns,
  };
}

/**
 * Build answer question rows for a page.
 */
export function buildAnswerRows(startQuestion, endQuestion, startYMm) {
  const totalQuestions = endQuestion - startQuestion + 1;
  const col1Count = Math.min(25, Math.ceil(totalQuestions / 2));
  const rowHeight = 6.3;
  const col1X = 20.0;
  const col2X = 112.0;
  const optionLetters = ["A", "B", "C", "D"];
  const optionSpacing = 9.0;
  const optionStartOffset = 18.0;

  const questions = [];

  for (let q = startQuestion; q <= endQuestion; q++) {
    const indexInPage = q - startQuestion;
    const isCol2 = indexInPage >= col1Count;
    const colX = isCol2 ? col2X : col1X;
    const rowInCol = isCol2 ? indexInPage - col1Count : indexInPage;
    const yMm = startYMm + rowInCol * rowHeight;
    const centerY = Math.round((yMm + rowHeight / 2) * 100) / 100;

    const options = {};
    optionLetters.forEach((letter, i) => {
      const centerX = Math.round((colX + optionStartOffset + i * optionSpacing) * 100) / 100;
      options[letter] = {
        letter,
        xMm: centerX,
        yMm: centerY,
        radiusMm: BUBBLE_RADIUS_MM,
      };
    });

    questions.push({
      questionNumber: q,
      column: isCol2 ? 2 : 1,
      labelBox: {
        xMm: colX,
        yMm,
        widthMm: 14.0,
        heightMm: rowHeight,
      },
      options,
    });
  }

  return questions;
}

/**
 * Master function to build full layout geometry across all pages.
 */
export function buildAnswerSheetGeometry({
  exam,
  templateId,
  templateVersion = TEMPLATE_VERSION,
  studentNumberDigits = DEFAULT_STUDENT_DIGITS,
  examCodeDigits = DEFAULT_EXAM_CODE_DIGITS,
  questionsPerPage = QUESTIONS_PER_PAGE,
}) {
  const questionCount = exam.questionCount || 40;
  const totalPages = Math.max(1, Math.ceil(questionCount / questionsPerPage));
  const markers = getCornerMarkers();
  const pages = [];

  for (let p = 1; p <= totalPages; p++) {
    const startQ = (p - 1) * questionsPerPage + 1;
    const endQ = Math.min(questionCount, p * questionsPerPage);

    // QR code position & metadata payload
    const qrBox = {
      xMm: 168.0,
      yMm: 18.0,
      sizeMm: 24.0,
      payload: {
        v: 1,
        templateVersion,
        templateId,
        examId: exam.id,
        page: p,
        pages: totalPages,
      },
    };

    // Header info
    const header = {
      examTitle: exam.title,
      subjectName: exam.subject ? exam.subject.name : "Kiem tra",
      className: exam.class ? exam.class.name : "",
      pageNumber: p,
      totalPages,
    };

    // SBD and ExamCode grids
    const studentNumber = buildStudentNumberGrid(20.0, 42.0, studentNumberDigits);
    const examCode = buildExamCodeGrid(64.0, 42.0, examCodeDigits);

    // Answer questions
    const answers = buildAnswerRows(startQ, endQ, 106.0);

    pages.push({
      pageNumber: p,
      totalPages,
      header,
      qr: qrBox,
      studentNumber,
      examCode,
      answers,
    });
  }

  return {
    templateVersion,
    templateId,
    examId: exam.id,
    pageSize: {
      format: "A4",
      widthMm: A4_WIDTH_MM,
      heightMm: A4_HEIGHT_MM,
    },
    settings: {
      studentNumberDigits,
      examCodeDigits,
      questionsPerPage,
      bubbleRadiusMm: BUBBLE_RADIUS_MM,
    },
    markers,
    pages,
  };
}