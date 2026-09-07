import multer from "multer";
import { AppError } from "../middlewares/error.middleware.js";
import { importTemplateQuerySchema } from "../schemas/answer-key-import.schema.js";
import * as importService from "../services/answer-key-import.service.js";

// Multer memory storage configuration (limit 5MB)
const storage = multer.memoryStorage();
export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    if (
      name.endsWith(".csv") ||
      name.endsWith(".xlsx") ||
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      cb(null, true);
    } else {
      cb(new AppError("Chi chap nhan file .xlsx hoac .csv.", 400, "ANSWER_KEY_FILE_TYPE_INVALID"));
    }
  },
}).single("file");

/**
 * Wrap multer to catch multer errors properly and pass to next(err).
 */
export function handleFileUpload(req, res, next) {
  uploadMiddleware(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new AppError("Dung luong file vuot qua gioi han 5MB.", 400, "ANSWER_KEY_FILE_TOO_LARGE"));
        }
        return next(new AppError(`Loi upload file: ${err.message}`, 400, "FILE_UPLOAD_ERROR"));
      }
      return next(err);
    }
    next();
  });
}

/**
 * GET /api/exams/:examId/answer-key/import-template
 */
export async function getImportTemplateController(req, res, next) {
  try {
    const parsed = importTemplateQuerySchema.safeParse(req.query);
    const format = parsed.success ? parsed.data.format : "xlsx";

    const { buffer, contentType, filename } = await importService.getImportTemplate(
      req.params.examId,
      format,
      req.user
    );

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/exams/:examId/answer-key/import/preview
 */
export async function previewImportController(req, res, next) {
  try {
    if (!req.file) {
      return next(new AppError("Vui long chon file de upload.", 400, "ANSWER_KEY_FILE_REQUIRED"));
    }

    const result = await importService.previewImport(
      req.params.examId,
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
      req.user
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/exams/:examId/answer-key/import
 */
export async function applyImportController(req, res, next) {
  try {
    if (!req.file) {
      return next(new AppError("Vui long chon file de upload.", 400, "ANSWER_KEY_FILE_REQUIRED"));
    }

    const result = await importService.applyImport(
      req.params.examId,
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Import dap an thanh cong.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}