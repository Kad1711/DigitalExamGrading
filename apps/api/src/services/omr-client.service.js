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

    const message =
      errorDetail?.detail?.message ||
      errorDetail?.message ||
      `FastAPI OMR bao loi HTTP ${response.status}.`;
    const code = errorDetail?.detail?.code || errorDetail?.code || "OMR_ANALYSIS_FAILED";

    throw new AppError(message, response.status >= 500 ? 502 : response.status, code);
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
