import bcrypt from "bcrypt";
import ExcelJS from "exceljs";
import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import { generateSmartSbd, makeStudentEmail } from "../utils/sbd-generator.js";

const DEFAULT_SALT_ROUNDS = 10;
const DEFAULT_STUDENT_PASSWORD = "123456";

/**
 * Helper to safely extract cell text
 */
export function getCellString(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return "";
  if (typeof cell.value === "object") {
    if (cell.value.text) return String(cell.value.text).trim();
    if (cell.value.result !== undefined) return String(cell.value.result).trim();
    if (cell.value instanceof Date) {
      return cell.value.toISOString().split("T")[0];
    }
  }
  return String(cell.value).trim();
}

/**
 * Helper to parse Date from various Excel formats
 */
export function parseExcelDate(cellValue) {
  if (!cellValue) return null;
  if (cellValue instanceof Date) return cellValue;

  const str = String(cellValue).trim();
  // Format dd/MM/yyyy or dd-MM-yyyy
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Format yyyy-MM-dd
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Parse uploaded Excel file and suggest column mappings
 */
export async function parseExcelPreview(fileBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount === 0) {
    throw new AppError("File Excel không có dữ liệu.", 400, "EXCEL_EMPTY");
  }

  // Heuristic header detection: Scan first 20 rows
  const KEYWORD_REGEX = /sbd|số báo danh|mã hs|mã học sinh|mã số|mã định danh|họ|tên|ngày sinh|giới tính|lớp|stt/i;
  let bestHeaderRow = 1;
  let maxMatchCount = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 20) return;
    let matchCount = 0;
    row.eachCell((cell) => {
      const val = getCellString(cell);
      if (KEYWORD_REGEX.test(val)) {
        matchCount++;
      }
    });

    if (matchCount > maxMatchCount) {
      maxMatchCount = matchCount;
      bestHeaderRow = rowNumber;
    }
  });

  const headerRow = worksheet.getRow(bestHeaderRow);
  const headers = [];
  const detectedMapping = {
    headerRowIndex: bestHeaderRow,
    studentCodeCol: null,
    fullNameCol: null,
    lastNameCol: null,
    firstNameCol: null,
    dobCol: null,
    genderCol: null,
  };

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const val = getCellString(cell);
    if (!val) return;

    headers.push({
      colIndex: colNumber,
      headerName: val,
    });

    // Heuristics
    if (!detectedMapping.studentCodeCol && /sbd|số\s*báo\s*danh|mã\s*hs|mã\s*học\s*sinh|mã\s*định\s*danh|mã\s*số|^mã$/i.test(val)) {
      detectedMapping.studentCodeCol = colNumber;
    } else if (!detectedMapping.fullNameCol && /họ\s*và\s*tên|họ\s*tên|tên\s*học\s*sinh|full\s*name/i.test(val)) {
      detectedMapping.fullNameCol = colNumber;
    } else if (!detectedMapping.lastNameCol && /họ\s*và\s*tên\s*đệm|họ\s*và\s*chữ\s*đệm|họ\s*đệm|chữ\s*đệm|^họ$/i.test(val)) {
      detectedMapping.lastNameCol = colNumber;
    } else if (!detectedMapping.firstNameCol && /^tên$|tên\s*gọi|first\s*name/i.test(val)) {
      detectedMapping.firstNameCol = colNumber;
    } else if (!detectedMapping.dobCol && /ngày\s*sinh|ngaysinh|năm\s*sinh|dob|date\s*of\s*birth/i.test(val)) {
      detectedMapping.dobCol = colNumber;
    } else if (!detectedMapping.genderCol && /giới\s*tính|nam\/nữ|phái|gender/i.test(val)) {
      detectedMapping.genderCol = colNumber;
    }
  });

  // Extract up to 6 preview rows after header
  const previewRows = [];
  let totalDataRows = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= bestHeaderRow) return;

    let hasContent = false;
    const rowObj = { _rowNumber: rowNumber };

    headers.forEach(({ colIndex }) => {
      const cell = row.getCell(colIndex);
      const val = getCellString(cell);
      if (val) hasContent = true;
      rowObj[colIndex] = val;
    });

    if (hasContent) {
      totalDataRows++;
      if (previewRows.length < 6) {
        previewRows.push(rowObj);
      }
    }
  });

  return {
    headerRowIndex: bestHeaderRow,
    headers,
    detectedMapping,
    previewRows,
    totalRows: totalDataRows,
  };
}

/**
 * Execute smart import of students into class using confirmed column mapping
 */
