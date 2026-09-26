import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { LocalStorageService } from "./local-storage.service.js";
import { AppError } from "../../middlewares/error.middleware.js";
import { isCloudinaryConfigured } from "../../config/cloudinary.config.js";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
  deletePrefixFromCloudinary,
} from "./cloudinary-storage.service.js";

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
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  return "jpg"; // Default fallback for images
}

/**
 * Saves original exam submission image into controlled storage namespace.
 * Also uploads to Cloudinary when configured.
 *
 * @param {object} params
 * @param {string} params.namespace - Pre-generated UUID or identifier
 * @param {Buffer} params.buffer - Original image binary buffer
 * @param {string} params.mimeType - Verified MIME type
 * @returns {Promise<{ storageKey: string, size: number, sha256: string, cloudinaryUrl?: string, cloudinaryPublicId?: string }>}
 */
export async function saveOriginalSubmissionImage({ namespace, buffer, mimeType }) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new AppError("Dữ liệu ảnh không hợp lệ.", 400, "INVALID_IMAGE_BUFFER");
  }

  const ext = getSafeExtensionFromMime(mimeType);
  const storageKey = `submissions/${namespace}/original.${ext}`;

  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const result = await storageService.saveFile(storageKey, buffer);

  let cloudinaryUrl = null;
  let cloudinaryPublicId = null;
  if (isCloudinaryConfigured()) {
    try {
      const publicId = `original_${namespace}`;
      const folder = `digitalexam/submissions/${namespace}`;
      const cRes = await uploadBufferToCloudinary(buffer, {
        folder,
        publicId,
        resourceType: "image",
      });
      cloudinaryUrl = cRes.secureUrl;
      cloudinaryPublicId = cRes.publicId;
    } catch (cErr) {
      console.warn(`[STORAGE] Cloudinary upload notice: ${cErr.message}`);
    }
  }

  return {
    storageKey: result.storageKey,
    size: result.size,
    sha256: hash,
    cloudinaryUrl,
    cloudinaryPublicId,
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
 * Performs best-effort cleanup on both local filesystem and Cloudinary.
 * Failure in compensating cleanup does not mask the original application error.
 *
 * @param {string} namespace
 * @param {string} [cloudinaryPublicId]
 * @returns {Promise<void>}
 */
export async function cleanupSubmissionStorage(namespace, cloudinaryPublicId) {
  if (!namespace) return;
  const relativeDir = `submissions/${namespace}`;

  // 1. Compensating cleanup of local storage directory
  try {
    await storageService.deleteDirectory(relativeDir);
  } catch (localErr) {
    console.warn(`[STORAGE CLEANUP] Local cleanup error for ${namespace}: ${localErr.message}`);
  }

  // 2. Compensating cleanup of Cloudinary resources (best-effort)
  if (isCloudinaryConfigured()) {
    try {
      const publicId =
        cloudinaryPublicId || `digitalexam/submissions/${namespace}/original_${namespace}`;
      await deleteFromCloudinary(publicId, { resourceType: "image" });
      await deletePrefixFromCloudinary(`digitalexam/submissions/${namespace}/`);
    } catch (cErr) {
      console.warn(`[STORAGE CLEANUP] Cloudinary cleanup notice for ${namespace}: ${cErr.message}`);
    }
  }
}

/**
 * Cleans up temporary staged batch directory under storage root.
 *
 * @param {string} batchId
 * @returns {Promise<void>}
 */
export async function cleanupStagedBatch(batchId) {
  if (!batchId) return;
  try {
    await storageService.deleteDirectory(`staging/${batchId}`);
  } catch (err) {
    console.warn(`[STORAGE CLEANUP] Failed to cleanup staging batch ${batchId}:`, err.message);
  }
}

/**
 * Deletes a single staged file.
 *
 * @param {string} storageKey
 * @returns {Promise<void>}
 */
export async function cleanupStagedFile(storageKey) {
  if (!storageKey) return;
  try {
    await storageService.deleteFile(storageKey);
  } catch (err) {
    console.warn(`[STORAGE CLEANUP] Failed to delete staged file ${storageKey}:`, err.message);
  }
}

/**
 * Safely scans and cleans up stale temporary staging files and directories.
 * Strictly adheres to safety constraints:
 * - Only operates inside <storageRoot>/staging
 * - Does not traverse symlinks or paths outside staging root
 * - Only removes items whose modification time (mtime) exceeds maxAgeMs
 * - Errors are caught and handled gracefully; never throws, safe for server startup
 * - Logs the number of resources cleaned
 *
 * @param {number} [maxAgeMs=86400000] - Age threshold in milliseconds (default 24h)
 * @returns {Promise<{ scanned: number, cleaned: number, errors: string[] }>}
 */
export async function cleanupStaleStaging(maxAgeMs = 24 * 60 * 60 * 1000) {
  const summary = { scanned: 0, cleaned: 0, errors: [] };
  try {
    const rootDir = storageService.getStorageRoot();
    const stagingDir = path.resolve(rootDir, "staging");

    try {
      await fs.promises.access(stagingDir, fs.constants.F_OK);
    } catch {
      // Staging directory does not exist yet (normal on fresh deploy)
      return summary;
    }

    const entries = await fs.promises.readdir(stagingDir, { withFileTypes: true });
    const now = Date.now();

    for (const entry of entries) {
      summary.scanned++;
      const name = entry.name;
      // Guard against invalid or traversal file names
      if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\")) {
        continue;
      }

      const fullPath = path.resolve(stagingDir, name);
      const relative = path.relative(stagingDir, fullPath);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        continue;
      }

      try {
        const stat = await fs.promises.lstat(fullPath);
        // Safety: reject symlinks
        if (stat.isSymbolicLink()) {
          continue;
        }

        const age = now - stat.mtimeMs;
        if (age > maxAgeMs) {
          await fs.promises.rm(fullPath, { recursive: true, force: true });
          summary.cleaned++;
        }
      } catch (entryErr) {
        summary.errors.push(`${name}: ${entryErr.message}`);
      }
    }

    if (summary.cleaned > 0) {
      console.log(
        `[STORAGE CLEANUP] Stale staging cleaner removed ${summary.cleaned} item(s) older than ${Math.round(
          maxAgeMs / 3600000
        )}h.`
      );
    }
  } catch (err) {
    console.warn(`[STORAGE CLEANUP] Stale staging cleaner notice: ${err.message}`);
    summary.errors.push(err.message);
  }

  return summary;
}

