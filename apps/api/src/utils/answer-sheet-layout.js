/**
 * =====================================================================
 * OMR ANSWER SHEET LAYOUT BUILDER - SINGLE SOURCE OF TRUTH FOR GEOMETRY
 * CHUẨN MẪU PHIẾU BỘ GIÁO DỤC VÀ ĐÀO TẠO (GDPT 2018 / 2025)
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
export const QUESTIONS_PER_PAGE = 40;

export const MARKER_SIZE_MM = 6.5;
export const MARKER_MARGIN_MM = 8.0;
export const BUBBLE_RADIUS_MM = 1.7;

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
 * Build geometry for SBD grid (student number - 6 columns chuẩn BGD).
 */
export function buildStudentNumberGrid(xMm = 138.0, yMm = 25.0, digits = DEFAULT_STUDENT_DIGITS) {
  const colWidth = 5.2;
  const headerHeight = 6.0;
  const rowHeight = 4.6;
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
        radiusMm: 1.65,
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
 * Build geometry for Exam Code grid (mã đề thi - 3 columns chuẩn BGD).
 */
export function buildExamCodeGrid(xMm = 171.0, yMm = 25.0, digits = DEFAULT_EXAM_CODE_DIGITS) {
  const colWidth = 5.2;
  const headerHeight = 6.0;
  const rowHeight = 4.6;
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
        radiusMm: 1.65,
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

export const SHEET_PRESETS = {
  PRESET_BGD_STANDARD: {
    id: "PRESET_BGD_STANDARD",
    name: "Chuẩn Bộ Giáo dục & Đào tạo (40 câu Phần I + Phần II + Phần III)",
    questionCount: 40,
    durationMinutes: 50,
    columns: 4,
    questionsPerPage: 40,
  },
  PRESET_15MIN_20Q: {
    id: "PRESET_15MIN_20Q",
    name: "Kiểm tra 15 phút - 20 câu",
    questionCount: 20,
    durationMinutes: 15,
    columns: 4,
    questionsPerPage: 40,
  },
  PRESET_15MIN_30Q: {
    id: "PRESET_15MIN_30Q",
    name: "Kiểm tra 15 phút - 30 câu",
    questionCount: 30,
    durationMinutes: 15,
    columns: 4,
    questionsPerPage: 40,
  },
  PRESET_45MIN_40Q: {
    id: "PRESET_45MIN_40Q",
    name: "Kiểm tra 45 phút - 40 câu (Chuẩn BGD)",
    questionCount: 40,
    durationMinutes: 45,
    columns: 4,
    questionsPerPage: 40,
  },
  PRESET_TERM_50Q: {
    id: "PRESET_TERM_50Q",
    name: "Học kỳ / Chuẩn BGD - 40 câu trắc nghiệm",
    questionCount: 40,
    durationMinutes: 60,
    columns: 4,
    questionsPerPage: 40,
  },
};

/**
 * Build geometry for PHẦN I: 40 Multiple-Choice Questions (4 columns of 10 questions).
 */
export function buildPart1Answers(startQuestion = 1, endQuestion = 40) {
  const colXPositions = [14.0, 59.5, 105.0, 150.5];
  const optionSpacing = 7.0;
  const optionStartOffset = 15.5;
  const startYMm = 99.5;
  const rowHeight = 4.4;
  const optionLetters = ["A", "B", "C", "D"];

  const questions = [];

  for (let q = startQuestion; q <= endQuestion; q++) {
    const index = q - 1;
    const colIndex = Math.floor(index / 10);
    const rowIndex = index % 10;
    const colX = colXPositions[colIndex];
    const yMm = startYMm + rowIndex * rowHeight;
    const centerY = Math.round((yMm + rowHeight / 2) * 100) / 100;

    const optCoords = {};
    optionLetters.forEach((letter, i) => {
      const centerX = Math.round((colX + optionStartOffset + i * optionSpacing) * 100) / 100;
      optCoords[letter] = {
        letter,
        xMm: centerX,
        yMm: centerY,
        radiusMm: BUBBLE_RADIUS_MM,
      };
    });

    questions.push({
      questionNumber: q,
      column: colIndex + 1,
      labelBox: {
        xMm: colX + 1.5,
        yMm: Math.round(yMm * 100) / 100,
        widthMm: 8.0,
        heightMm: rowHeight,
      },
      options: optCoords,
    });
  }

  return questions;
}

/**
 * Build geometry for PHẦN II: 8 True/False Questions (4 boxes, 2 questions each, 4 sub-items a..d).
 */
export function buildPart2Answers() {
  const boxXPositions = [14.0, 59.5, 105.0, 150.5];
  const startYMm = 162.0;
  const rowHeight = 4.6;
  const subItems = ["a", "b", "c", "d"];

  const questions = [];

  for (let q = 1; q <= 8; q++) {
    const boxIndex = Math.floor((q - 1) / 2);
    const isRightSub = (q - 1) % 2 === 1;
    const subX = boxXPositions[boxIndex] + (isRightSub ? 21.5 : 0.0);

    const items = {};
    subItems.forEach((subKey, rIndex) => {
      const yMm = startYMm + rIndex * rowHeight;
      const centerY = Math.round((yMm + rowHeight / 2) * 100) / 100;
      items[subKey] = {
        subKey,
        trueOption: {
          xMm: Math.round((subX + 11.5) * 100) / 100,
          yMm: centerY,
          radiusMm: 1.5,
        },
        falseOption: {
          xMm: Math.round((subX + 17.5) * 100) / 100,
          yMm: centerY,
          radiusMm: 1.5,
        },
      };
    });

    questions.push({
      questionNumber: q,
      boxIndex: boxIndex + 1,
      subIndex: isRightSub ? 2 : 1,
      xMm: subX,
      items,
    });
  }

  return questions;
}

/**
 * Build geometry for PHẦN III: 6 Short-Answer Numeric Questions (6 vertical columns).
 */
export function buildPart3Answers() {
  const boxXPositions = [14.0, 44.2, 74.4, 104.6, 134.8, 165.0];
  const boxWidth = 28.5;
  const rowHeight = 4.6;

  const questions = [];

  for (let q = 1; q <= 6; q++) {
    const boxX = boxXPositions[q - 1];

    // Row 1: '-' sign (col 1)
    const minusRowY = 199.5;
    const minusBubble = {
      xMm: Math.round((boxX + 8.5) * 100) / 100,
      yMm: Math.round((minusRowY + rowHeight / 2) * 100) / 100,
      radiusMm: 1.5,
    };

    // Row 2: ',' sign (cols 2, 3, 4)
    const commaRowY = 204.1;
    const commaBubbles = [13.5, 18.5, 23.5].map((offX, cIdx) => ({
      columnIndex: cIdx + 2,
      xMm: Math.round((boxX + offX) * 100) / 100,
      yMm: Math.round((commaRowY + rowHeight / 2) * 100) / 100,
      radiusMm: 1.5,
    }));

    // Rows 0..9: Digits (cols 1..4)
    const digitsStartY = 208.7;
    const digitRows = [];
    for (let d = 0; d <= 9; d++) {
      const yMm = digitsStartY + d * rowHeight;
      const centerY = Math.round((yMm + rowHeight / 2) * 100) / 100;
      const bubbles = [8.5, 13.5, 18.5, 23.5].map((offX, cIdx) => ({
        columnIndex: cIdx + 1,
        xMm: Math.round((boxX + offX) * 100) / 100,
        yMm: centerY,
        radiusMm: 1.5,
      }));
      digitRows.push({ digit: d, bubbles });
    }

    questions.push({
      questionNumber: q,
      boxX,
      boxWidth,
      minusBubble,
      commaBubbles,
      digitRows,
    });
  }

  return questions;
}

/**
 * Master function to build full layout geometry according to MOET 2025 Standard.
 */
export function buildAnswerSheetGeometry({
  exam,
  templateId,
  templateVersion = TEMPLATE_VERSION,
  studentNumberDigits = DEFAULT_STUDENT_DIGITS,
  examCodeDigits = DEFAULT_EXAM_CODE_DIGITS,
  questionsPerPage = QUESTIONS_PER_PAGE,
}) {
  const totalPages = 1;
  const markers = getCornerMarkers();
  const pages = [];

  for (let p = 1; p <= totalPages; p++) {
    // QR code position & metadata payload (discreetly placed in footer margin)
    const qrBox = {
      xMm: 178.5,
      yMm: 264.0,
      sizeMm: 15.0,
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
      subjectName: exam.subject ? exam.subject.name : "Kiểm tra trắc nghiệm",
      className: exam.class ? exam.class.name : "",
      pageNumber: p,
      totalPages,
    };

    // SBD and ExamCode grids (Standard top-right BGD placement)
    const studentNumber = buildStudentNumberGrid(138.0, 25.0, studentNumberDigits);
    const examCode = buildExamCodeGrid(171.0, 25.0, examCodeDigits);

    // PHẦN I: 40 questions (Standard 4 columns of 10)
    const answers = buildPart1Answers(1, 40);

    // PHẦN II & PHẦN III geometry
    const part2 = buildPart2Answers();
    const part3 = buildPart3Answers();

    pages.push({
      pageNumber: p,
      totalPages,
      header,
      qr: qrBox,
      studentNumber,
      examCode,
      answers,
      part2,
      part3,
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
      questionsPerPage: 40,
      bubbleRadiusMm: BUBBLE_RADIUS_MM,
    },
    markers,
    pages,
  };
}