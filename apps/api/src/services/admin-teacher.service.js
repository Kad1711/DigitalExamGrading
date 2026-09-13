import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";

const SALT_ROUNDS = 12;

/**
 * Danh sach giao vien danh cho Quan tri vien.
 */
export async function listTeachers({ search, status } = {}) {
  const where = {
    user: {
      role: "TEACHER",
      ...(status ? { status } : {}),
    },
  };

  if (search && search.trim() !== "") {
    const term = search.trim();
    where.OR = [
      { fullName: { contains: term, mode: "insensitive" } },
      { teacherCode: { contains: term, mode: "insensitive" } },
      { user: { email: { contains: term, mode: "insensitive" } } },
    ];
  }

  const teachers = await prisma.teacher.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
      },
      _count: {
        select: { exams: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return teachers.map((t) => ({
    id: t.id,
    userId: t.userId,
    teacherCode: t.teacherCode,
    fullName: t.fullName,
    phone: t.phone,
    email: t.user.email,
    role: t.user.role,
    status: t.user.status,
    examCount: t._count?.exams || 0,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));
}

/**
 * Tao tai khoan giao vien moi (Atomic Transaction).
 * Bat buoc role = TEACHER, status = ACTIVE.
 */
export async function createTeacher({
  fullName,
  teacherCode,
  email,
  initialPassword,
  phone,
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = teacherCode.trim().toUpperCase();

  // Kiem tra trung lap email
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingUser) {
    throw new AppError(
      "Email nay da duoc su dung.",
      409,
      "EMAIL_ALREADY_EXISTS"
    );
  }

  // Kiem tra trung lap teacherCode
  const existingTeacher = await prisma.teacher.findUnique({
    where: { teacherCode: normalizedCode },
  });
  if (existingTeacher) {
    throw new AppError(
      "Ma giao vien nay da duoc su dung.",
      409,
      "TEACHER_CODE_ALREADY_EXISTS"
    );
  }

  const passwordHash = await bcrypt.hash(initialPassword, SALT_ROUNDS);

  // Thuc hien tao nguoi dung va ho so giao vien trong cung transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: "TEACHER", // Luon ep role la TEACHER, ngan chan tuyet doi leo thang dac quyen
        status: "ACTIVE",
      },
    });

    const teacher = await tx.teacher.create({
      data: {
        userId: user.id,
        teacherCode: normalizedCode,
        fullName: fullName.trim(),
        phone: phone ? phone.trim() : null,
      },
    });

    return {
      id: teacher.id,
      userId: user.id,
      teacherCode: teacher.teacherCode,
      fullName: teacher.fullName,
      phone: teacher.phone,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: teacher.createdAt,
    };
  });

  return result;
}

/**
 * Chi tiet giao vien theo ID.
 */
export async function getTeacherById(teacherId) {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      _count: {
        select: { exams: true },
      },
    },
  });

  if (!teacher) {
    throw new AppError(
      "Khong tim thay giao vien.",
      404,
      "TEACHER_NOT_FOUND"
    );
  }

  return {
    id: teacher.id,
    userId: teacher.userId,
    teacherCode: teacher.teacherCode,
    fullName: teacher.fullName,
    phone: teacher.phone,
    email: teacher.user.email,
    role: teacher.user.role,
    status: teacher.user.status,
    examCount: teacher._count?.exams || 0,
    createdAt: teacher.createdAt,
    updatedAt: teacher.updatedAt,
  };
}

/**
 * Chinh sua thong tin co ban cua giao vien.
 * Khong cho phep doi role hay status o day.
 */
export async function updateTeacher(teacherId, data) {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: { user: true },
  });

  if (!teacher) {
    throw new AppError(
      "Khong tim thay giao vien.",
      404,
      "TEACHER_NOT_FOUND"
    );
  }

  const userUpdates = {};
  const teacherUpdates = {};

  if (data.email) {
    const normalizedEmail = data.email.trim().toLowerCase();
    if (normalizedEmail !== teacher.user.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (emailTaken) {
        throw new AppError(
          "Email nay da duoc su dung.",
          409,
          "EMAIL_ALREADY_EXISTS"
        );
      }
      userUpdates.email = normalizedEmail;
    }
  }

  if (data.teacherCode) {
    const normalizedCode = data.teacherCode.trim().toUpperCase();
    if (normalizedCode !== teacher.teacherCode) {
      const codeTaken = await prisma.teacher.findUnique({
        where: { teacherCode: normalizedCode },
      });
      if (codeTaken) {
        throw new AppError(
          "Ma giao vien nay da duoc su dung.",
          409,
          "TEACHER_CODE_ALREADY_EXISTS"
        );
      }
      teacherUpdates.teacherCode = normalizedCode;
    }
  }

  if (data.fullName !== undefined) {
    teacherUpdates.fullName = data.fullName.trim();
  }

  if (data.phone !== undefined) {
    teacherUpdates.phone = data.phone ? data.phone.trim() : null;
  }

  const result = await prisma.$transaction(async (tx) => {
    let updatedUser = teacher.user;
    if (Object.keys(userUpdates).length > 0) {
      updatedUser = await tx.user.update({
        where: { id: teacher.userId },
        data: userUpdates,
      });
    }

    let updatedTeacher = teacher;
    if (Object.keys(teacherUpdates).length > 0) {
      updatedTeacher = await tx.teacher.update({
        where: { id: teacherId },
        data: teacherUpdates,
      });
    }

    return {
      id: updatedTeacher.id,
      userId: updatedUser.id,
      teacherCode: updatedTeacher.teacherCode,
      fullName: updatedTeacher.fullName,
      phone: updatedTeacher.phone,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status,
      updatedAt: updatedTeacher.updatedAt,
    };
  });

  return result;
}

