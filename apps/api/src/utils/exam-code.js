import { AppError } from "../middlewares/error.middleware.js";

/**
 * Normalizes numeric exam codes to a canonical 3-digit string (e.g. "1" -> "001", "01" -> "001").
 *
 * Requirements:
 * - accepts string / number
 * - digits only
 * - integer range 0..999
 * - output padStart(3, "0")
 * - rejects non-numeric or out-of-range values
 *
 * @param {string|number} value
 * @returns {string} 3-digit padded exam code (e.g. "001")
 */
export function normalizeExamCode(value) {
  if (value === null || value === undefined) {
    throw new AppError("Mã đề không được để trống.", 400, "INVALID_EXAM_CODE");
  }

  const str = String(value).trim();
  if (str === "") {
    throw new AppError("Mã đề không được để trống.", 400, "INVALID_EXAM_CODE");
  }

  // Digits only
  if (!/^\d+$/.test(str)) {
    throw new AppError(
      "Mã đề chỉ được chứa các chữ số từ 0 đến 9.",
      400,
      "INVALID_EXAM_CODE"
    );
  }

  const num = parseInt(str, 10);
  if (isNaN(num) || num < 0 || num > 999 || str.length > 3) {
    throw new AppError(
      "Mã đề phải nằm trong khoảng từ 000 đến 999 (tối đa 3 chữ số).",
      400,
      "INVALID_EXAM_CODE"
    );
  }

  return String(num).padStart(3, "0");
}
