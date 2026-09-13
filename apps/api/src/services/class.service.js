import bcrypt from "bcrypt";
import ExcelJS from "exceljs";
import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";

const DEFAULT_SALT_ROUNDS = 10;
const DEFAULT_STUDENT_PASSWORD = "123456";

/**
 * Vietnamese Name Comparator for sorting students by Given Name (Tên) then Family & Middle Names (Họ & chữ đệm).
 */
export function compareVietnameseNames(aName = "", bName = "") {
  const cleanA = (aName || "").trim();
  const cleanB = (bName || "").trim();
  if (!cleanA && !cleanB) return 0;
  if (!cleanA) return 1;
  if (!cleanB) return -1;

  const aParts = cleanA.split(/\s+/);
  const bParts = cleanB.split(/\s+/);

  const aFirstName = aParts[aParts.length - 1] || "";
  const bFirstName = bParts[bParts.length - 1] || "";

  const firstCompare = aFirstName.localeCompare(bFirstName, "vi", { sensitivity: "base" });
  if (firstCompare !== 0) return firstCompare;

  return cleanA.localeCompare(cleanB, "vi", { sensitivity: "base" });
}

/**
 * List all available grades
 */
export async function listGrades() {
  return prisma.grade.findMany({
    orderBy: { level: "asc" },
  });
}

/**
 * List all classes with student count
 */
export async function listClasses() {
  const classes = await prisma.class.findMany({
    select: {
      id: true,
      name: true,
      gradeId: true,
      academicYearId: true,
      grade: {
        select: {
          id: true,
          level: true,
          name: true,
        },
      },
      academicYear: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          enrollments: true,
          exams: true,
        },
      },
      createdAt: true,
    },
    orderBy: [{ grade: { level: "asc" } }, { name: "asc" }],
  });

  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    gradeId: c.gradeId,
    gradeName: c.grade.name,
    gradeLevel: c.grade.level,
    academicYearId: c.academicYearId,
    academicYearName: c.academicYear.name,
    studentCount: c._count.enrollments,
    examCount: c._count.exams,
    createdAt: c.createdAt,
  }));
}

/**
 * Create a new class
 */
export async function createClass({ name, gradeId, teacherUserId }) {
  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
  });
  if (!grade) {
    throw new AppError("Khối học không tồn tại.", 404, "GRADE_NOT_FOUND");
  }

  // Find the latest/active academic year
  let academicYear = await prisma.academicYear.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!academicYear) {
    academicYear = await prisma.academicYear.create({
      data: { name: "2026-2027" },
    });
  }

  // Check if class with same name and academic year already exists
  const existingClass = await prisma.class.findFirst({
    where: {
      name: { equals: name.trim(), mode: "insensitive" },
      academicYearId: academicYear.id,
    },
  });

  if (existingClass) {
    throw new AppError(
      `Lớp "${name.trim()}" đã tồn tại trong năm học ${academicYear.name}.`,
      409,
      "CLASS_ALREADY_EXISTS"
    );
  }

  const newClass = await prisma.class.create({
    data: {
      name: name.trim(),
      gradeId: grade.id,
      academicYearId: academicYear.id,
    },
    include: {
      grade: true,
      academicYear: true,
    },
  });

  // If created by a teacher, assign teaching assignment so teacher has relationship
  if (teacherUserId) {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: teacherUserId },
    });

    if (teacher) {
      const subject = await prisma.subject.findFirst();
      if (subject) {
        await prisma.teachingAssignment.create({
          data: {
            teacherId: teacher.id,
            subjectId: subject.id,
            classId: newClass.id,
            academicYearId: academicYear.id,
          },
        }).catch(() => {}); // Ignore assignment collision if any
      }
    }
  }

  return {
    id: newClass.id,
    name: newClass.name,
    gradeId: newClass.gradeId,
    gradeName: newClass.grade.name,
    gradeLevel: newClass.grade.level,
    academicYearId: newClass.academicYearId,
    academicYearName: newClass.academicYear.name,
    studentCount: 0,
    examCount: 0,
    createdAt: newClass.createdAt,
  };
}

/**
 * Create multiple classes in batch
 */
