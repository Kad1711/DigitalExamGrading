import rateLimit from "express-rate-limit";

const isTest = process.env.NODE_ENV === "test";

/**
 * Common standard handler for rate limit violations
 */
function createRateLimitResponse(message) {
  return (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message,
      },
    });
  };
}

/**
 * Auth Limiter: Protects login and teacher registration against brute-force
 * 15 attempts per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  handler: createRateLimitResponse(
    "Bạn đã gửi quá nhiều yêu cầu đăng nhập hoặc đăng ký. Vui lòng thử lại sau 15 phút."
  ),
});

/**
 * Grading Upload Limiter: Protects OMR processing endpoints from CPU/RAM spikes
 * 60 uploads per minute per IP (enough for sequential batch uploads of a whole class)
 */
export const gradingUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  handler: createRateLimitResponse(
    "Hệ thống đang tiếp nhận quá nhiều bài nộp cùng lúc. Vui lòng đợi trong giây lát rồi thử lại."
  ),
});

/**
 * General API Limiter: Broad safeguard for general endpoints
 * 300 requests per 15 minutes per IP
 */
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  handler: createRateLimitResponse(
    "Bạn đã vượt quá giới hạn yêu cầu cho phép. Vui lòng thử lại sau."
  ),
});
