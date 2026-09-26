import fs from "node:fs";
import { Worker } from "bullmq";
import { redisConnectionOptions, isRedisConfigured } from "../config/redis.config.js";
import { GRADING_QUEUE_NAME, getBatchRecord, saveBatchRecord } from "./grading.queue.js";
import { createSubmission } from "../services/submission.service.js";
import {
  storageService,
  cleanupStagedFile,
  cleanupStagedBatch,
} from "../services/storage/storage.service.js";

let worker = null;

/**
 * Process a single OMR exam sheet from the BullMQ queue using storage reference (FINDING-005)
 */
async function processGradingJob(job) {
  const {
    batchId,
    examId,
    user,
    storageKey,
    stagingPath,
    originalFilename,
    filename,
    mimeType,
    itemIndex,
  } = job.data;

  const targetFilename = originalFilename || filename || `sheet_${itemIndex + 1}.jpg`;
  console.log(`[QUEUE] Processing batch ${batchId} - item ${itemIndex + 1}: ${targetFilename}`);

  // Retrieve image buffer from staging storage reference
  let imageBuffer = null;
  try {
    if (storageKey && (await storageService.fileExists(storageKey))) {
      imageBuffer = await storageService.getFileBuffer(storageKey);
    } else if (stagingPath && fs.existsSync(stagingPath)) {
      imageBuffer = await fs.promises.readFile(stagingPath);
    }
  } catch (readErr) {
    console.error(
      `[QUEUE] Failed to read staged image for batch ${batchId} item ${itemIndex + 1}:`,
      readErr.message
    );
  }

  if (!imageBuffer) {
    const record = (await getBatchRecord(batchId).catch(() => null)) || {
      batchId,
      examId,
      total: 1,
      completed: 0,
      failed: 0,
      results: [],
    };
    record.failed = (record.failed || 0) + 1;
    record.results.push({
      itemIndex,
      filename: targetFilename,
      status: "failed",
      error: "Không tìm thấy file ảnh tạm trên hệ thống lưu trữ.",
      code: "STAGED_FILE_NOT_FOUND",
      processedAt: new Date().toISOString(),
    });
    if ((record.completed || 0) + record.failed >= record.total) {
      record.status = record.completed > 0 ? "completed_with_errors" : "failed";
      record.finishedAt = new Date().toISOString();
      await cleanupStagedBatch(batchId).catch(() => {});
    }
    await saveBatchRecord(batchId, record).catch(() => {});
    return { success: false, error: "STAGED_FILE_NOT_FOUND" };
  }

  try {
    const result = await createSubmission({
      examId,
      imageBuffer,
      originalFilename: targetFilename,
      mimeType: mimeType || "image/jpeg",
      user,
    });

    // Update batch record on success
    const record = (await getBatchRecord(batchId)) || {
      batchId,
      examId,
      total: 1,
      completed: 0,
      failed: 0,
      results: [],
    };

    record.completed = (record.completed || 0) + 1;
    record.results.push({
      itemIndex,
      filename: targetFilename,
      status: "success",
      submissionId: result.submission?.id,
      studentName: result.student?.fullName || null,
      studentCode: result.student?.studentCode || result.submission?.studentCodeRaw,
      score: result.submission?.totalScore,
      processedAt: new Date().toISOString(),
    });

    if (record.completed + (record.failed || 0) >= record.total) {
      record.status = (record.failed || 0) > 0 ? "completed_with_errors" : "completed";
      record.finishedAt = new Date().toISOString();
      // Clean up entire staging directory once batch completes
      await cleanupStagedBatch(batchId).catch(() => {});
    }

    await saveBatchRecord(batchId, record);

    return { success: true, submissionId: result.submission?.id };
  } catch (err) {
    console.error(
      `[QUEUE] Failed batch ${batchId} - item ${itemIndex + 1} (${targetFilename}):`,
      err.message
    );

    const record = (await getBatchRecord(batchId)) || {
      batchId,
      examId,
      total: 1,
      completed: 0,
      failed: 0,
      results: [],
    };

    record.failed = (record.failed || 0) + 1;
    record.results.push({
      itemIndex,
      filename: targetFilename,
      status: "failed",
      error: err.message || "Lỗi không xác định khi chấm phiếu thi.",
      code: err.code || "GRADING_FAILED",
      processedAt: new Date().toISOString(),
    });

    if ((record.completed || 0) + record.failed >= record.total) {
      record.status = record.completed > 0 ? "completed_with_errors" : "failed";
      record.finishedAt = new Date().toISOString();
      await cleanupStagedBatch(batchId).catch(() => {});
    }

    await saveBatchRecord(batchId, record);

    throw err;
  } finally {
    // Delete individual staging file reference after job execution attempt (success or max retry)
    if (storageKey) {
      await cleanupStagedFile(storageKey).catch(() => {});
    }
  }
}

/**
 * Initialize background queue worker
 */
export function initGradingWorker() {
  if (worker) return worker;
  if (!isRedisConfigured()) {
    console.log("[QUEUE] Skipping BullMQ Worker initialization: Redis not configured.");
    return null;
  }

  const concurrency = Number(process.env.GRADING_WORKER_CONCURRENCY) || 2;

  try {
    worker = new Worker(GRADING_QUEUE_NAME, processGradingJob, {
      connection: redisConnectionOptions,
      concurrency,
    });

    worker.on("ready", () => {
      console.log(`[QUEUE] BullMQ Grading Worker initialized with concurrency: ${concurrency}`);
    });

    worker.on("error", (err) => {
      console.warn("[QUEUE] Worker warning:", err.message);
    });

    worker.on("failed", (job, err) => {
      console.warn(`[QUEUE] Job ${job?.id} failed with error:`, err.message);
    });
  } catch (err) {
    console.warn("[QUEUE] Could not initialize BullMQ Worker (Redis might be offline):", err.message);
  }

  return worker;
}

/**
 * Gracefully close worker
 */
export async function closeGradingWorker() {
  if (worker) {
    console.log("[QUEUE] Closing BullMQ Grading Worker...");
    await worker.close();
    worker = null;
  }
}