export async function createBatchClasses({ names, gradeId, teacherUserId }) {
  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
  });
  if (!grade) {
    throw new AppError("Khối học không tồn tại.", 404, "GRADE_NOT_FOUND");
  }

  let academicYear = await prisma.academicYear.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!academicYear) {
    academicYear = await prisma.academicYear.create({
      data: { name: "2026-2027" },
    });
  }

  // Deduplicate input names preserving case of first occurrence
  const uniqueNames = [];
  const seen = new Set();
  for (const rawName of names) {
    const trimmed = (rawName || "").trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueNames.push(trimmed);
    }
  }

  if (uniqueNames.length === 0) {
    throw new AppError("Vui lòng nhập ít nhất một tên lớp hợp lệ.", 400, "INVALID_CLASS_NAMES");
  }

  // Find all existing classes for this academic year
  const allExistingInYear = await prisma.class.findMany({
    where: { academicYearId: academicYear.id },
    select: { name: true },
  });

  const existingNameSet = new Set(allExistingInYear.map((c) => c.name.toLowerCase()));
  const toCreateNames = uniqueNames.filter((n) => !existingNameSet.has(n.toLowerCase()));
  const skippedNames = uniqueNames.filter((n) => existingNameSet.has(n.toLowerCase()));

  if (toCreateNames.length === 0) {
    throw new AppError(
      `Tất cả các lớp nhập vào (${skippedNames.join(", ")}) đều đã tồn tại trong năm học ${academicYear.name}.`,
      409,
      "ALL_CLASSES_ALREADY_EXIST"
    );
  }

  let teacher = null;
  let subject = null;
  if (teacherUserId) {
    teacher = await prisma.teacher.findUnique({
      where: { userId: teacherUserId },
    });
    if (teacher) {
      subject = await prisma.subject.findFirst();
    }
  }

  const createdClasses = [];
  for (const name of toCreateNames) {
    const newClass = await prisma.class.create({
      data: {
        name,
        gradeId: grade.id,
        academicYearId: academicYear.id,
      },
      include: {
        grade: true,
        academicYear: true,
      },
    });

    if (teacher && subject) {
      await prisma.teachingAssignment.create({
        data: {
          teacherId: teacher.id,
          subjectId: subject.id,
          classId: newClass.id,
          academicYearId: academicYear.id,
        },
      }).catch(() => {});
    }

    createdClasses.push({
      id: newClass.id,
      name: newClass.name,
      gradeId: newClass.gradeId,
      gradeName: newClass.grade.name,
      gradeLevel: newClass.grade.level,
      academicYearId: newClass.academicYearId,
      academicYearName: newClass.academicYear.name,
      studentCount: 0,
      examCount: 0,
      createdAt: newClass.createdAt,
    });
  }

  return {
    created: createdClasses,
    skipped: skippedNames,
    totalCreated: createdClasses.length,
    totalSkipped: skippedNames.length,
  };
}

/**
 * Delete class safely with cascade cleanup
 */
export async function deleteClass(classId) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      _count: {
        select: {
          enrollments: true,
          exams: true,
        },
      },
    },
  });

  if (!cls) {
    throw new AppError("Lớp học không tồn tại.", 404, "CLASS_NOT_FOUND");
  }

  await prisma.$transaction(async (tx) => {
    // Xóa liên kết học sinh trong lớp
    await tx.studentEnrollment.deleteMany({ where: { classId } });

    // Xóa phân công giảng dạy
    await tx.teachingAssignment.deleteMany({ where: { classId } });

    // Nếu có kỳ thi thuộc lớp này, xóa liên kết hoặc xóa kỳ thi nếu cần
    const exams = await tx.exam.findMany({ where: { classId } });
    for (const exam of exams) {
      const subIds = (await tx.examSubmission.findMany({ where: { examId: exam.id }, select: { id: true } })).map(s => s.id);
      if (subIds.length > 0) {
        await tx.submissionAnswer.deleteMany({ where: { submissionId: { in: subIds } } });
        await tx.examSubmissionAuditLog.deleteMany({ where: { submissionId: { in: subIds } } });
        await tx.examSubmission.deleteMany({ where: { id: { in: subIds } } });
      }
      await tx.examResultPublicationLog.deleteMany({ where: { examId: exam.id } });
      await tx.examCandidate.deleteMany({ where: { examId: exam.id } });
      const examCodes = await tx.examCode.findMany({ where: { examId: exam.id }, select: { id: true } });
      await tx.answerKey.deleteMany({ where: { examCodeId: { in: examCodes.map(c => c.id) } } });
      await tx.examCode.deleteMany({ where: { examId: exam.id } });
      await tx.answerSheetTemplate.deleteMany({ where: { examId: exam.id } });
      await tx.exam.delete({ where: { id: exam.id } });
    }

    // Xóa lớp
    await tx.class.delete({ where: { id: classId } });
  });

  return {
    id: cls.id,
    name: cls.name,
    message: `Đã xóa lớp học "${cls.name}" thành công.`,
  };
}