export async function importStudentsFromExcel(classId, fileBuffer, mapping) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: { grade: true, academicYear: true },
  });

  if (!cls) {
    throw new AppError("Lớp học không tồn tại.", 404, "CLASS_NOT_FOUND");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new AppError("File Excel không hợp lệ.", 400, "EXCEL_INVALID");
  }

  const {
    headerRowIndex = 1,
    sbdMode = "COLUMN",
    autoGenerateSbd = false,
    studentCodeCol,
    fullNameCol,
    lastNameCol,
    firstNameCol,
    dobCol,
  } = mapping;

  const isAutoSbd = sbdMode === "AUTO" || autoGenerateSbd === true;

  if (!isAutoSbd && !studentCodeCol) {
    throw new AppError(
      "Vui lòng chọn cột Số báo danh / Mã học sinh (hoặc chọn Tự động sinh SBD).",
      400,
      "MISSING_STUDENT_CODE_COL"
    );
  }

  if (!fullNameCol && (!lastNameCol || !firstNameCol)) {
    throw new AppError("Vui lòng chọn cột Họ và tên (hoặc cả 2 cột Họ đệm và Tên).", 400, "MISSING_NAME_COL");
  }

  const passwordHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, DEFAULT_SALT_ROUNDS);
  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const errors = [];

  const rowsToProcess = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return;

    let studentCode = "";
    if (isAutoSbd) {
      const nextIdx = rowsToProcess.length + 1;
      studentCode = generateSmartSbd(cls.name, cls.grade?.level, nextIdx);
    } else {
      const studentCodeRaw = getCellString(row.getCell(studentCodeCol));
      if (!studentCodeRaw) return;
      studentCode = studentCodeRaw.trim();
    }

    let fullName = "";
    if (fullNameCol) {
      fullName = getCellString(row.getCell(fullNameCol));
    } else if (lastNameCol && firstNameCol) {
      const l = getCellString(row.getCell(lastNameCol));
      const f = getCellString(row.getCell(firstNameCol));
      fullName = `${l} ${f}`.trim();
    }

    if (!fullName) {
      errors.push(`Dòng ${rowNumber}: Không có họ tên cho mã "${studentCode}". Bỏ qua.`);
      return;
    }

    let parsedDob = null;
    if (dobCol) {
      const dobCell = row.getCell(dobCol);
      parsedDob = parseExcelDate(dobCell.value);
    }

    rowsToProcess.push({
      rowNumber,
      studentCode,
      fullName: fullName.trim(),
      dateOfBirth: parsedDob,
    });
  });

  if (rowsToProcess.length === 0) {
    throw new AppError("Không tìm thấy dữ liệu học sinh hợp lệ nào trong file.", 400, "NO_VALID_ROWS");
  }

  for (const item of rowsToProcess) {
    try {
      let student = await prisma.student.findUnique({
        where: { studentCode: item.studentCode },
        include: {
          user: true,
          enrollments: {
            include: { class: true },
          },
        },
      });

      if (!student) {
        const email = makeStudentEmail(cls.name, item.studentCode);
        const existingUser = await prisma.user.findUnique({ where: { email } });
        const finalEmail = existingUser
          ? `${cls.name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}_${item.studentCode.toLowerCase().replace(/[^a-z0-9]/g, "")}_${Date.now().toString().slice(-4)}@digitalexam.edu.vn`.toLowerCase()
          : email;

        const user = await prisma.user.create({
          data: {
            email: finalEmail,
            passwordHash,
            role: "STUDENT",
            status: "ACTIVE",
          },
        });

        student = await prisma.student.create({
          data: {
            userId: user.id,
            studentCode: item.studentCode,
            fullName: item.fullName,
            dateOfBirth: item.dateOfBirth,
            initialPassword: DEFAULT_STUDENT_PASSWORD,
          },
        });

        await prisma.studentEnrollment.create({
          data: {
            studentId: student.id,
            classId: cls.id,
            academicYearId: cls.academicYearId,
          },
        });
        importedCount++;
      } else {
        const existingInYear = student.enrollments.find(
          (e) => e.academicYearId === cls.academicYearId
        );

        if (existingInYear) {
          if (existingInYear.classId === cls.id) {
            const nameChanged = student.fullName !== item.fullName;
            const dobChanged = item.dateOfBirth && (!student.dateOfBirth || new Date(student.dateOfBirth).getTime() !== new Date(item.dateOfBirth).getTime());

            if (nameChanged || dobChanged) {
              await prisma.student.update({
                where: { id: student.id },
                data: {
                  fullName: item.fullName,
                  ...(item.dateOfBirth ? { dateOfBirth: item.dateOfBirth } : {}),
                },
              });
              updatedCount++;
            } else {
              skippedCount++;
            }
          } else {
            errors.push(
              `Dòng ${item.rowNumber} (Mã: ${item.studentCode}): Mã này đã thuộc về học sinh "${student.fullName}" ở lớp "${existingInYear.class.name}". Nếu file của bạn là Số thứ tự (1, 2, 3...), vui lòng chọn "Tự động sinh SBD theo lớp" để tránh trùng lặp giữa các lớp.`
            );
          }
        } else {
          await prisma.student.update({
            where: { id: student.id },
            data: {
              fullName: item.fullName,
              ...(item.dateOfBirth ? { dateOfBirth: item.dateOfBirth } : {}),
            },
          });

          await prisma.studentEnrollment.create({
            data: {
              studentId: student.id,
              classId: cls.id,
              academicYearId: cls.academicYearId,
            },
          });
          importedCount++;
        }
      }
    } catch (err) {
      errors.push(`Dòng ${item.rowNumber} (${item.studentCode}): ${err.message}`);
    }
  }

  return {
    totalRows: rowsToProcess.length,
    importedCount,
    updatedCount,
    skippedCount,
    errors,
  };
}
