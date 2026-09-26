import { Readable } from "node:stream";
import cloudinary, { isCloudinaryConfigured } from "../../config/cloudinary.config.js";
import { AppError } from "../../middlewares/error.middleware.js";

/**
 * Upload a binary Buffer (Image or Video) to Cloudinary.
 *
 * @param {Buffer} buffer - File buffer
 * @param {object} options
 * @param {string} [options.folder='digitalexam'] - Cloudinary folder path
 * @param {string} [options.publicId] - Optional public ID
 * @param {string} [options.resourceType='auto'] - 'image' | 'video' | 'raw' | 'auto'
 * @returns {Promise<{ url: string, secureUrl: string, publicId: string, format: string, bytes: number }>}
 */
export async function uploadBufferToCloudinary(
  buffer,
  { folder = "digitalexam", publicId, resourceType = "auto" } = {}
) {
  if (!isCloudinaryConfigured()) {
    throw new AppError(
      "Cloudinary chưa được cấu hình. Vui lòng điền API Key và Secret vào file apps/api/.env",
      500,
      "CLOUDINARY_NOT_CONFIGURED"
    );
  }

  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new AppError("Dữ liệu file không hợp lệ để tải lên Cloudinary.", 400, "INVALID_BUFFER");
  }

  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      resource_type: resourceType,
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
      uploadOptions.overwrite = true;
    }

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        console.error("[CLOUDINARY UPLOAD ERROR]", error);
        return reject(
          new AppError(
            `Tải lên Cloudinary thất bại: ${error.message || "Lỗi không xác định"}`,
            502,
            "CLOUDINARY_UPLOAD_FAILED"
          )
        );
      }

      resolve({
        url: result.url,
        secureUrl: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        bytes: result.bytes,
        resourceType: result.resource_type,
      });
    });

    Readable.from(buffer).pipe(stream);
  });
}

/**
 * Delete a file from Cloudinary by public ID.
 *
 * @param {string} publicId
 * @param {object} options
 * @param {string} [options.resourceType='image'] - 'image' | 'video' | 'raw'
 */
export async function deleteFromCloudinary(publicId, { resourceType = "image" } = {}) {
  if (!isCloudinaryConfigured() || !publicId) return;

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return result;
  } catch (err) {
    console.warn(`[CLOUDINARY DELETE] Could not delete ${publicId}:`, err.message);
  }
}

/**
 * Delete all Cloudinary resources matching a folder/prefix (compensating cleanup).
 *
 * @param {string} prefix - Cloudinary resource prefix (e.g. digitalexam/submissions/<namespace>)
 */
export async function deletePrefixFromCloudinary(prefix) {
  if (!isCloudinaryConfigured() || !prefix) return;

  // Enforce folder boundary by ensuring prefix ends with a slash if not already
  const safePrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
  try {
    const result = await cloudinary.api.delete_resources_by_prefix(safePrefix);
    return result;
  } catch (err) {
    console.warn(`[CLOUDINARY DELETE PREFIX] Could not delete prefix ${safePrefix}:`, err.message);
  }
}