/**
 * Update class details (name and/or grade)
 */
export async function updateClass(classId, { name, gradeId }) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      grade: true,
      academicYear: true,
      _count: { select: { enrollments: true, exams: true } },
    },
  });

  if (!cls) {
    throw new AppError("Lớp học không tồn tại.", 404, "CLASS_NOT_FOUND");
  }

  const updateData = {};

  if (name && name.trim() !== cls.name) {
    const trimmedName = name.trim();
    const duplicate = await prisma.class.findFirst({
      where: {
        academicYearId: cls.academicYearId,
        name: { equals: trimmedName, mode: "insensitive" },
        id: { not: classId },
      },
    });

    if (duplicate) {
      throw new AppError(
        `Lớp "${trimmedName}" đã tồn tại trong năm học ${cls.academicYear.name}.`,
        409,
        "CLASS_ALREADY_EXISTS"
      );
    }
    updateData.name = trimmedName;
  }

  if (gradeId && gradeId !== cls.gradeId) {
    const grade = await prisma.grade.findUnique({ where: { id: gradeId } });
    if (!grade) {
      throw new AppError("Khối học không tồn tại.", 404, "GRADE_NOT_FOUND");
    }
    updateData.gradeId = grade.id;
  }

  const updated = await prisma.class.update({
    where: { id: classId },
    data: updateData,
    include: {
      grade: true,
      academicYear: true,
      _count: { select: { enrollments: true, exams: true } },
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    gradeId: updated.gradeId,
    gradeName: updated.grade.name,
    gradeLevel: updated.grade.level,
    academicYearId: updated.academicYearId,
    academicYearName: updated.academicYear.name,
    studentCount: updated._count.enrollments,
    examCount: updated._count.exams,
    createdAt: updated.createdAt,
  };
}

/**
 * List all students in a class, sorted by Vietnamese Name (Tên A-Z, then Họ đệm)
 */
export async function listClassStudents(classId) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
  });

  if (!cls) {
    throw new AppError("Lớp học không tồn tại.", 404, "CLASS_NOT_FOUND");
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: { classId },
    include: {
      student: {
        include: {
          user: {
            select: {
              email: true,
              status: true,
            },
          },
        },
      },
    },
  });

  // Sort by Vietnamese name (Tên A-Z, then Họ đệm)
  enrollments.sort((a, b) =>
    compareVietnameseNames(a.student.fullName, b.student.fullName)
  );

  return enrollments.map((en) => ({
    enrollmentId: en.id,
    studentId: en.student.id,
    studentCode: en.student.studentCode,
    fullName: en.student.fullName,
    dateOfBirth: en.student.dateOfBirth,
    email: en.student.user?.email || null,
    initialPassword: en.student.initialPassword || DEFAULT_STUDENT_PASSWORD,
    status: en.student.user?.status || "ACTIVE",
    enrolledAt: en.createdAt,
  }));
}

/**
 * Helper to generate or format email for student: className_sbd@digitalexam.edu.vn
 */
export function makeStudentEmail(className, studentCode, customEmail) {
  if (customEmail && customEmail.trim()) {
    return customEmail.trim().toLowerCase();
  }
  const cleanClass = (className || "lop").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const rawCode = (studentCode || "0").trim();
  const paddedCode = /^\d+$/.test(rawCode) && rawCode.length === 1 ? `0${rawCode}` : rawCode;
  const cleanCode = paddedCode.replace(/[^a-zA-Z0-9]/g, "");
  return `${cleanClass}_${cleanCode}@digitalexam.edu.vn`.toLowerCase();
}

