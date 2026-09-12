/**
 * Custom application error class
 */
export class AppError extends Error {
  constructor(message, statusCode, code, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || "APP_ERROR";
    this.details = details || null;
    if (details && typeof details === "object") {
      Object.assign(this, details);
    }
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Không tìm thấy đường dẫn: ${req.method} ${req.originalUrl}`,
    },
  });
}

/**
 * Global error handler
 */
// eslint-disable-next-line no-unused-vars
export function globalErrorHandler(err, req, res, next) {
  if (process.env.NODE_ENV !== "production") {
    console.error("[ERROR]", err);
  } else {
    console.error("[ERROR]", err.message);
  }

  if (err.isOperational) {
    const errorPayload = {
      code: err.code,
      message: err.message,
    };
    if (err.details && typeof err.details === "object") {
      Object.assign(errorPayload, err.details);
    }
    return res.status(err.statusCode).json({
      success: false,
      error: errorPayload,
    });
  }

  if (err.code === "P2002") {
    return res.status(409).json({
      success: false,
      error: {
        code: "CONFLICT",
        message: "Dữ liệu đã tồn tại.",
      },
    });
  }

  if (err.name === "ZodError") {
    return res.status(422).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        details: err.errors,
      },
    });
  }

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
    },
  });
}
