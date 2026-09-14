import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";
import { getNextTeacherCode } from "../utils/teacher-code.js";

// =====================================================
// HELPERS
// =====================================================

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" }
  );
}

function signRefreshToken(userId) {
  const jti = crypto.randomUUID();
  return jwt.sign(
    { sub: userId, jti },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
  );
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function tokenExpiresAt(token) {
  const decoded = jwt.decode(token);
  if (!decoded || !decoded.exp) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  return new Date(decoded.exp * 1000);
}

// =====================================================
// SERVICE METHODS
// =====================================================

export async function login(email, password) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      teacher: {
        select: {
          id: true,
          teacherCode: true,
          fullName: true,
          phone: true,
        },
      },
      student: {
        select: {
          id: true,
          studentCode: true,
          fullName: true,
          dateOfBirth: true,
          enrollments: {
            select: {
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
      },
    },
  });

  if (!user) {
    throw new AppError(
      "Email hoặc mật khẩu không chính xác.",
      401,
      "INVALID_CREDENTIALS"
    );
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    throw new AppError(
      "Email hoặc mật khẩu không chính xác.",
      401,
      "INVALID_CREDENTIALS"
    );
  }

  if (user.status === "PENDING_APPROVAL") {
    throw new AppError(
      "Tài khoản giáo viên của bạn đang chờ Quản trị viên phê duyệt.",
      403,
      "ACCOUNT_PENDING_APPROVAL"
    );
  }

  if (user.status !== "ACTIVE") {
    throw new AppError(
      "Tài khoản của bạn đã bị khóa hoặc chưa được kích hoạt.",
      403,
      "ACCOUNT_INACTIVE"
    );
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user.id);
  const tokenHash = hashToken(refreshToken);
  const expiresAt = tokenExpiresAt(refreshToken);

  await prisma.refreshToken.create({
    data: { tokenHash, userId: user.id, expiresAt },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      fullName: user.teacher?.fullName || user.student?.fullName || null,
      teacher: user.teacher || null,
      student: user.student || null,
    },
    accessToken,
    refreshToken,
  };
}

export async function refreshAccessToken(refreshToken) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new AppError(
        "Refresh token đã hết hạn. Vui lòng đăng nhập lại.",
        401,
        "REFRESH_TOKEN_EXPIRED"
      );
    }
    throw new AppError("Refresh token không hợp lệ.", 401, "INVALID_REFRESH_TOKEN");
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored) {
    throw new AppError("Refresh token không tồn tại.", 401, "INVALID_REFRESH_TOKEN");
  }
  if (stored.revokedAt) {
    throw new AppError("Refresh token đã bị thu hồi.", 401, "REFRESH_TOKEN_REVOKED");
  }
  if (stored.expiresAt < new Date()) {
    throw new AppError("Refresh token đã hết hạn.", 401, "REFRESH_TOKEN_EXPIRED");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    throw new AppError("Người dùng không tồn tại.", 401, "USER_NOT_FOUND");
  }
  if (user.status !== "ACTIVE") {
    throw new AppError(
      "Tài khoản của bạn đã bị khóa hoặc chưa được kích hoạt.",
      403,
      "ACCOUNT_INACTIVE"
    );
  }

  // Refresh Token Rotation
  await prisma.refreshToken.update({
    where: { tokenHash },
    data: { revokedAt: new Date() },
  });

  const newAccessToken = signAccessToken(user);
  const newRefreshToken = signRefreshToken(user.id);
  const newTokenHash = hashToken(newRefreshToken);
  const newExpiresAt = tokenExpiresAt(newRefreshToken);

  await prisma.refreshToken.create({
    data: { tokenHash: newTokenHash, userId: user.id, expiresAt: newExpiresAt },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logout(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt) return;
  await prisma.refreshToken.update({
    where: { tokenHash },
    data: { revokedAt: new Date() },
  });
}

export async function registerTeacher({ fullName, teacherCode, subject, email, phone, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingUser) {
    throw new AppError("Email này đã được đăng ký trong hệ thống.", 400, "EMAIL_ALREADY_EXISTS");
  }

  let finalCode = teacherCode?.trim();
  if (finalCode) {
    const existingCode = await prisma.teacher.findUnique({
      where: { teacherCode: finalCode },
    });
    if (existingCode) {
      throw new AppError("Mã giáo viên đã tồn tại. Vui lòng chọn mã khác.", 400, "TEACHER_CODE_ALREADY_EXISTS");
    }
  } else {
    finalCode = await getNextTeacherCode(subject || "GV");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const newUser = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      role: "TEACHER",
      status: "PENDING_APPROVAL",
      teacher: {
        create: {
          fullName: fullName.trim(),
          teacherCode: finalCode,
          phone: phone?.trim() || null,
        },
      },
    },
    include: {
      teacher: true,
    },
  });

  return {
    id: newUser.id,
    email: newUser.email,
    fullName: newUser.teacher.fullName,
    teacherCode: newUser.teacher.teacherCode,
    status: newUser.status,
  };
}