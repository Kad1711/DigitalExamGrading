import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";

const SALT_ROUNDS = 12;

/**
 * Lay thong tin ho so cua nguoi dung hien tai (Giao vien hoac Hoc sinh).
 */
export async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError("Người dùng không tồn tại.", 404, "USER_NOT_FOUND");
  }

  if (user.role === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        enrollments: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
                grade: { select: { level: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!student) {
      throw new AppError("Hồ sơ học sinh không tồn tại.", 404, "STUDENT_PROFILE_NOT_FOUND");
    }

    const primaryClass = student.enrollments?.[0]?.class?.name || null;
    return {
      id: student.id,
      userId: student.userId,
      studentCode: student.studentCode,
      fullName: student.fullName,
      dateOfBirth: student.dateOfBirth,
      classroomName: primaryClass,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
    };
  }

  if (user.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
    });

    if (!teacher) {
      throw new AppError(
        "Hồ sơ giáo viên không tồn tại hoặc bạn không có quyền truy cập.",
        404,
        "TEACHER_PROFILE_NOT_FOUND"
      );
    }

    return {
      id: teacher.id,
      userId: teacher.userId,
      teacherCode: teacher.teacherCode,
      fullName: teacher.fullName,
      phone: teacher.phone,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: teacher.createdAt,
      updatedAt: teacher.updatedAt,
    };
  }

  // Admin hoặc vai trò khác
  return {
    id: user.id,
    userId: user.id,
    fullName: "Quản trị viên",
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

/**
 * Cap nhat thong tin ho so.
 */
export async function updateProfile(userId, { fullName, phone }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true, status: true },
  });

  if (!user) {
    throw new AppError("Người dùng không tồn tại.", 404, "USER_NOT_FOUND");
  }

  if (user.role === "STUDENT") {
    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        enrollments: {
          include: {
            class: { select: { name: true } },
          },
        },
      },
    });

    if (!student) {
      throw new AppError("Hồ sơ học sinh không tồn tại.", 404, "STUDENT_PROFILE_NOT_FOUND");
    }

    const dataToUpdate = {};
    if (fullName !== undefined && fullName.trim()) {
      dataToUpdate.fullName = fullName.trim();
    }

    const updatedStudent = await prisma.student.update({
      where: { userId },
      data: dataToUpdate,
    });

    return {
      id: updatedStudent.id,
      userId: updatedStudent.userId,
      studentCode: updatedStudent.studentCode,
      fullName: updatedStudent.fullName,
      dateOfBirth: updatedStudent.dateOfBirth,
      classroomName: student.enrollments?.[0]?.class?.name || null,
      email: user.email,
      role: user.role,
      status: user.status,
      updatedAt: updatedStudent.updatedAt,
    };
  }

  const teacher = await prisma.teacher.findUnique({
    where: { userId },
  });

  if (!teacher) {
    throw new AppError(
      "Hồ sơ giáo viên không tồn tại.",
      404,
      "TEACHER_PROFILE_NOT_FOUND"
    );
  }

  const dataToUpdate = {};
  if (fullName !== undefined && fullName.trim()) {
    dataToUpdate.fullName = fullName.trim();
  }
  if (phone !== undefined) {
    dataToUpdate.phone = phone ? phone.trim() : null;
  }

  const updatedTeacher = await prisma.teacher.update({
    where: { userId },
    data: dataToUpdate,
  });

  return {
    id: updatedTeacher.id,
    userId: teacher.userId,
    teacherCode: updatedTeacher.teacherCode,
    fullName: updatedTeacher.fullName,
    phone: updatedTeacher.phone,
    email: user.email,
    role: user.role,
    status: user.status,
    updatedAt: updatedTeacher.updatedAt,
  };
}

/**
 * Doi mat khau nguoi dung.
 */
export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError("Nguoi dung khong ton tai.", 404, "USER_NOT_FOUND");
  }

  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) {
    throw new AppError(
      "Mat khau hien tai khong chinh xac.",
      400,
      "CURRENT_PASSWORD_INCORRECT"
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Cap nhat mat khau va thu hoi cac refresh token cu
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return {
    message: "Doi mat khau thanh cong. Vui long su dung mat khau moi.",
  };
}
