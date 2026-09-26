import fs from "node:fs";

/**
 * Validates actual binary format (magic bytes) of an in-memory image buffer.
 * Supports strictly JPEG and PNG.
 *
 * @param {Buffer} buffer - File buffer
 * @returns {{ valid: boolean, format: 'jpeg' | 'png' | null, error?: string }}
 */
export function validateImageBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 8) {
    return {
      valid: false,
      format: null,
      error: "Dữ liệu ảnh rỗng hoặc không đủ kích thước header tối thiểu.",
    };
  }

  // 1. Check PNG signature (8 bytes) + structural IHDR chunk + IEND chunk
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A;

  if (isPng) {
    // Valid PNG requires signature (8) + IHDR chunk (25) + IEND chunk (12) = minimum 45 bytes
    if (buffer.length < 45) {
      return {
        valid: false,
        format: null,
        error: "File PNG bị hỏng hoặc quá ngắn (thiếu cấu trúc chunk tối thiểu).",
      };
    }

    // First chunk must be IHDR: ASCII 'IHDR' (49 48 44 52) at bytes 12-15
    const hasIhdr =
      buffer[12] === 0x49 &&
      buffer[13] === 0x48 &&
      buffer[14] === 0x44 &&
      buffer[15] === 0x52;

    if (!hasIhdr) {
      return {
        valid: false,
        format: null,
        error: "File PNG bị hỏng (thiếu chunk IHDR bắt buộc).",
      };
    }

    // Terminal chunk must be IEND (49 45 4E 44) in the tail slice
    const tailSlice = buffer.subarray(Math.max(0, buffer.length - 32));
    const hasIend = tailSlice.includes(Buffer.from([0x49, 0x45, 0x4E, 0x44]));
    if (!hasIend) {
      return {
        valid: false,
        format: null,
        error: "File PNG bị hỏng (thiếu chunk kết thúc IEND).",
      };
    }

    return { valid: true, format: "png" };
  }

  // 2. Check JPEG signature: FF D8 FF
  const isJpeg =
    buffer[0] === 0xFF &&
    buffer[1] === 0xD8 &&
    buffer[2] === 0xFF;

  if (isJpeg) {
    // Valid JPEG requires SOI (FF D8) and EOI (FF D9)
    if (buffer.length < 100) {
      return {
        valid: false,
        format: null,
        error: "File JPEG bị hỏng hoặc quá ngắn để chứa cấu trúc ảnh hợp lệ.",
      };
    }
    const tailSlice = buffer.subarray(Math.max(0, buffer.length - 64));
    const hasEoi = tailSlice.includes(Buffer.from([0xFF, 0xD9]));
    if (!hasEoi) {
      return {
        valid: false,
        format: null,
        error: "File JPEG bị hỏng (thiếu marker kết thúc EOI).",
      };
    }
    return { valid: true, format: "jpeg" };
  }

  // 3. Explicitly detect and reject non-supported formats with clear diagnostics
  // PDF: %PDF (25 50 44 46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return {
      valid: false,
      format: null,
      error: "File PDF không được chấp nhận. Hệ thống chỉ xử lý ảnh chụp định dạng JPEG hoặc PNG.",
    };
  }

  // Windows Executable / PE: MZ (4D 5A)
  if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
    return {
      valid: false,
      format: null,
      error: "File thực thi nhị phân (.exe) bị từ chối tuyệt đối vì lý do bảo mật.",
    };
  }

  // GIF: GIF87a / GIF89a (47 49 46 38)
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return {
      valid: false,
      format: null,
      error: "Định dạng GIF không được hỗ trợ cho xử lý OMR.",
    };
  }

  // WebP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return {
      valid: false,
      format: null,
      error: "Định dạng WebP chưa được hỗ trợ trong pipeline OMR hiện tại.",
    };
  }

  return {
    valid: false,
    format: null,
    error: "Định dạng file không hợp lệ hoặc không đúng chữ ký nhị phân của JPEG / PNG.",
  };
}

