import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import { compareVietnameseNames } from "../utils/vietnamese-sort.js";
import { generateSmartSbd, makeStudentEmail } from "../utils/sbd-generator.js";

const DEFAULT_SALT_ROUNDS = 10;
const DEFAULT_STUDENT_PASSWORD = "123456";

/**
 * Helper to parse Date from various Excel formats
 */
function parseExcelDate(cellValue) {
  if (!cellValue) return null;
  if (cellValue instanceof Date) return cellValue;

  const str = String(cellValue).trim();
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

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

  let parsedDob = null;
  if (dateOfBirth) {
    const d = new Date(dateOfBirth);
    if (!isNaN(d.getTime())) {
      parsedDob = d;
    }
  }

  let student = await prisma.student.findUnique({
    where: { studentCode: cleanCode },
    include: { user: true },
  });

  if (student) {
    const existingEnrollmentInYear = await prisma.studentEnrollment.findFirst({
      where: {
        studentId: student.id,
        academicYearId: cls.academicYearId,
      },
      include: { class: true },
    });

    if (existingEnrollmentInYear) {
      if (existingEnrollmentInYear.classId === cls.id) {
        throw new AppError(
          `Học sinh có mã "${cleanCode}" đã có trong lớp này.`,
          409,
          "STUDENT_ALREADY_IN_CLASS"
        );
      } else {
        throw new AppError(
          `Mã học sinh "${cleanCode}" (${student.fullName}) đã được ghi danh vào lớp "${existingEnrollmentInYear.class.name}" trong năm học này. Mỗi học sinh chỉ được thuộc một lớp trong cùng một năm học.`,
          409,
          "STUDENT_ALREADY_IN_ANOTHER_CLASS"
        );
      }
    }

    if (cleanName && cleanName !== student.fullName) {
      await prisma.student.update({
        where: { id: student.id },
        data: {
          fullName: cleanName,
          ...(parsedDob ? { dateOfBirth: parsedDob } : {}),
        },
      });
    }

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

  const finalEmail = makeStudentEmail(cls.name, cleanCode, email);

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
 * Xóa toàn bộ học sinh trong một lớp học
 */
export async function clearClassStudents(classId) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
  });
  if (!cls) {
    throw new AppError("Lớp học không tồn tại.", 404, "CLASS_NOT_FOUND");
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: { classId },
    select: { studentId: true, student: { select: { id: true, userId: true } } },
  });

  const deleteResult = await prisma.studentEnrollment.deleteMany({
    where: { classId },
  });

  for (const item of enrollments) {
    if (item.student) {
      const otherEnrollmentCount = await prisma.studentEnrollment.count({
        where: { studentId: item.student.id },
      });
      const candidateCount = await prisma.examCandidate.count({
        where: { studentId: item.student.id },
      });
      if (otherEnrollmentCount === 0 && candidateCount === 0) {
        await prisma.user.delete({ where: { id: item.student.userId } }).catch(() => {});
      }
    }
  }

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

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      classId,
      studentId: { in: studentIds },
    },
    select: { studentId: true, student: { select: { id: true, userId: true } } },
  });

  const deleteResult = await prisma.studentEnrollment.deleteMany({
    where: {
      classId,
      studentId: { in: studentIds },
    },
  });

  for (const item of enrollments) {
    if (item.student) {
      const otherEnrollmentCount = await prisma.studentEnrollment.count({
        where: { studentId: item.student.id },
      });
      const candidateCount = await prisma.examCandidate.count({
        where: { studentId: item.student.id },
      });
      if (otherEnrollmentCount === 0 && candidateCount === 0) {
        await prisma.user.delete({ where: { id: item.student.userId } }).catch(() => {});
      }
    }
  }

  return {
    classId,
    className: cls.name,
    deletedCount: deleteResult.count,
    message: `Đã xóa ${deleteResult.count} học sinh khỏi lớp "${cls.name}".`,
  };
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

  const enrollments = [...cls.enrollments];
  enrollments.sort((a, b) =>
    compareVietnameseNames(a.student.fullName, b.student.fullName)
  );

  const updatedStudents = [];

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < enrollments.length; i++) {
      const student = enrollments[i].student;
      await tx.student.update({
        where: { id: student.id },
        data: { studentCode: `temp_${student.id}_${Date.now()}_${i}` },
      });
    }

    for (let i = 0; i < enrollments.length; i++) {
      const student = enrollments[i].student;
      let newSbd = generateSmartSbd(cls.name, cls.grade?.level, i + 1);

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
        const emailCollision = await tx.user.findUnique({ where: { email: newEmail } });
        if (!emailCollision || emailCollision.id === student.userId) {
          const updatedU = await tx.user.update({
            where: { id: student.userId },
            data: { email: newEmail },
          });
          finalEmail = updatedU.email;
        }
      }

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
