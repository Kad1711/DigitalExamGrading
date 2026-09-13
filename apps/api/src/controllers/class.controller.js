import multer from "multer";
import { AppError } from "../middlewares/error.middleware.js";
import {
  createClassSchema,
  createBatchClassesSchema,
  updateClassSchema,
  createStudentSchema,
  updateStudentSchema,
  importStudentsConfigSchema,
} from "../schemas/class.schema.js";
import * as classService from "../services/class.service.js";

// Multer memory storage configuration for Excel (10MB limit)
const storage = multer.memoryStorage();
export const uploadExcel = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    if (
      name.endsWith(".xlsx") ||
      name.endsWith(".xls") ||
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      cb(null, true);
    } else {
      cb(new AppError("Chỉ chấp nhận file định dạng Excel (.xlsx hoặc .xls).", 400, "EXCEL_FILE_INVALID"));
    }
  },
}).single("file");

export function handleExcelUpload(req, res, next) {
  uploadExcel(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new AppError("Dung lượng file Excel vượt quá 10MB.", 400, "FILE_TOO_LARGE"));
        }
        return next(new AppError(`Lỗi tải lên file: ${err.message}`, 400, "FILE_UPLOAD_ERROR"));
      }
      return next(err);
    }
    next();
  });
}

export async function getGrades(req, res, next) {
  try {
    const grades = await classService.listGrades();
    res.json({ success: true, data: grades });
  } catch (err) {
    next(err);
  }
}

export async function getClasses(req, res, next) {
  try {
    const classes = await classService.listClasses();
    res.json({ success: true, data: classes });
  } catch (err) {
    next(err);
  }
}

export async function createClass(req, res, next) {
  try {
    const validated = createClassSchema.parse(req.body);
    const newClass = await classService.createClass({
      name: validated.name,
      gradeId: validated.gradeId,
      teacherUserId: req.user.role === "TEACHER" ? req.user.id : null,
    });
    res.status(201).json({
      success: true,
      message: `Đã tạo lớp học "${newClass.name}" thành công.`,
      data: newClass,
    });
  } catch (err) {
    next(err);
  }
}

export async function createBatchClasses(req, res, next) {
  try {
    const validated = createBatchClassesSchema.parse(req.body);
    const result = await classService.createBatchClasses({
      names: validated.names,
      gradeId: validated.gradeId,
      teacherUserId: req.user.role === "TEACHER" ? req.user.id : null,
    });

    let message = `Đã tạo thành công ${result.totalCreated} lớp học mới.`;
    if (result.totalSkipped > 0) {
      message += ` (Đã bỏ qua ${result.totalSkipped} lớp do đã tồn tại: ${result.skipped.join(", ")})`;
    }

    res.status(201).json({
      success: true,
      message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateClass(req, res, next) {
  try {
    const validated = updateClassSchema.parse(req.body);
    const updated = await classService.updateClass(req.params.classId, validated);
    res.json({
      success: true,
      message: `Đã cập nhật lớp học "${updated.name}" thành công.`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteClass(req, res, next) {
  try {
    const result = await classService.deleteClass(req.params.classId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function bulkDeleteClasses(req, res, next) {
  try {
    const { classIds } = req.body;
    const result = await classService.bulkDeleteClasses(classIds);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getClassStudents(req, res, next) {
  try {
    const students = await classService.listClassStudents(req.params.classId);
    res.json({ success: true, data: students });
  } catch (err) {
    next(err);
  }
}

export async function addStudent(req, res, next) {
  try {
    const validated = createStudentSchema.parse(req.body);
    const student = await classService.addStudentToClass(req.params.classId, validated);
    res.status(201).json({
      success: true,
      message: `Đã thêm học sinh "${student.fullName}" vào lớp thành công.`,
      data: student,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateStudent(req, res, next) {
  try {
    const validated = updateStudentSchema.parse(req.body);
    const updated = await classService.updateStudent(
      req.params.classId,
      req.params.studentId,
      validated
    );
    res.json({
      success: true,
      message: `Đã cập nhật thông tin học sinh "${updated.fullName}" thành công.`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function removeStudent(req, res, next) {
  try {
    const result = await classService.removeStudentFromClass(
      req.params.classId,
      req.params.studentId
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function clearClassStudents(req, res, next) {
  try {
    const result = await classService.clearClassStudents(req.params.classId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function bulkRemoveStudents(req, res, next) {
  try {
    const { studentIds } = req.body;
    const result = await classService.bulkRemoveStudentsFromClass(req.params.classId, studentIds);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function previewExcelImport(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      throw new AppError("Vui lòng tải lên file Excel.", 400, "FILE_REQUIRED");
    }

    const preview = await classService.parseExcelPreview(req.file.buffer);
    res.json({ success: true, data: preview });
  } catch (err) {
    next(err);
  }
}

export async function executeExcelImport(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      throw new AppError("Vui lòng tải lên file Excel.", 400, "FILE_REQUIRED");
    }

    let mapping = req.body.mapping;
    if (typeof mapping === "string") {
      try {
        mapping = JSON.parse(mapping);
      } catch {
        throw new AppError("Cấu hình ánh xạ cột không hợp lệ.", 400, "INVALID_MAPPING_JSON");
      }
    }

    const validatedMapping = importStudentsConfigSchema.parse(mapping);
    const result = await classService.importStudentsFromExcel(
      req.params.classId,
      req.file.buffer,
      validatedMapping
    );

    res.json({
      success: true,
      message: `Đã nhập thành công ${result.importedCount} học sinh vào lớp (${result.skippedCount} học sinh đã có sẵn).`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function standardizeClassSbd(req, res, next) {
  try {
    const { classId } = req.params;
    const result = await classService.standardizeClassSbd(classId);
    res.json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

