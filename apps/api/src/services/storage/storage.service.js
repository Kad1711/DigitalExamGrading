import crypto from "node:crypto";
import { LocalStorageService } from "./local-storage.service.js";
import { AppError } from "../../middlewares/error.middleware.js";

// Singleton storage provider
const defaultLocalStorage = new LocalStorageService();

/**
 * Returns the active storage provider.
 * Phase 6 default: local filesystem storage.
 */
export function getStorageProvider() {
  const providerType = process.env.SUBMISSION_STORAGE_PROVIDER || "local";
  if (providerType === "local") {
    return defaultLocalStorage;
  }
  // Future providers (e.g. S3 / GCS) can be plugged here
  return defaultLocalStorage;
}

export const storageService = getStorageProvider();

/**
 * Maps MIME type to safe file extension.
 *
 * @param {string} mimeType
 * @returns {string} Safe extension (.jpg or .png)
 */
export function getSafeExtensionFromMime(mimeType) {
  const mime = (mimeType || "").toLowerCase();
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  return "jpg"; // Default fallback for images
}

/**
 * Saves original exam submission image into controlled storage namespace.
 *
 * @param {object} params
 * @param {string} params.namespace - Pre-generated UUID or identifier
 * @param {Buffer} params.buffer - Original image binary buffer
 * @param {string} params.mimeType - Verified MIME type
 * @returns {Promise<{ storageKey: string, size: number, sha256: string }>}
 */
export async function saveOriginalSubmissionImage({ namespace, buffer, mimeType }) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new AppError("Dữ liệu ảnh không hợp lệ.", 400, "INVALID_IMAGE_BUFFER");
  }

  const ext = getSafeExtensionFromMime(mimeType);
  const storageKey = `submissions/${namespace}/original.${ext}`;

  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const result = await storageService.saveFile(storageKey, buffer);

  return {
    storageKey: result.storageKey,
    size: result.size,
    sha256: hash,
  };
}

/**
 * Decodes and saves an OMR review crop data URL (e.g. data:image/jpeg;base64,...)
 * into controlled storage namespace.
 *
 * @param {object} params
 * @param {string} params.namespace - Storage namespace
 * @param {number} params.questionNumber - Question number (1-based)
 * @param {string} params.base64DataUrl - Crop Data URL from FastAPI
 * @returns {Promise<string>} Review crop storage key
 */
export async function saveReviewCropImage({ namespace, questionNumber, base64DataUrl }) {
  if (!base64DataUrl || typeof base64DataUrl !== "string") {
    return null;
  }

  const matches = base64DataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    console.warn(`[STORAGE] Invalid reviewCropDataUrl for Q${questionNumber}: format does not match data URL`);
    return null;
  }

  const base64Data = matches[2];
  let cropBuffer;
  try {
    cropBuffer = Buffer.from(base64Data, "base64");
  } catch (err) {
    console.warn(`[STORAGE] Failed to decode base64 review crop for Q${questionNumber}: ${err.message}`);
    return null;
  }

  const paddedNum = String(questionNumber).padStart(3, "0");
  const storageKey = `submissions/${namespace}/review/q${paddedNum}.jpg`;

  await storageService.saveFile(storageKey, cropBuffer);
  return storageKey;
}

/**
 * Compensates / cleans up storage for a failed submission transaction.
 *
 * @param {string} namespace
 * @returns {Promise<void>}
 */
export async function cleanupSubmissionStorage(namespace) {
  if (!namespace) return;
  const relativeDir = `submissions/${namespace}`;
  await storageService.deleteDirectory(relativeDir);
}
