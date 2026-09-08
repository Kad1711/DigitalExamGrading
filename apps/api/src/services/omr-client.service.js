import { AppError } from "../middlewares/error.middleware.js";

const DEFAULT_AI_SERVICE_URL = "http://localhost:8000";
const OMR_TIMEOUT_MS = 15000;

/**
 * Call FastAPI /omr/analyze with image buffer and layoutJson.
 *
 * @param {Buffer} imageBuffer - Binary image buffer
 * @param {object|string} layoutJson - Layout geometry object or string
 * @param {string} [filename="sheet.png"] - Filename with valid image extension (.jpg, .jpeg, .png)
 * @returns {Promise<object>} OMRAnalysisData
 */
export async function analyzeOmrSheet(imageBuffer, layoutJson, filename = "sheet.png") {
  const baseUrl = process.env.AI_SERVICE_URL || DEFAULT_AI_SERVICE_URL;
  const url = `${baseUrl}/omr/analyze`;

  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: getMimeType(filename) });
  formData.append("image", blob, filename);

  const layoutString = typeof layoutJson === "string" ? layoutJson : JSON.stringify(layoutJson);
  formData.append("layoutJson", layoutString);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(OMR_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === "TimeoutError") {
      throw new AppError(
        "Dich vu AI cham thi (FastAPI OMR) phan hoi qua thoi gian cho (15s).",
        504,
        "OMR_SERVICE_TIMEOUT"
      );
    }
    // Network error / connection refused
    throw new AppError(
      "Dich vu AI cham thi (FastAPI OMR) hien khong kha dung. Vui long thu lai sau.",
      503,
      "OMR_SERVICE_UNAVAILABLE"
    );
  }

  if (!response.ok) {
    let errorDetail;
    try {
      errorDetail = await response.json();
    } catch {
      errorDetail = null;
    }

    console.error(
      `[OMR ERROR]\nHTTP ${response.status}\ndetail:`,
      errorDetail ? JSON.stringify(errorDetail, null, 2) : "None"
    );

    let rawCode = null;
    let rawMessage = null;

    if (errorDetail) {
      const errObj = errorDetail.error || errorDetail.detail;
      if (typeof errObj === "object" && errObj !== null) {
        if (Array.isArray(errObj)) {
          // Pydantic validation error list
          rawCode = "OMR_INVALID_REQUEST";
          rawMessage = errObj
            .map((d) => (d.loc ? `${d.loc.join(".")}: ${d.msg}` : d.msg || JSON.stringify(d)))
            .join("; ");
        } else {
          // OMRError detail object: { code, message }
          rawCode = errObj.code;
          rawMessage = errObj.message;
        }
      } else if (typeof errObj === "string") {
        rawMessage = errObj;
      } else if (errorDetail.message) {
        rawMessage = errorDetail.message;
        rawCode = errorDetail.code;
      }
    }

    // Map FastAPI internal error codes to clear domain codes and user-friendly Vietnamese messages
    let domainCode = "OMR_SERVICE_ERROR";
    let domainMessage = rawMessage || `Dịch vụ AI chấm thi báo lỗi HTTP ${response.status}.`;

    if (rawCode === "MARKERS_NOT_FOUND") {
      domainCode = "OMR_MARKERS_NOT_FOUND";
      domainMessage = "Không tìm thấy đủ 4 điểm định vị góc phiếu. Vui lòng chụp rõ toàn bộ 4 góc phiếu.";
    } else if (rawCode === "QR_NOT_FOUND" || rawCode === "QR_INVALID") {
      domainCode = "OMR_QR_NOT_DETECTED";
      domainMessage = "Không thể đọc mã QR nhận diện mẫu phiếu. Vui lòng đảm bảo góc trên bên phải phiếu không bị che khuất hoặc mờ.";
    } else if (rawCode === "IMAGE_DECODE_FAILED" || rawCode === "IMAGE_TYPE_INVALID" || rawCode === "IMAGE_TOO_LARGE") {
      domainCode = "OMR_IMAGE_QUALITY_FAILED";
      domainMessage = rawMessage || "Ảnh tải lên không hợp lệ hoặc không thể xử lý.";
    } else if (rawCode === "PERSPECTIVE_TRANSFORM_FAILED") {
      domainCode = "OMR_IMAGE_QUALITY_FAILED";
      domainMessage = "Không thể căn chỉnh góc nghiêng của bài thi. Vui lòng chụp phẳng và vuông góc hơn.";
    } else if (rawCode === "PAGE_LAYOUT_NOT_FOUND" || rawCode === "OMR_INVALID_REQUEST" || rawCode === "LAYOUT_INVALID") {
      domainCode = "OMR_INVALID_REQUEST";
      domainMessage = rawMessage || "Yêu cầu xử lý phiếu không hợp lệ.";
    } else if (rawCode) {
      domainCode = rawCode;
    }

    throw new AppError(domainMessage, response.status >= 500 ? 502 : response.status, domainCode);
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    throw new AppError(
      result.error?.message || "Du lieu phan tich tu OMR khong hop le.",
      502,
      "OMR_INVALID_RESPONSE"
    );
  }

  return result.data;
}

function getMimeType(filename) {
  const lower = (filename || "").toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}
