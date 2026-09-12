import fs from "node:fs";
import path from "node:path";
import { AppError } from "../../middlewares/error.middleware.js";

/**
 * Local filesystem storage provider.
 * Stores files under the configured storage directory (defaulting to apps/api/storage/submissions).
 */
export class LocalStorageService {
  constructor(customDir) {
    if (customDir) {
      this.rootDir = path.resolve(customDir);
    } else if (process.env.NODE_ENV === "test" && process.env.TEST_SUBMISSION_STORAGE_DIR) {
      this.rootDir = path.resolve(process.env.TEST_SUBMISSION_STORAGE_DIR);
    } else if (process.env.SUBMISSION_STORAGE_DIR) {
      this.rootDir = path.resolve(process.env.SUBMISSION_STORAGE_DIR);
    } else {
      // Deterministic resolution: apps/api/src/services/storage -> apps/api/storage
      this.rootDir = path.resolve(import.meta.dirname, "../../../storage");
    }
  }

  /**
   * Resolves and verifies that a storage key resides strictly inside the rootDir.
   * Prevents path traversal vulnerabilities.
   *
   * @param {string} storageKey
   * @returns {string} Absolute filesystem path
   */
  resolvePath(storageKey) {
    if (!storageKey || typeof storageKey !== "string") {
      throw new AppError("Khóa lưu trữ không hợp lệ.", 400, "INVALID_STORAGE_KEY");
    }

    const normalizedKey = storageKey.replace(/\\/g, "/").trim();
    if (path.isAbsolute(normalizedKey) || normalizedKey.includes("..")) {
      throw new AppError(
        "Khóa lưu trữ chứa đường dẫn không hợp lệ (path traversal).",
        400,
        "INVALID_STORAGE_KEY"
      );
    }

    const fullPath = path.resolve(this.rootDir, normalizedKey);
    const relative = path.relative(this.rootDir, fullPath);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new AppError(
        "Khóa lưu trữ nằm ngoài thư mục lưu trữ cho phép.",
        400,
        "INVALID_STORAGE_KEY"
      );
    }

    return fullPath;
  }

  /**
   * Saves a buffer to storage.
   *
   * @param {string} storageKey
   * @param {Buffer} buffer
   * @returns {Promise<{ storageKey: string, size: number }>}
   */
  async saveFile(storageKey, buffer) {
    const fullPath = this.resolvePath(storageKey);
    const parentDir = path.dirname(fullPath);

    await fs.promises.mkdir(parentDir, { recursive: true });
    await fs.promises.writeFile(fullPath, buffer);

    return {
      storageKey,
      size: buffer.length,
    };
  }

  /**
   * Checks if a file exists.
   *
   * @param {string} storageKey
   * @returns {Promise<boolean>}
   */
  async fileExists(storageKey) {
    try {
      const fullPath = this.resolvePath(storageKey);
      await fs.promises.access(fullPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns a readable stream for the file.
   *
   * @param {string} storageKey
   * @returns {fs.ReadStream}
   */
  getFileStream(storageKey) {
    const fullPath = this.resolvePath(storageKey);
    if (!fs.existsSync(fullPath)) {
      throw new AppError("Không tìm thấy file lưu trữ.", 404, "STORAGE_FILE_NOT_FOUND");
    }
    return fs.createReadStream(fullPath);
  }

  /**
   * Reads file as buffer.
   *
   * @param {string} storageKey
   * @returns {Promise<Buffer>}
   */
  async getFileBuffer(storageKey) {
    const fullPath = this.resolvePath(storageKey);
    try {
      return await fs.promises.readFile(fullPath);
    } catch (err) {
      if (err.code === "ENOENT") {
        throw new AppError("Không tìm thấy file lưu trữ.", 404, "STORAGE_FILE_NOT_FOUND");
      }
      throw err;
    }
  }

  /**
   * Deletes a single file.
   *
   * @param {string} storageKey
   * @returns {Promise<boolean>}
   */
  async deleteFile(storageKey) {
    try {
      const fullPath = this.resolvePath(storageKey);
      await fs.promises.unlink(fullPath);
      return true;
    } catch (err) {
      if (err.code === "ENOENT") {
        return false;
      }
      throw err;
    }
  }

  /**
   * Deletes multiple files.
   *
   * @param {string[]} storageKeys
   * @returns {Promise<void>}
   */
  async deleteFiles(storageKeys) {
    if (!Array.isArray(storageKeys)) return;
    for (const key of storageKeys) {
      await this.deleteFile(key).catch(() => {});
    }
  }

  /**
   * Deletes an entire relative directory under storage (useful for compensation).
   *
   * @param {string} relativeDir
   * @returns {Promise<void>}
   */
  async deleteDirectory(relativeDir) {
    if (!relativeDir) return;
    try {
      const fullPath = this.resolvePath(relativeDir);
      await fs.promises.rm(fullPath, { recursive: true, force: true });
    } catch {
      // Ignore if directory doesn't exist
    }
  }

  /**
   * Returns the storage root directory.
   *
   * @returns {string}
   */
  getStorageRoot() {
    return this.rootDir;
  }
}