/**
 * Validates a staged file on disk by reading only header and trailer without full memory loading.
 *
 * @param {string} filePath - Absolute path to file on disk
 * @returns {Promise<{ valid: boolean, format: 'jpeg' | 'png' | null, error?: string }>}
 */
export async function validateImageFile(filePath) {
  const stat = await fs.promises.stat(filePath);
  if (stat.size < 8) {
    return {
      valid: false,
      format: null,
      error: "File rỗng hoặc quá nhỏ để là ảnh hợp lệ.",
    };
  }

  const fd = await fs.promises.open(filePath, "r");
  try {
    const headLen = Math.min(256, stat.size);
    const headBuf = Buffer.alloc(headLen);
    await fd.read(headBuf, 0, headLen, 0);

    const isPng =
      headBuf.length >= 8 &&
      headBuf[0] === 0x89 &&
      headBuf[1] === 0x50 &&
      headBuf[2] === 0x4E &&
      headBuf[3] === 0x47 &&
      headBuf[4] === 0x0D &&
      headBuf[5] === 0x0A &&
      headBuf[6] === 0x1A &&
      headBuf[7] === 0x0A;

    if (isPng) {
      if (stat.size < 45) {
        return {
          valid: false,
          format: null,
          error: "File PNG bị hỏng hoặc quá ngắn (thiếu cấu trúc chunk tối thiểu).",
        };
      }

      const hasIhdr =
        headBuf.length >= 16 &&
        headBuf[12] === 0x49 &&
        headBuf[13] === 0x48 &&
        headBuf[14] === 0x44 &&
        headBuf[15] === 0x52;

      if (!hasIhdr) {
        return {
          valid: false,
          format: null,
          error: "File PNG bị hỏng (thiếu chunk IHDR bắt buộc).",
        };
      }

      const tailLen = Math.min(32, stat.size);
      const tailBuf = Buffer.alloc(tailLen);
      await fd.read(tailBuf, 0, tailLen, stat.size - tailLen);
      const hasIend = tailBuf.includes(Buffer.from([0x49, 0x45, 0x4E, 0x44]));
      if (!hasIend) {
        return {
          valid: false,
          format: null,
          error: "File PNG bị hỏng (thiếu chunk kết thúc IEND).",
        };
      }

      return { valid: true, format: "png" };
    }

    const isJpeg =
      headBuf.length >= 3 &&
      headBuf[0] === 0xFF &&
      headBuf[1] === 0xD8 &&
      headBuf[2] === 0xFF;

    if (isJpeg) {
      if (stat.size < 100) {
        return {
          valid: false,
          format: null,
          error: "File JPEG bị hỏng hoặc quá ngắn.",
        };
      }
      const tailLen = Math.min(64, stat.size);
      const tailBuf = Buffer.alloc(tailLen);
      await fd.read(tailBuf, 0, tailLen, stat.size - tailLen);
      const hasEoi = tailBuf.includes(Buffer.from([0xFF, 0xD9]));
      if (!hasEoi) {
        return {
          valid: false,
          format: null,
          error: "File JPEG bị hỏng (thiếu marker kết thúc EOI).",
        };
      }
      return { valid: true, format: "jpeg" };
    }

    if (headBuf[0] === 0x25 && headBuf[1] === 0x50 && headBuf[2] === 0x44 && headBuf[3] === 0x46) {
      return {
        valid: false,
        format: null,
        error: "File PDF không được chấp nhận. Hệ thống chỉ xử lý ảnh chụp định dạng JPEG hoặc PNG.",
      };
    }

    if (headBuf[0] === 0x4D && headBuf[1] === 0x5A) {
      return {
        valid: false,
        format: null,
        error: "File thực thi nhị phân (.exe) bị từ chối tuyệt đối vì lý do bảo mật.",
      };
    }

    return {
      valid: false,
      format: null,
      error: "Định dạng file không hợp lệ hoặc không đúng chữ ký nhị phân của JPEG / PNG.",
    };
  } finally {
    await fd.close();
  }
}
