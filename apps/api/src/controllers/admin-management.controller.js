import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";

const SALT_ROUNDS = 12;
const MANAGEMENT_ROLES = ["PRINCIPAL", "VICE_PRINCIPAL", "EXAM_OFFICER"];
const ALL_STAFF_ROLES = ["PRINCIPAL", "VICE_PRINCIPAL", "EXAM_OFFICER", "TEACHER"];

/**
 * GET /api/admin/management-accounts
 * List institutional staff accounts (Leadership, Exam Officers, and Teachers).
 */
export async function listManagementAccountsController(req, res, next) {
  try {
    const { search, role, status, includeTeachers } = req.query;

    const allowedRoles = includeTeachers === "true" || role === "TEACHER"
      ? ALL_STAFF_ROLES
      : ALL_STAFF_ROLES; // Include all staff roles so admin has full visibility

    const where = {
      role: { in: allowedRoles },
    };

    if (role && ALL_STAFF_ROLES.includes(role)) {
      where.role = role;
    }

    if (status && ["ACTIVE", "LOCKED", "PENDING_APPROVAL"].includes(status)) {
      where.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    const accounts = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        phone: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        teacher: {
          select: {
            id: true,
            teacherCode: true,
            primarySubject: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
      orderBy: [
        { role: "asc" },
        { createdAt: "asc" },
      ],
    });

    return res.status(200).json({
      success: true,
      data: accounts,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/management-accounts
 * Create new account and assign role (TEACHER, EXAM_OFFICER, PRINCIPAL, VICE_PRINCIPAL).
 */
export async function createManagementAccountController(req, res, next) {
  try {
    const { email, password, fullName, phone, role, teacherCode, subjectId } = req.body;

    if (!role || !ALL_STAFF_ROLES.includes(role)) {
      return next(
        new AppError(
          "Vai trò không hợp lệ. Vui lòng chọn: Hiệu trưởng, Hiệu phó, Cán bộ khảo thí hoặc Giáo viên.",
          422,
          "INVALID_ROLE"
        )
      );
    }

    if (!email || !email.trim()) {
      return next(new AppError("Email là bắt buộc.", 422, "EMAIL_REQUIRED"));
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });
    if (existing) {
      return next(new AppError("Email này đã được sử dụng trong hệ thống.", 409, "EMAIL_EXISTS"));
    }

    if (!password || password.trim().length < 6) {
      return next(new AppError("Mật khẩu khởi tạo tối thiểu 6 ký tự.", 422, "PASSWORD_TOO_SHORT"));
    }

    const cleanFullName = (fullName || "").trim() || "Nhân sự mới";
    const passwordHash = await bcrypt.hash(password.trim(), SALT_ROUNDS);

    if (role === "TEACHER") {
      let code = (teacherCode || "").trim().toUpperCase();
      if (!code) {
        const count = await prisma.teacher.count();
        code = `GV${String(count + 1).padStart(3, "0")}`;
      }

      const existingCode = await prisma.teacher.findUnique({
        where: { teacherCode: code },
      });
      if (existingCode) {
        code = `GV${Date.now().toString().slice(-4)}`;
      }

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: cleanEmail,
            passwordHash,
            role: "TEACHER",
            status: "ACTIVE",
            fullName: cleanFullName,
            phone: phone ? phone.trim() : null,
          },
        });

        const teacher = await tx.teacher.create({
          data: {
            userId: user.id,
            teacherCode: code,
            fullName: cleanFullName,
            phone: phone ? phone.trim() : null,
            primarySubjectId: subjectId || null,
          },
        });

        return { user, teacher };
      });

      return res.status(201).json({
        success: true,
        message: `Đã tạo tài khoản Giáo viên ${cleanEmail} (Mã: ${result.teacher.teacherCode}) thành công.`,
        data: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          role: result.user.role,
          status: result.user.status,
          teacherCode: result.teacher.teacherCode,
        },
      });
    }

    // PRINCIPAL, VICE_PRINCIPAL, EXAM_OFFICER
    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        passwordHash,
        role,
        status: "ACTIVE",
        fullName: cleanFullName,
        phone: phone ? phone.trim() : null,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        phone: true,
        createdAt: true,
      },
    });

    const roleNameMap = {
      PRINCIPAL: "Hiệu trưởng",
      VICE_PRINCIPAL: "Hiệu phó chuyên môn",
      EXAM_OFFICER: "Cán bộ khảo thí",
    };

    return res.status(201).json({
      success: true,
      message: `Đã tạo và cấp quyền tài khoản ${roleNameMap[role] || role} (${cleanEmail}) thành công.`,
      data: user,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/management-accounts/:userId
 * Allow admin to delete locked accounts.
 */
export async function deleteManagementAccountController(req, res, next) {
  try {
    const { userId } = req.params;

    if (req.user?.id === userId) {
      return next(new AppError("Không thể tự xóa tài khoản của chính mình.", 400, "CANNOT_DELETE_SELF"));
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        teacher: true,
      },
    });

    if (!targetUser) {
      return next(new AppError("Không tìm thấy tài khoản người dùng.", 404, "USER_NOT_FOUND"));
    }

    if (targetUser.role === "SUPER_ADMIN") {
      return next(new AppError("Không thể xóa tài khoản Quản trị viên cấp cao.", 403, "FORBIDDEN"));
    }

    if (targetUser.status !== "LOCKED") {
      return next(
        new AppError(
          "Chỉ có thể xóa tài khoản đã bị khóa. Vui lòng khóa tài khoản trước khi xóa.",
          400,
          "ACCOUNT_NOT_LOCKED"
        )
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete refresh tokens
      await tx.refreshToken.deleteMany({ where: { userId } });

      // 2. If user is a teacher, verify no blocking records and delete
      if (targetUser.teacher) {
        const teacherId = targetUser.teacher.id;
        const examCount = await tx.exam.count({ where: { teacherId } });
        if (examCount > 0) {
          throw new AppError(
            `Không thể xóa tài khoản này vì đã tạo ${examCount} kỳ thi trong hệ thống.`,
            400,
            "TEACHER_HAS_EXAMS"
          );
        }
        await tx.teachingAssignment.deleteMany({ where: { teacherId } });
        await tx.teacher.delete({ where: { id: teacherId } });
      }

      // 3. Delete user
      await tx.user.delete({ where: { id: userId } });
    });

    return res.status(200).json({
      success: true,
      message: `Đã xóa vĩnh viễn tài khoản ${targetUser.email} thành công.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/management-accounts/:userId/reset-password
 * Reset password for a management account.
 */
export async function resetManagementPasswordController(req, res, next) {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || typeof newPassword !== "string" || newPassword.trim().length < 6) {
      return next(new AppError("Mật khẩu mới phải có tối thiểu 6 ký tự.", 422, "VALIDATION_ERROR"));
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !ALL_STAFF_ROLES.includes(user.role)) {
      return next(new AppError("Không tìm thấy tài khoản nhân sự hợp lệ.", 404, "USER_NOT_FOUND"));
    }

    const passwordHash = await bcrypt.hash(newPassword.trim(), SALT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Invalidate existing refresh tokens so old sessions terminate
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });

    return res.status(200).json({
      success: true,
      message: `Đã đặt lại mật khẩu cho tài khoản ${user.email} thành công.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/management-accounts/:userId/toggle-status
 * Toggle lock/active status for a management account.
 */
export async function toggleManagementStatusController(req, res, next) {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !ALL_STAFF_ROLES.includes(user.role)) {
      return next(new AppError("Không tìm thấy tài khoản nhân sự hợp lệ.", 404, "USER_NOT_FOUND"));
    }

    if (user.role === "SUPER_ADMIN" || req.user?.id === userId) {
      return next(new AppError("Không thể khóa tài khoản quản trị viên hiện tại.", 400, "CANNOT_LOCK_SELF"));
    }

    const nextStatus = user.status === "ACTIVE" ? "LOCKED" : "ACTIVE";

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status: nextStatus },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        phone: true,
        updatedAt: true,
      },
    });

    if (nextStatus === "LOCKED") {
      await prisma.refreshToken.deleteMany({ where: { userId } });
    }

    return res.status(200).json({
      success: true,
      message: `Tài khoản ${user.email} hiện đã được ${nextStatus === "ACTIVE" ? "mở khóa" : "khóa"}.`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/management-accounts/:userId
 * Update basic info (fullName, phone) of an account.
 */
export async function updateManagementAccountController(req, res, next) {
  try {
    const { userId } = req.params;
    const { fullName, phone } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !ALL_STAFF_ROLES.includes(user.role)) {
      return next(new AppError("Không tìm thấy tài khoản nhân sự hợp lệ.", 404, "USER_NOT_FOUND"));
    }

    const data = {};
    if (typeof fullName === "string" && fullName.trim()) {
      data.fullName = fullName.trim();
    }
    if (typeof phone === "string") {
      data.phone = phone.trim();
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        phone: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Cập nhật thông tin tài khoản thành công.",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}
