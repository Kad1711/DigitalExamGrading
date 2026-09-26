import crypto from "node:crypto";
import path from "node:path";
import { Queue } from "bullmq";
import { redisConnectionOptions, getRedisClient, checkRedisHealth } from "../config/redis.config.js";
import { cleanupStagedBatch } from "../services/storage/storage.service.js";
import { AppError } from "../middlewares/error.middleware.js";

export const GRADING_QUEUE_NAME = "omr-grading";

export const gradingQueue = new Queue(GRADING_QUEUE_NAME, {
  connection: redisConnectionOptions,
});

/**
 * Save batch status into Redis.
 * Redis is a hard operational dependency; throws 503 if Redis is down (FINDING-003).
 */
export async function saveBatchRecord(batchId, data) {
  const isHealthy = await checkRedisHealth();
  if (!isHealthy) {
    throw new AppError(
      "Hệ thống hàng đợi chấm thi tự động (Redis) không khả dụng. Vui lòng thử lại sau.",
      503,
      "GRADING_QUEUE_UNAVAILABLE"
    );
  }
  const redis = getRedisClient();
  await redis.set(`batch:${batchId}`, JSON.stringify(data), "EX", 86400); // 24 hours TTL
}

/**
 * Retrieve batch status by batchId from Redis.
 */
export async function getBatchRecord(batchId) {
  const isHealthy = await checkRedisHealth();
  if (!isHealthy) {
    throw new AppError(
      "Hệ thống hàng đợi chấm thi tự động (Redis) không khả dụng. Vui lòng thử lại sau.",
      503,
      "GRADING_QUEUE_UNAVAILABLE"
    );
  }
  const redis = getRedisClient();
  const raw = await redis.get(`batch:${batchId}`);
  if (raw) return JSON.parse(raw);
  return null;
}

/**
 * Enqueue a batch of exam sheets for asynchronous grading.
 * Accepts files staged in storage; jobs contain ONLY storage references (no Base64, no Buffers) (FINDING-005).
 *
 * @param {Object} params
 * @param {string} params.examId
 * @param {Object} params.user
 * @param {Array<{ filename?: string, path?: string, originalname?: string, mimetype?: string, size?: number }>} params.files
 * @param {string} [params.batchId]
 * @returns {Promise<{ batchId: string, total: number }>}
 */
export async function enqueueBatchGrading({ examId, user, files, batchId: customBatchId }) {
  const isHealthy = await checkRedisHealth();
  if (!isHealthy) {
    if (customBatchId) {
      await cleanupStagedBatch(customBatchId);
    }
    throw new AppError(
      "Hệ thống hàng đợi chấm thi tự động (Redis) không khả dụng. Vui lòng thử lại sau.",
      503,
      "GRADING_QUEUE_UNAVAILABLE"
    );
  }

  const batchId =
    customBatchId || `batch_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const total = files.length;

  const initialRecord = {
    batchId,
    examId,
    total,
    completed: 0,
    failed: 0,
    status: "processing",
    createdAt: new Date().toISOString(),
    results: [],
  };

  try {
    await saveBatchRecord(batchId, initialRecord);

    // Enqueue jobs containing ONLY storage references (FINDING-005)
    const jobs = files.map((file, idx) => ({
      name: "grade-sheet",
      data: {
        batchId,
        examId,
        user: {
          id: user.id,
          role: user.role,
          email: user.email,
        },
        storageKey: `staging/${batchId}/${file.filename || path.basename(file.path || `sheet_${idx + 1}.jpg`)}`,
        stagingPath: file.path,
        originalFilename: file.originalname || `sheet_${idx + 1}.jpg`,
        mimeType: file.mimetype || "image/jpeg",
        itemIndex: idx,
      },
      opts: {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 1500,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    }));

    await gradingQueue.addBulk(jobs);

    return {
      batchId,
      total,
    };
  } catch (err) {
    // If saving batch or enqueuing jobs fails: clean up staged files immediately (FINDING-005 & FINDING-003)
    await cleanupStagedBatch(batchId);
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError(
      `Không thể đẩy đợt chấm vào hàng đợi: ${err.message}`,
      503,
      "GRADING_QUEUE_UNAVAILABLE"
    );
  }
}

