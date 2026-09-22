import {
  createTeacherSchema,
  updateTeacherSchema,
  resetPasswordSchema,
} from "../schemas/admin-teacher.schema.js";
import * as adminTeacherService from "../services/admin-teacher.service.js";
import { AppError } from "../middlewares/error.middleware.js";

function zodMsg(zodError) {
  const issues = zodError.issues || zodError.errors || [];
  return issues.map((e) => e.message).join(" | ");
}

export async function listTeachersController(req, res, next) {
  try {
    const { search, status } = req.query;
    const teachers = await adminTeacherService.listTeachers({ search, status });
    return res.status(200).json({
      success: true,
      data: teachers,
    });
  } catch (err) {
    next(err);
  }
}

export async function createTeacherController(req, res, next) {
  try {
    const parsed = createTeacherSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new AppError(zodMsg(parsed.error), 422, "VALIDATION_ERROR"));
    }

    const teacher = await adminTeacherService.createTeacher(parsed.data);
    return res.status(201).json({
      success: true,
      message: "Tao tai khoan giao vien thanh cong.",
      data: teacher,
    });
  } catch (err) {
    next(err);
  }
}

export async function nextTeacherCodeController(req, res, next) {
  try {
    const { subject } = req.query;
    const { getNextTeacherCode, STANDARD_SUBJECTS } = await import("../utils/teacher-code.js");
    const nextCode = await getNextTeacherCode(subject || "GV");
    return res.status(200).json({
      success: true,
      data: {
        subject: subject || null,
        nextTeacherCode: nextCode,
        standardSubjects: STANDARD_SUBJECTS,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getTeacherDetailController(req, res, next) {
  try {
    const { teacherId } = req.params;
    const teacher = await adminTeacherService.getTeacherById(teacherId);
    return res.status(200).json({
      success: true,
      data: teacher,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateTeacherController(req, res, next) {
  try {
    const { teacherId } = req.params;
    const parsed = updateTeacherSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new AppError(zodMsg(parsed.error), 422, "VALIDATION_ERROR"));
    }

    const updated = await adminTeacherService.updateTeacher(teacherId, parsed.data);
    return res.status(200).json({
      success: true,
      message: "Cap nhat thong tin giao vien thanh cong.",
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function lockTeacherController(req, res, next) {
  try {
    const { teacherId } = req.params;
    const result = await adminTeacherService.lockTeacher(teacherId);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function unlockTeacherController(req, res, next) {
  try {
    const { teacherId } = req.params;
    const result = await adminTeacherService.unlockTeacher(teacherId);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function resetTeacherPasswordController(req, res, next) {
  try {
    const { teacherId } = req.params;
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(new AppError(zodMsg(parsed.error), 422, "VALIDATION_ERROR"));
    }

    const result = await adminTeacherService.resetTeacherPassword(
      teacherId,
      parsed.data.newPassword
    );
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteTeacherController(req, res, next) {
  try {
    const { teacherId } = req.params;
    const result = await adminTeacherService.deleteTeacher(teacherId);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function bulkDeleteLockedTeachersController(req, res, next) {
  try {
    const { teacherIds } = req.body;
    const result = await adminTeacherService.bulkDeleteLockedTeachers(teacherIds);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function approveTeacherController(req, res, next) {
  try {
    const { teacherId } = req.params;
    const result = await adminTeacherService.approveTeacher(teacherId);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function rejectTeacherController(req, res, next) {
  try {
    const { teacherId } = req.params;
    const { reason } = req.body || {};
    const result = await adminTeacherService.rejectTeacher(teacherId, { reason });
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getTeacherAssignmentsController(req, res, next) {
  try {
    const { teacherId } = req.params;
    const result = await adminTeacherService.getTeacherAssignments(teacherId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateTeacherAssignmentsController(req, res, next) {
  try {
    const { teacherId } = req.params;
    const { classIds, subjectId, removeOtherSubjects } = req.body || {};
    const result = await adminTeacherService.updateTeacherAssignments(teacherId, {
      classIds,
      subjectId,
      removeOtherSubjects,
    });
    return res.status(200).json({
      success: true,
      message: "Cập nhật phân công giảng dạy thành công.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