/**
 * Add a student manually to a class
 */
export async function addStudentToClass(classId, { studentCode, fullName, dateOfBirth, email, password }) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
  });

  if (!cls) {
    throw new AppError("Lớp học không tồn tại.", 404, "CLASS_NOT_FOUND");
  }

  const cleanCode = studentCode.trim();
  const cleanName = fullName.trim();
  const studentPassword = (password && password.trim()) || DEFAULT_STUDENT_PASSWORD;

  // Parse DOB if provided
  let parsedDob = null;
  if (dateOfBirth) {
    const d = new Date(dateOfBirth);
    if (!isNaN(d.getTime())) {
      parsedDob = d;
    }
  }

  // Check if student with studentCode already exists
  let student = await prisma.student.findUnique({
    where: { studentCode: cleanCode },
    include: { user: true },
  });

  if (student) {
    // Check if already in this class
    const existingEnrollment = await prisma.studentEnrollment.findFirst({
      where: {
        studentId: student.id,
        classId: cls.id,
        academicYearId: cls.academicYearId,
      },
    });

    if (existingEnrollment) {
      throw new AppError(
        `Học sinh có mã "${cleanCode}" đã có trong lớp này.`,
        409,
        "STUDENT_ALREADY_IN_CLASS"
      );
    }

    // Enroll into class
    const enrollment = await prisma.studentEnrollment.create({
      data: {
        studentId: student.id,
        classId: cls.id,
        academicYearId: cls.academicYearId,
      },
    });

    return {
      enrollmentId: enrollment.id,
      studentId: student.id,
      studentCode: student.studentCode,
      fullName: student.fullName,
      dateOfBirth: student.dateOfBirth,
      email: student.user.email,
      initialPassword: student.initialPassword || DEFAULT_STUDENT_PASSWORD,
      status: student.user.status,
    };
  }

  // Create new User + Student + StudentEnrollment
  const finalEmail = makeStudentEmail(cls.name, cleanCode, email);

  // Check email conflict
  const existingUser = await prisma.user.findUnique({
    where: { email: finalEmail },
  });

  const uniqueEmail = existingUser
    ? `${cls.name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}_${cleanCode}_${Date.now().toString().slice(-4)}@digitalexam.edu.vn`.toLowerCase()
    : finalEmail;

  const passwordHash = await bcrypt.hash(studentPassword, DEFAULT_SALT_ROUNDS);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: uniqueEmail,
        passwordHash,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });

    const newStudent = await tx.student.create({
      data: {
        userId: user.id,
        studentCode: cleanCode,
        fullName: cleanName,
        dateOfBirth: parsedDob,
        initialPassword: studentPassword,
      },
    });

    const enrollment = await tx.studentEnrollment.create({
      data: {
        studentId: newStudent.id,
        classId: cls.id,
        academicYearId: cls.academicYearId,
      },
    });

    return {
      enrollmentId: enrollment.id,
      studentId: newStudent.id,
      studentCode: newStudent.studentCode,
      fullName: newStudent.fullName,
      dateOfBirth: newStudent.dateOfBirth,
      email: user.email,
      initialPassword: newStudent.initialPassword || studentPassword,
      status: user.status,
    };
  });

  return result;
}

/**
 * Remove a student from class
 */
export async function removeStudentFromClass(classId, studentId) {
  const enrollment = await prisma.studentEnrollment.findFirst({
    where: {
      classId,
      studentId,
    },
  });

  if (!enrollment) {
    throw new AppError(
      "Học sinh không tồn tại trong lớp học này.",
      404,
      "STUDENT_NOT_IN_CLASS"
    );
  }

  await prisma.studentEnrollment.delete({
    where: { id: enrollment.id },
  });

  return { message: "Đã xóa học sinh khỏi lớp học thành công." };
}

/**
 * Update student info in a class
 */
