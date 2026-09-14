import { Worker } from "bullmq";
import { redisConnectionOptions } from "../config/redis.config.js";
import { GRADING_QUEUE_NAME, getBatchRecord, saveBatchRecord } from "./grading.queue.js";
import { createSubmission } from "../services/submission.service.js";

let worker = null;

/**
 * Process a single OMR exam sheet from the BullMQ queue
 */
async function processGradingJob(job) {
  const { batchId, examId, user, fileBufferBase64, filename, mimeType, itemIndex } = job.data;

  console.log(`[QUEUE] Processing batch ${batchId} - item ${itemIndex + 1}: ${filename}`);

  const imageBuffer = Buffer.from(fileBufferBase64, "base64");

  try {
    const result = await createSubmission({
      examId,
      imageBuffer,
      originalFilename: filename,
      mimeType,
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
      filename,
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
    }

    await saveBatchRecord(batchId, record);

    return { success: true, submissionId: result.submission?.id };
  } catch (err) {
    console.error(`[QUEUE] Failed batch ${batchId} - item ${itemIndex + 1} (${filename}):`, err.message);

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
      filename,
      status: "failed",
      error: err.message || "Lỗi không xác định khi chấm phiếu thi.",
      code: err.code || "GRADING_FAILED",
      processedAt: new Date().toISOString(),
    });

    if ((record.completed || 0) + record.failed >= record.total) {
      record.status = record.completed > 0 ? "completed_with_errors" : "failed";
      record.finishedAt = new Date().toISOString();
    }

    await saveBatchRecord(batchId, record);

    // Let BullMQ know this attempt failed
    throw err;
  }
}

/**
 * Initialize background queue worker
 */
export function initGradingWorker() {
  if (worker) return worker;

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
