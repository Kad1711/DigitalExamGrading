import "dotenv/config";

/**
 * Centralized configuration for batch submissions & bulk grading upload.
 * Provides explicit aggregate limits to prevent Node OOM and DoS.
 */

// Maximum number of image files in a single batch
export const BATCH_MAX_FILES = Number(process.env.BATCH_MAX_FILES) || 50;

// Maximum byte size per individual file (default 15 MB)
export const BATCH_MAX_FILE_BYTES =
  Number(process.env.BATCH_MAX_FILE_BYTES) || 15 * 1024 * 1024;

// Maximum aggregate byte size across all files in the batch (default 150 MB)
export const BATCH_MAX_TOTAL_BYTES =
  Number(process.env.BATCH_MAX_TOTAL_BYTES) || 150 * 1024 * 1024;