export async function updateStudent(classId, studentId, { studentCode, fullName, dateOfBirth, email, password }) {
  const enrollment = await prisma.studentEnrollment.findFirst({
    where: { classId, studentId },
    include: {
      student: {
        include: { user: true },
      },
    },
  });

  if (!enrollment) {
    throw new AppError("Học sinh không tồn tại trong lớp học này.", 404, "STUDENT_NOT_IN_CLASS");
  }

  const student = enrollment.student;

  // If changing studentCode, check duplicate
  if (studentCode && studentCode.trim() !== student.studentCode) {
    const cleanCode = studentCode.trim();
    const existing = await prisma.student.findUnique({
      where: { studentCode: cleanCode },
    });
    if (existing && existing.id !== studentId) {
      throw new AppError(
        `Mã học sinh/SBD "${cleanCode}" đã được sử dụng bởi học sinh khác.`,
        409,
        "STUDENT_CODE_ALREADY_EXISTS"
      );
    }
  }

  // If changing email, check duplicate user email
  if (email && email.trim() && student.userId) {
    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });
    if (existingUser && existingUser.id !== student.userId) {
      throw new AppError(
        `Email "${cleanEmail}" đã được sử dụng bởi tài khoản khác.`,
        409,
        "EMAIL_ALREADY_EXISTS"
      );
    }
  }

  const updatedStudent = await prisma.$transaction(async (tx) => {
    const sData = {};
    if (studentCode) sData.studentCode = studentCode.trim();
    if (fullName) sData.fullName = fullName.trim();
    if (dateOfBirth !== undefined) {
      sData.dateOfBirth = dateOfBirth ? parseExcelDate(dateOfBirth) : null;
    }
    if (password && password.trim()) {
      sData.initialPassword = password.trim();
    }

    const s = await tx.student.update({
      where: { id: studentId },
      data: sData,
    });

    let userEmail = student.user?.email || "";
    const uData = {};
    if (email && email.trim()) {
      uData.email = email.trim().toLowerCase();
    }
    if (password && password.trim()) {
      uData.passwordHash = await bcrypt.hash(password.trim(), DEFAULT_SALT_ROUNDS);
    }

    if (student.userId && Object.keys(uData).length > 0) {
      const u = await tx.user.update({
        where: { id: student.userId },
        data: uData,
      });
      userEmail = u.email;
    }

    return {
      enrollmentId: enrollment.id,
      studentId: s.id,
      studentCode: s.studentCode,
      fullName: s.fullName,
      dateOfBirth: s.dateOfBirth,
      email: userEmail,
      initialPassword: s.initialPassword || DEFAULT_STUDENT_PASSWORD,
      status: student.user?.status || "ACTIVE",
    };
  });

  return updatedStudent;
}

/**
 * Helper to safely extract cell text
 */
function getCellString(cell) {
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
function parseExcelDate(cellValue) {
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

    // Check if row has any non-empty cell
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
    studentCodeCol,
    fullNameCol,
    lastNameCol,
    firstNameCol,
    dobCol,
  } = mapping;

  if (!studentCodeCol) {
    throw new AppError("Vui lòng chọn cột Số báo danh / Mã học sinh.", 400, "MISSING_STUDENT_CODE_COL");
  }

  if (!fullNameCol && (!lastNameCol || !firstNameCol)) {
    throw new AppError("Vui lòng chọn cột Họ và tên (hoặc cả 2 cột Họ đệm và Tên).", 400, "MISSING_NAME_COL");
  }

  const passwordHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, DEFAULT_SALT_ROUNDS);
  let importedCount = 0;
  let skippedCount = 0;
  const errors = [];

  const rowsToProcess = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return;

    const studentCodeRaw = getCellString(row.getCell(studentCodeCol));
    if (!studentCodeRaw) return;

    let fullName = "";
    if (fullNameCol) {
      fullName = getCellString(row.getCell(fullNameCol));
    } else if (lastNameCol && firstNameCol) {
      const l = getCellString(row.getCell(lastNameCol));
      const f = getCellString(row.getCell(firstNameCol));
      fullName = `${l} ${f}`.trim();
    }

    if (!fullName) {
      errors.push(`Dòng ${rowNumber}: Không có họ tên cho mã "${studentCodeRaw}". Bỏ qua.`);
      return;
    }

    let parsedDob = null;
    if (dobCol) {
      const dobCell = row.getCell(dobCol);
      parsedDob = parseExcelDate(dobCell.value);
    }

    rowsToProcess.push({
      rowNumber,
      studentCode: studentCodeRaw.trim(),
      fullName: fullName.trim(),
      dateOfBirth: parsedDob,
    });
  });

  if (rowsToProcess.length === 0) {
    throw new AppError("Không tìm thấy dữ liệu học sinh hợp lệ nào trong file.", 400, "NO_VALID_ROWS");
  }

  // Process rows sequentially to prevent duplicate creation race conditions
  for (const item of rowsToProcess) {
    try {
      let student = await prisma.student.findUnique({
        where: { studentCode: item.studentCode },
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
      }

      // Check enrollment
      const existingEnrollment = await prisma.studentEnrollment.findFirst({
        where: {
          studentId: student.id,
          classId: cls.id,
          academicYearId: cls.academicYearId,
        },
      });

      if (existingEnrollment) {
        skippedCount++;
      } else {
        await prisma.studentEnrollment.create({
          data: {
            studentId: student.id,
            classId: cls.id,
            academicYearId: cls.academicYearId,
          },
        });
        importedCount++;
      }
    } catch (err) {
      errors.push(`Dòng ${item.rowNumber} (${item.studentCode}): ${err.message}`);
    }
  }

  return {
    totalRows: rowsToProcess.length,
    importedCount,
    skippedCount,
    errors,
  };
}

