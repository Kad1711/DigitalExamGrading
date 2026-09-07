/**
 * Custom application error class
 */
export class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || "APP_ERROR";
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
      message: `Khong tim thay route: ${req.method} ${req.originalUrl}`,
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
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  if (err.code === "P2002") {
    return res.status(409).json({
      success: false,
      error: {
        code: "CONFLICT",
        message: "Du lieu da ton tai.",
      },
    });
  }

  if (err.name === "ZodError") {
    return res.status(422).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Du lieu khong hop le.",
        details: err.errors,
      },
    });
  }

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Loi may chu noi bo. Vui long thu lai sau.",
    },
  });
}
