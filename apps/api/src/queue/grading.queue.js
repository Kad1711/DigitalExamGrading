import crypto from "node:crypto";
import { Queue } from "bullmq";
import { redisConnectionOptions, getRedisClient } from "../config/redis.config.js";

export const GRADING_QUEUE_NAME = "omr-grading";

export const gradingQueue = new Queue(GRADING_QUEUE_NAME, {
  connection: redisConnectionOptions,
});

/**
 * Fallback in-memory store for development if Redis key-value is offline
 */
const inMemoryBatchStore = new Map();

/**
 * Save batch status into Redis (or memory fallback)
 */
export async function saveBatchRecord(batchId, data) {
  try {
    const redis = getRedisClient();
    await redis.set(`batch:${batchId}`, JSON.stringify(data), "EX", 86400); // 24 hours TTL
  } catch {
    inMemoryBatchStore.set(batchId, data);
  }
}

/**
 * Retrieve batch status by batchId
 */
export async function getBatchRecord(batchId) {
  try {
    const redis = getRedisClient();
    const raw = await redis.get(`batch:${batchId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // Fall back to memory store
  }
  return inMemoryBatchStore.get(batchId) || null;
}

/**
 * Enqueue a batch of exam sheets for asynchronous grading
 *
 * @param {Object} params
 * @param {string} params.examId
 * @param {Object} params.user
 * @param {Array<{ buffer: Buffer, originalname: string, mimetype: string }>} params.files
 * @returns {Promise<{ batchId: string, total: number }>}
 */
export async function enqueueBatchGrading({ examId, user, files }) {
  const batchId = `batch_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
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

  await saveBatchRecord(batchId, initialRecord);

  // Enqueue jobs in bulk for high performance
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
      fileBufferBase64: file.buffer.toString("base64"),
      filename: file.originalname || `sheet_${idx + 1}.jpg`,
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
}