/**
 * Xóa nhiều lớp học được chọn
 */
export async function bulkDeleteClasses(classIds = []) {
  if (!Array.isArray(classIds) || classIds.length === 0) {
    throw new AppError("Danh sách lớp cần xóa không hợp lệ.", 400, "INVALID_CLASS_IDS");
  }

  let deletedCount = 0;
  for (const cid of classIds) {
    try {
      await deleteClass(cid);
      deletedCount++;
    } catch (err) {
      console.warn(`Could not delete class ${cid}:`, err.message);
    }
  }

  return {
    deletedCount,
    message: `Đã xóa thành công ${deletedCount} lớp học.`,
  };
}

/**
 * Xóa toàn bộ học sinh trong một lớp học
 */
export async function clearClassStudents(classId) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
  });
  if (!cls) {
    throw new AppError("Lớp học không tồn tại.", 404, "CLASS_NOT_FOUND");
  }

  const deleteResult = await prisma.studentEnrollment.deleteMany({
    where: { classId },
  });

  return {
    classId,
    className: cls.name,
    deletedCount: deleteResult.count,
    message: `Đã xóa toàn bộ ${deleteResult.count} học sinh khỏi lớp "${cls.name}".`,
  };
}

/**
 * Xóa danh sách học sinh được chọn khỏi một lớp học
 */
export async function bulkRemoveStudentsFromClass(classId, studentIds = []) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
  });
  if (!cls) {
    throw new AppError("Lớp học không tồn tại.", 404, "CLASS_NOT_FOUND");
  }

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw new AppError("Danh sách học sinh cần xóa không hợp lệ.", 400, "INVALID_STUDENT_IDS");
  }

  const deleteResult = await prisma.studentEnrollment.deleteMany({
    where: {
      classId,
      studentId: { in: studentIds },
    },
  });

  return {
    classId,
    className: cls.name,
    deletedCount: deleteResult.count,
    message: `Đã xóa ${deleteResult.count} học sinh khỏi lớp "${cls.name}".`,
  };
}

/**
 * Helper to generate smart 6-digit SBD (Số Báo Danh)
 * Format KKLLSS (6 digits):
 * KK: 2-digit grade level (e.g. 06, 09, 12)
 * LL: 2-digit class number in grade (e.g. 9C06 -> 06, 12A01 -> 01, 10A2 -> 02, 6A -> 01)
 * SS: 2-digit student index in class (e.g. 01, 02, ..., 45)
 */
