import path from "node:path";
import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import { storageService, getSafeExtensionFromMime } from "./storage/storage.service.js";

const SALT_ROUNDS = 12;

/**
 * Lấy thông tin hồ sơ của người dùng hiện tại (Giáo viên, Học sinh hoặc Quản trị viên).
 */
export async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      avatarUrl: true,
      fullName: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
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
      fullName: student.fullName || user.fullName,
      phone: user.phone || null,
      avatarUrl: user.avatarUrl || null,
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
      fullName: teacher.fullName || user.fullName,
      phone: teacher.phone || user.phone || null,
      avatarUrl: user.avatarUrl || null,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: teacher.createdAt,
      updatedAt: teacher.updatedAt,
    };
  }

  // Quản trị viên (ADMIN) hoặc vai trò khác
  return {
    id: user.id,
    userId: user.id,
    fullName: user.fullName || "Quản trị viên",
    phone: user.phone || null,
    avatarUrl: user.avatarUrl || null,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Cập nhật thông tin hồ sơ cho mọi vai trò (Admin, Teacher, Student).
 */
export async function updateProfile(userId, { fullName, phone }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true, status: true, avatarUrl: true },
  });

  if (!user) {
    throw new AppError("Người dùng không tồn tại.", 404, "USER_NOT_FOUND");
  }

  const cleanFullName = fullName !== undefined ? fullName.trim() : undefined;
  const cleanPhone = phone !== undefined ? (phone ? phone.trim() : null) : undefined;

  // Cập nhật bảng User
  const userUpdateData = {};
  if (cleanFullName) userUpdateData.fullName = cleanFullName;
  if (cleanPhone !== undefined) userUpdateData.phone = cleanPhone;

  if (Object.keys(userUpdateData).length > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: userUpdateData,
    });
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

    const studentUpdateData = {};
    if (cleanFullName) studentUpdateData.fullName = cleanFullName;

    const updatedStudent = await prisma.student.update({
      where: { userId },
      data: studentUpdateData,
    });

    return {
      id: updatedStudent.id,
      userId: updatedStudent.userId,
      studentCode: updatedStudent.studentCode,
      fullName: updatedStudent.fullName,
      phone: cleanPhone !== undefined ? cleanPhone : user.phone,
      avatarUrl: user.avatarUrl,
      dateOfBirth: updatedStudent.dateOfBirth,
      classroomName: student.enrollments?.[0]?.class?.name || null,
      email: user.email,
      role: user.role,
      status: user.status,
      updatedAt: updatedStudent.updatedAt,
    };
  }

  if (user.role === "TEACHER") {
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

    const teacherUpdateData = {};
    if (cleanFullName) teacherUpdateData.fullName = cleanFullName;
    if (cleanPhone !== undefined) teacherUpdateData.phone = cleanPhone;

    const updatedTeacher = await prisma.teacher.update({
      where: { userId },
      data: teacherUpdateData,
    });

    return {
      id: updatedTeacher.id,
      userId: teacher.userId,
      teacherCode: updatedTeacher.teacherCode,
      fullName: updatedTeacher.fullName,
      phone: updatedTeacher.phone,
      avatarUrl: user.avatarUrl,
      email: user.email,
      role: user.role,
      status: user.status,
      updatedAt: updatedTeacher.updatedAt,
    };
  }

  // ADMIN
  const updatedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      phone: true,
      avatarUrl: true,
      email: true,
      role: true,
      status: true,
      updatedAt: true,
    },
  });

  return {
    id: updatedUser.id,
    userId: updatedUser.id,
    fullName: updatedUser.fullName || "Quản trị viên",
    phone: updatedUser.phone || null,
    avatarUrl: updatedUser.avatarUrl || null,
    email: updatedUser.email,
    role: updatedUser.role,
    status: updatedUser.status,
    updatedAt: updatedUser.updatedAt,
  };
}

/**
 * Tải lên và cập nhật ảnh đại diện người dùng.
 */
export async function updateAvatar(userId, { buffer, mimeType }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, avatarUrl: true },
  });

  if (!user) {
    throw new AppError("Người dùng không tồn tại.", 404, "USER_NOT_FOUND");
  }

  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new AppError("Dữ liệu ảnh không hợp lệ.", 400, "INVALID_AVATAR_BUFFER");
  }

  const ext = getSafeExtensionFromMime(mimeType);
  const filename = `${userId}_${Date.now()}.${ext}`;
  const storageKey = `avatars/${filename}`;

  await storageService.saveFile(storageKey, buffer);

  // Xóa ảnh đại diện cũ trên local storage nếu có
  if (user.avatarUrl && user.avatarUrl.includes("/avatar/")) {
    const oldFilename = path.basename(user.avatarUrl);
    await storageService.deleteFile(`avatars/${oldFilename}`).catch(() => {});
  }

  const publicAvatarUrl = `/api/profile/avatar/${filename}`;

  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: publicAvatarUrl },
  });

  return { avatarUrl: publicAvatarUrl };
}

/**
 * Lấy stream ảnh đại diện để phục vụ public.
 */
export async function getAvatarStream(filename) {
  if (!filename || typeof filename !== "string") {
    throw new AppError("Tên file không hợp lệ.", 400, "INVALID_FILENAME");
  }

  const safeFilename = path.basename(filename);
  const storageKey = `avatars/${safeFilename}`;

  const exists = await storageService.fileExists(storageKey);
  if (!exists) {
    throw new AppError("Không tìm thấy ảnh đại diện.", 404, "AVATAR_NOT_FOUND");
  }

  const ext = path.extname(safeFilename).toLowerCase();
  let mimeType = "image/jpeg";
  if (ext === ".png") mimeType = "image/png";
  else if (ext === ".webp") mimeType = "image/webp";

  const stream = storageService.getFileStream(storageKey);
  return { stream, mimeType };
}

/**
 * Đổi mật khẩu người dùng.
 */
export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError("Người dùng không tồn tại.", 404, "USER_NOT_FOUND");
  }

  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) {
    throw new AppError(
      "Mật khẩu hiện tại không chính xác.",
      400,
      "CURRENT_PASSWORD_INCORRECT"
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Cập nhật mật khẩu và thu hồi các refresh token cũ
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
    message: "Đổi mật khẩu thành công. Vui lòng sử dụng mật khẩu mới.",
  };
}