/**
 * Khoa tai khoan giao vien va thu hoi toan bo refresh token.
 */
export async function lockTeacher(teacherId) {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: { user: true },
  });

  if (!teacher) {
    throw new AppError(
      "Khong tim thay giao vien.",
      404,
      "TEACHER_NOT_FOUND"
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: teacher.userId },
      data: { status: "LOCKED" },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: teacher.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return {
    id: teacher.id,
    userId: teacher.userId,
    status: "LOCKED",
    message: "Tai khoan giao vien da bi khoa thanh cong.",
  };
}

/**
 * Mo khoa tai khoan giao vien.
 */
export async function unlockTeacher(teacherId) {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
  });

  if (!teacher) {
    throw new AppError(
      "Khong tim thay giao vien.",
      404,
      "TEACHER_NOT_FOUND"
    );
  }

  await prisma.user.update({
    where: { id: teacher.userId },
    data: { status: "ACTIVE" },
  });

  return {
    id: teacher.id,
    userId: teacher.userId,
    status: "ACTIVE",
    message: "Tai khoan giao vien da duoc mo khoa thanh cong.",
  };
}

/**
 * Admin dat lai mat khau cho giao vien va thu hoi token cu.
 */
export async function resetTeacherPassword(teacherId, newPassword) {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
  });

  if (!teacher) {
    throw new AppError(
      "Khong tim thay giao vien.",
      404,
      "TEACHER_NOT_FOUND"
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: teacher.userId },
      data: { passwordHash },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: teacher.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return {
    id: teacher.id,
    message: "Mat khau cua giao vien da duoc dat lai thanh cong.",
  };
}

/**
 * Xoa tai khoan giao vien.
 * Bat buoc: Tai khoan phai o trang thai LOCKED (duyet 2 buoc).
 */
export async function deleteTeacher(teacherId) {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: {
      user: true,
      exams: {
        include: {
          submissions: true,
          examCodes: true,
        },
      },
    },
  });

  if (!teacher) {
    throw new AppError("Không tìm thấy giáo viên.", 404, "TEACHER_NOT_FOUND");
  }

  if (teacher.user.status !== "LOCKED") {
    throw new AppError(
      "Tài khoản giáo viên phải ở trạng thái ĐÃ KHÓA trước khi có thể xóa vĩnh viễn.",
      409,
      "TEACHER_NOT_LOCKED"
    );
  }

  await prisma.$transaction(async (tx) => {
    // Clean up teacher's exams if any
    for (const exam of teacher.exams) {
      const subIds = exam.submissions.map((s) => s.id);
      if (subIds.length > 0) {
        await tx.submissionAnswer.deleteMany({ where: { submissionId: { in: subIds } } });
        await tx.examSubmissionAuditLog.deleteMany({ where: { submissionId: { in: subIds } } });
        await tx.examSubmission.deleteMany({ where: { id: { in: subIds } } });
      }
      await tx.examResultPublicationLog.deleteMany({ where: { examId: exam.id } });
      await tx.examCandidate.deleteMany({ where: { examId: exam.id } });
      await tx.answerKey.deleteMany({ where: { examCodeId: { in: exam.examCodes.map((c) => c.id) } } });
      await tx.examCode.deleteMany({ where: { examId: exam.id } });
      await tx.answerSheetTemplate.deleteMany({ where: { examId: exam.id } });
      await tx.exam.delete({ where: { id: exam.id } });
    }

    // Delete teaching assignments
    await tx.teachingAssignment.deleteMany({ where: { teacherId } });

    // Delete refresh tokens
    await tx.refreshToken.deleteMany({ where: { userId: teacher.userId } });

    // Delete teacher & user
    await tx.teacher.delete({ where: { id: teacherId } });
    await tx.user.delete({ where: { id: teacher.userId } });
  });

  return {
    id: teacher.id,
    teacherCode: teacher.teacherCode,
    fullName: teacher.fullName,
    message: `Đã xóa vĩnh viễn tài khoản giáo viên "${teacher.fullName}" (${teacher.teacherCode}).`,
  };
}

/**
 * Xoa hang loat giao vien da khoa
 */
export async function bulkDeleteLockedTeachers(teacherIds = []) {
  if (!Array.isArray(teacherIds) || teacherIds.length === 0) {
    throw new AppError("Danh sách giáo viên cần xóa không hợp lệ.", 400, "INVALID_TEACHER_IDS");
  }

  let deletedCount = 0;
  for (const tid of teacherIds) {
    try {
      await deleteTeacher(tid);
      deletedCount++;
    } catch (err) {
      console.warn(`Could not delete teacher ${tid}:`, err.message);
    }
  }

  return {
    deletedCount,
    message: `Đã xóa thành công ${deletedCount} giáo viên đã bị khóa.`,
  };
}
