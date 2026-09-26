import prisma from "../config/prisma.js";
import { AppError } from "./error.middleware.js";

/**
 * Middleware: Check if the user is allowed to manage students in a specific class.
 * - SUPER_ADMIN & VICE_PRINCIPAL: Full access to all classes.
 * - TEACHER: Allowed if assigned to teach this class via TeachingAssignment.
 * - Others: Forbidden.
 */
export async function requireClassStudentManagement(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return next(new AppError("Bạn chưa xác thực.", 401, "UNAUTHORIZED"));
    }

    if (user.role === "SUPER_ADMIN" || user.role === "VICE_PRINCIPAL") {
      return next();
    }

    if (user.role === "TEACHER") {
      const classId = req.params.classId;
      if (!classId) {
        return next(new AppError("Thiếu mã lớp học.", 400, "BAD_REQUEST"));
      }

      const teacher = await prisma.teacher.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      if (!teacher) {
        return next(new AppError("Không tìm thấy thông tin giáo viên.", 403, "FORBIDDEN"));
      }

      const assignment = await prisma.teachingAssignment.findFirst({
        where: {
          classId,
          teacherId: teacher.id,
        },
      });

      if (!assignment) {
        return next(
          new AppError(
            "Bạn chỉ được phép quản lý học sinh của các lớp bạn được phân công phụ trách.",
            403,
            "FORBIDDEN"
          )
        );
      }

      return next();
    }

    return next(new AppError("Bạn không có quyền thực hiện thao tác này.", 403, "FORBIDDEN"));
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware: Check if the user is allowed to read students in a specific class.
 * - SUPER_ADMIN, PRINCIPAL, VICE_PRINCIPAL, EXAM_OFFICER: Full school-wide access.
 * - TEACHER: Allowed if assigned to teach this class via TeachingAssignment.
 * - Others: Forbidden.
 */
export async function requireClassStudentAccess(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return next(new AppError("Bạn chưa xác thực.", 401, "UNAUTHORIZED"));
    }

    if (
      user.role === "SUPER_ADMIN" ||
      user.role === "PRINCIPAL" ||
      user.role === "VICE_PRINCIPAL" ||
      user.role === "EXAM_OFFICER"
    ) {
      return next();
    }

    if (user.role === "TEACHER") {
      const classId = req.params.classId;
      if (!classId) {
        return next(new AppError("Thiếu mã lớp học.", 400, "BAD_REQUEST"));
      }

      const teacher = await prisma.teacher.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });

      if (!teacher) {
        return next(new AppError("Không tìm thấy thông tin giáo viên.", 403, "FORBIDDEN"));
      }

      const assignment = await prisma.teachingAssignment.findFirst({
        where: {
          classId,
          teacherId: teacher.id,
        },
      });

      if (!assignment) {
        return next(
          new AppError(
            "Bạn chỉ được phép xem danh sách học sinh của các lớp bạn được phân công phụ trách.",
            403,
            "FORBIDDEN"
          )
        );
      }

      return next();
    }

    return next(new AppError("Bạn không có quyền thực hiện thao tác này.", 403, "FORBIDDEN"));
  } catch (err) {
    next(err);
  }
}
