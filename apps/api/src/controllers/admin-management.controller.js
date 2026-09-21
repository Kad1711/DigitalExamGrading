import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";
import { AppError } from "../middlewares/error.middleware.js";

const SALT_ROUNDS = 12;
const MANAGEMENT_ROLES = ["PRINCIPAL", "VICE_PRINCIPAL", "EXAM_OFFICER"];

/**
 * GET /api/admin/management-accounts
 * List all institutional leadership and board accounts.
 */
export async function listManagementAccountsController(req, res, next) {
  try {
    const { search, role, status } = req.query;

    const where = {
      role: { in: MANAGEMENT_ROLES },
    };

    if (role && MANAGEMENT_ROLES.includes(role)) {
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

    if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
      return next(new AppError("Không tìm thấy tài khoản quản lý hợp lệ.", 404, "USER_NOT_FOUND"));
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

    if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
      return next(new AppError("Không tìm thấy tài khoản quản lý hợp lệ.", 404, "USER_NOT_FOUND"));
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
 * Update basic info (fullName, phone) of a management account.
 */
export async function updateManagementAccountController(req, res, next) {
  try {
    const { userId } = req.params;
    const { fullName, phone } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !MANAGEMENT_ROLES.includes(user.role)) {
      return next(new AppError("Không tìm thấy tài khoản quản lý hợp lệ.", 404, "USER_NOT_FOUND"));
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