export function generateSmartSbd(className = "", gradeLevel = null, studentIndex = 1) {
  // 1. Khối học (2 số): KK
  let kk = "00";
  if (gradeLevel && !isNaN(parseInt(gradeLevel, 10))) {
    kk = String(parseInt(gradeLevel, 10)).padStart(2, "0");
  } else {
    const mGrade = (className || "").match(/^(\d{1,2})/);
    if (mGrade) {
      kk = String(parseInt(mGrade[1], 10)).padStart(2, "0");
    }
  }

  // 2. Mã lớp (2 số): LL
  let ll = "01";
  const mClassNum = (className || "").match(/^(\d{1,2})[A-Za-z_-]*(\d+)/);
  if (mClassNum && mClassNum[2]) {
    ll = String(parseInt(mClassNum[2], 10)).padStart(2, "0");
  } else {
    const mLetter = (className || "").match(/^(\d{1,2})([A-Za-z])/);
    if (mLetter && mLetter[2]) {
      const code = mLetter[2].toUpperCase().charCodeAt(0) - 64;
      if (code >= 1 && code <= 99) {
        ll = String(code).padStart(2, "0");
      }
    }
  }

  // 3. Số thứ tự trong lớp (2 số): SS
  const ss = String(Math.max(1, parseInt(studentIndex, 10) || 1)).padStart(2, "0");

  return `${kk}${ll}${ss}`;
}

/**
 * Chuẩn hóa Số Báo Danh toàn bộ học sinh trong lớp theo format 6 chữ số: KKLLSS
 */
export async function standardizeClassSbd(classId) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      grade: true,
      enrollments: {
        include: {
          student: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  });

  if (!cls) {
    throw new AppError("Lớp học không tồn tại.", 404, "CLASS_NOT_FOUND");
  }

  // Sắp xếp theo tên chuẩn tiếng Việt (Tên A-Z, rồi Họ đệm)
  const enrollments = [...cls.enrollments];
  enrollments.sort((a, b) =>
    compareVietnameseNames(a.student.fullName, b.student.fullName)
  );

  const updatedStudents = [];

  await prisma.$transaction(async (tx) => {
    // Pass 1: Đổi studentCode tạm để tránh đụng unique constraint nếu hoán vị SBD
    for (let i = 0; i < enrollments.length; i++) {
      const student = enrollments[i].student;
      await tx.student.update({
        where: { id: student.id },
        data: { studentCode: `temp_${student.id}_${Date.now()}_${i}` },
      });
    }

    // Pass 2: Gán SBD 6 chữ số chuẩn và đồng bộ email tra cứu
    for (let i = 0; i < enrollments.length; i++) {
      const student = enrollments[i].student;
      let newSbd = generateSmartSbd(cls.name, cls.grade?.level, i + 1);

      // Tránh va chạm với studentCode của lớp khác nếu có
      let collisionOffset = 0;
      while (true) {
        const collision = await tx.student.findUnique({ where: { studentCode: newSbd } });
        if (!collision || collision.id === student.id) {
          break;
        }
        collisionOffset++;
        newSbd = generateSmartSbd(cls.name, cls.grade?.level, i + 1 + collisionOffset);
      }

      const updatedS = await tx.student.update({
        where: { id: student.id },
        data: { studentCode: newSbd },
      });

      const newEmail = makeStudentEmail(cls.name, newSbd);
      let finalEmail = student.user?.email;
      if (student.userId) {
        // Cập nhật email tài khoản tra cứu nếu chưa bị tài khoản khác sử dụng
        const emailCollision = await tx.user.findUnique({ where: { email: newEmail } });
        if (!emailCollision || emailCollision.id === student.userId) {
          const updatedU = await tx.user.update({
            where: { id: student.userId },
            data: { email: newEmail },
          });
          finalEmail = updatedU.email;
        }
      }

      // Đồng bộ studentNumber trong ExamCandidate nếu kỳ thi DRAFT
      await tx.examCandidate.updateMany({
        where: {
          studentId: student.id,
          exam: { status: "DRAFT" },
        },
        data: { studentNumber: newSbd },
      });

      updatedStudents.push({
        enrollmentId: enrollments[i].id,
        studentId: updatedS.id,
        studentCode: updatedS.studentCode,
        newSbd: updatedS.studentCode,
        fullName: updatedS.fullName,
        dateOfBirth: updatedS.dateOfBirth,
        email: finalEmail || newEmail,
        initialPassword: updatedS.initialPassword || DEFAULT_STUDENT_PASSWORD,
        status: student.user?.status || "ACTIVE",
        enrolledAt: enrollments[i].createdAt,
      });
    }
  });

  return {
    classId: cls.id,
    className: cls.name,
    totalStandardized: updatedStudents.length,
    students: updatedStudents,
    message: `Đã chuẩn hóa thành công SBD 6 chữ số cho ${updatedStudents.length} học sinh lớp "${cls.name}".`,
  };
}

