import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";

const SALT_ROUNDS = 12;

/**
 * Lay thong tin ho so cua giao vien hien tai.
 */
export async function getProfile(userId) {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
        },
      },
    },
  });

  if (!teacher) {
    throw new AppError(
      "Ho so giao vien khong ton tai hoac ban khong co quyen truy cap.",
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
    email: teacher.user.email,
    role: teacher.user.role,
    status: teacher.user.status,
    createdAt: teacher.createdAt,
    updatedAt: teacher.updatedAt,
  };
}

/**
 * Cap nhat thong tin ho so (Chi fullName va phone).
 * Tat ca cac truong nhay cam khac (role, status, email, teacherCode) deu bi bo qua.
 */
export async function updateProfile(userId, { fullName, phone }) {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
        },
      },
    },
  });

  if (!teacher) {
    throw new AppError(
      "Ho so giao vien khong ton tai.",
      404,
      "TEACHER_PROFILE_NOT_FOUND"
    );
  }

  const dataToUpdate = {};
  if (fullName !== undefined) {
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
    email: teacher.user.email,
    role: teacher.user.role,
    status: teacher.user.status,
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
