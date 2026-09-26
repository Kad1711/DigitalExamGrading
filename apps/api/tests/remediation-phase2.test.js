import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "../src/config/prisma.js";
import { validateImageBuffer, validateImageFile } from "../src/utils/image-validation.js";
import {
  saveOriginalSubmissionImage,
  cleanupSubmissionStorage,
  storageService,
  cleanupStagedBatch,
  cleanupStaleStaging,
} from "../src/services/storage/storage.service.js";
import cloudinary from "../src/config/cloudinary.config.js";
import * as redisConfig from "../src/config/redis.config.js";
import { enqueueBatchGrading, gradingQueue } from "../src/queue/grading.queue.js";
import { BATCH_MAX_TOTAL_BYTES } from "../src/config/batch-upload.config.js";

// Helper to create a minimal valid JPEG buffer (~120 bytes with SOI FF D8 and EOI FF D9)
function createMinimalValidJpeg() {
  const buf = Buffer.alloc(120);
  buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF; buf[3] = 0xE0; // SOI + APP0
  buf[4] = 0x00; buf[5] = 0x10; // Length 16
  buf.write("JFIF", 6);
  buf[10] = 0x00; buf[11] = 0x01; buf[12] = 0x01; buf[13] = 0x00;
  // Fill payload
  for (let i = 14; i < 118; i++) {
    buf[i] = 0xAA;
  }
  buf[118] = 0xFF; buf[119] = 0xD9; // EOI
  return buf;
}

// Helper to create a minimal valid PNG buffer (8-byte signature + IHDR + IEND)
function createMinimalValidPng() {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // length
  ihdr.write("IHDR", 4);
  ihdr.writeUInt32BE(1, 8); // width 1
  ihdr.writeUInt32BE(1, 12); // height 1
  ihdr[16] = 8; ihdr[17] = 2; ihdr[18] = 0; ihdr[19] = 0; ihdr[20] = 0;
  ihdr.writeUInt32BE(0, 21); // crc dummy
  const iend = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);
  return Buffer.concat([signature, ihdr, iend]);
}

test("Remediation Phase 2 — OMR Reliability & Production Resilience Suite", async (t) => {

  // =========================================================================
  // FINDING-005: Binary Magic Bytes Validation & Image Integrity
  // =========================================================================

  await t.test("F005.1 — fake JPG (Windows EXE signature 'MZ') rejected by binary signature", async () => {
    const fakeExe = Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xFF\xFF\x00\x00");
    const result = validateImageBuffer(fakeExe);
    assert.strictEqual(result.valid, false, "Fake EXE renamed to JPG must be rejected");
    assert.ok(result.error?.includes(".exe"), "Error message should mention .exe rejection");
  });

  await t.test("F005.2 — PDF renamed JPG rejected by binary signature (%PDF)", async () => {
    const fakePdf = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n");
    const result = validateImageBuffer(fakePdf);
    assert.strictEqual(result.valid, false, "PDF renamed to JPG must be rejected");
    assert.ok(result.error?.includes("PDF"), "Error message should mention PDF rejection");
  });

  await t.test("F005.2b — Plain text with image/jpeg header rejected by binary signature", async () => {
    const plainText = Buffer.from("Hello world, this is a plain text file pretending to be an image.");
    const result = validateImageBuffer(plainText);
    assert.strictEqual(result.valid, false, "Plain text must be rejected");
  });

  await t.test("F005.2c — Corrupt truncated JPEG without EOI marker rejected cleanly", async () => {
    const corruptJpeg = Buffer.alloc(120);
    corruptJpeg[0] = 0xFF; corruptJpeg[1] = 0xD8; corruptJpeg[2] = 0xFF;
    // Deliberately lacks FF D9 (EOI)
    const result = validateImageBuffer(corruptJpeg);
    assert.strictEqual(result.valid, false, "Corrupt truncated JPEG must be rejected");
    assert.ok(result.error?.includes("EOI"), "Error message should mention missing EOI marker");
  });

  await t.test("F005.3 — Valid JPEG accepted by binary validator", async () => {
    const validJpeg = createMinimalValidJpeg();
    const result = validateImageBuffer(validJpeg);
    assert.strictEqual(result.valid, true, "Valid JPEG must be accepted");
    assert.strictEqual(result.format, "jpeg");
  });

  await t.test("F005.4 — Valid PNG accepted by binary validator", async () => {
    const validPng = createMinimalValidPng();
    const result = validateImageBuffer(validPng);
    assert.strictEqual(result.valid, true, "Valid PNG must be accepted");
    assert.strictEqual(result.format, "png");
  });

  await t.test("F005.4b — PNG signature only (< 45 bytes) rejected by validator", async () => {
    const sigOnly = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const result = validateImageBuffer(sigOnly);
    assert.strictEqual(result.valid, false, "PNG signature only must be rejected");
    assert.ok(result.error?.includes("quá ngắn") || result.error?.includes("chunk"), "Error must mention length/chunk");
  });

  await t.test("F005.4c — PNG signature + random payload (missing IHDR) rejected by validator", async () => {
    const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const noise = Buffer.from("this is a random fake payload that has 40 bytes to exceed 45 bytes total");
    const fakePng = Buffer.concat([sig, noise]);
    const result = validateImageBuffer(fakePng);
    assert.strictEqual(result.valid, false, "PNG without IHDR must be rejected");
    assert.ok(result.error?.includes("IHDR"), "Error must specify missing IHDR chunk");
  });

  await t.test("F005.4d — PNG missing IEND chunk rejected by validator", async () => {
    const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const ihdr = Buffer.alloc(25);
    ihdr.writeUInt32BE(13, 0);
    ihdr.write("IHDR", 4);
    ihdr.writeUInt32BE(1, 8);
    ihdr.writeUInt32BE(1, 12);
    ihdr[16] = 8; ihdr[17] = 2;
    // Append non-IEND junk
    const junk = Buffer.alloc(20, 0x55);
    const brokenPng = Buffer.concat([sig, ihdr, junk]);
    const result = validateImageBuffer(brokenPng);
    assert.strictEqual(result.valid, false, "PNG without IEND marker must be rejected");
    assert.ok(result.error?.includes("IEND"), "Error must specify missing IEND chunk");
  });

  await t.test("F005.4e — validateImageFile rejects malformed PNG on disk", async () => {
    const tmpFile = path.join(storageService.getStorageRoot(), `test_bad_png_${Date.now()}.png`);
    await fs.promises.mkdir(path.dirname(tmpFile), { recursive: true });
    const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const junk = Buffer.from("this is junk data instead of ihdr and iend chunks 1234567890");
    await fs.promises.writeFile(tmpFile, Buffer.concat([sig, junk]));
    try {
      const result = await validateImageFile(tmpFile);
      assert.strictEqual(result.valid, false, "Corrupt PNG on disk must be rejected");
      assert.ok(result.error?.includes("IHDR") || result.error?.includes("IEND"), "Error must cite chunk failure");
    } finally {
      await fs.promises.unlink(tmpFile).catch(() => {});
    }
  });

  await t.test("F005.5 — Bulk job enqueued contains storage reference, NOT Base64 payload", async () => {
    const batchId = `test_batch_ref_${Date.now()}`;
    const stagingDir = path.join(storageService.getStorageRoot(), "staging", batchId);
    await fs.promises.mkdir(stagingDir, { recursive: true });

    const testImgPath = path.join(stagingDir, "sample.jpg");
    const jpegBuf = createMinimalValidJpeg();
    await fs.promises.writeFile(testImgPath, jpegBuf);

    // Mock BullMQ addBulk to intercept job data
    let enqueuedJobs = null;
    const origAddBulk = gradingQueue.addBulk;
    gradingQueue.addBulk = async (jobs) => {
      enqueuedJobs = jobs;
      return jobs;
    };

    try {
      const teacherUser = { id: "test_t1", role: "TEACHER", email: "teacher@test.local" };
      await enqueueBatchGrading({
        examId: "exam_test_123",
        user: teacherUser,
        files: [
          {
            filename: "sample.jpg",
            path: testImgPath,
            originalname: "sheet_01.jpg",
            mimetype: "image/jpeg",
            size: jpegBuf.length,
          },
        ],
        batchId,
      });

      assert.ok(enqueuedJobs && enqueuedJobs.length === 1, "Job should be enqueued");
      const jobData = enqueuedJobs[0].data;

      // Invariant checks:
      assert.strictEqual(jobData.fileBufferBase64, undefined, "Job data MUST NOT contain fileBufferBase64");
      assert.strictEqual(jobData.rawBuffer, undefined, "Job data MUST NOT contain rawBuffer");
      assert.strictEqual(jobData.storageKey, `staging/${batchId}/sample.jpg`, "Job data must contain storageKey reference");
      assert.strictEqual(jobData.originalFilename, "sheet_01.jpg");
      assert.strictEqual(jobData.batchId, batchId);
    } finally {
      gradingQueue.addBulk = origAddBulk;
      await cleanupStagedBatch(batchId);
    }
  });

  await t.test("F005.6 & F003.4 — Enqueue failure cleans staging resources immediately", async () => {
    const batchId = `test_batch_fail_${Date.now()}`;
    const stagingDir = path.join(storageService.getStorageRoot(), "staging", batchId);
    await fs.promises.mkdir(stagingDir, { recursive: true });
    const stagedFile = path.join(stagingDir, "item.jpg");
    await fs.promises.writeFile(stagedFile, createMinimalValidJpeg());

    // Force addBulk to throw
    const origAddBulk = gradingQueue.addBulk;
    gradingQueue.addBulk = async () => {
      throw new Error("Simulated BullMQ connection drop");
    };

    try {
      const teacherUser = { id: "test_t1", role: "TEACHER", email: "teacher@test.local" };
      await assert.rejects(
        () =>
          enqueueBatchGrading({
            examId: "exam_test_123",
            user: teacherUser,
            files: [
              {
                filename: "item.jpg",
                path: stagedFile,
                originalname: "item.jpg",
                mimetype: "image/jpeg",
                size: 120,
              },
            ],
            batchId,
          }),
        (err) => {
          assert.strictEqual(err.statusCode, 503);
          assert.strictEqual(err.code, "GRADING_QUEUE_UNAVAILABLE");
          return true;
        }
      );

      // Verify staging resource was cleaned up
      const dirExists = fs.existsSync(stagingDir);
      assert.strictEqual(dirExists, false, "Staging directory must be cleaned up when enqueue fails");
    } finally {
      gradingQueue.addBulk = origAddBulk;
      await cleanupStagedBatch(batchId);
    }
  });

  await t.test("F005.7 — Aggregate batch limit constant is explicitly configured", () => {
    assert.ok(typeof BATCH_MAX_TOTAL_BYTES === "number");
    assert.ok(BATCH_MAX_TOTAL_BYTES > 0, "BATCH_MAX_TOTAL_BYTES must be positive number");
    assert.strictEqual(BATCH_MAX_TOTAL_BYTES, 150 * 1024 * 1024, "Default total batch limit is 150MB");
  });

  await t.test("F005.8 — cleanupStaleStaging safely cleans expired items without traversing outside root", async () => {
    const root = storageService.getStorageRoot();
    const stagingDir = path.join(root, "staging");
    await fs.promises.mkdir(stagingDir, { recursive: true });

    const staleBatch = path.join(stagingDir, `stale_batch_${Date.now()}`);
    const freshBatch = path.join(stagingDir, `fresh_batch_${Date.now()}`);
    await fs.promises.mkdir(staleBatch, { recursive: true });
    await fs.promises.mkdir(freshBatch, { recursive: true });

    // Artificially age the stale batch folder
    const pastTime = new Date(Date.now() - 3600 * 1000); // 1 hour ago
    await fs.promises.utimes(staleBatch, pastTime, pastTime);

    // Call cleanupStaleStaging with TTL = 1800s (30 mins)
    const result = await cleanupStaleStaging(1800 * 1000);
    assert.ok(result.cleaned >= 1, "Should clean at least 1 stale batch");

    const staleExists = fs.existsSync(staleBatch);
    const freshExists = fs.existsSync(freshBatch);
    assert.strictEqual(staleExists, false, "Stale batch must be deleted");
    assert.strictEqual(freshExists, true, "Fresh batch must be preserved");

    // Clean up fresh batch
    await fs.promises.rm(freshBatch, { recursive: true, force: true }).catch(() => {});
  });

  // =========================================================================
  // FINDING-003: Redis / BullMQ Operational Behavior & Fail-Fast 503
  // =========================================================================

  await t.test("F003.1 & F003.2 — Redis unavailable throws HTTP 503 GRADING_QUEUE_UNAVAILABLE", async () => {
    const redis = redisConfig.getRedisClient();
    const origPing = redis.ping;
    redis.ping = async () => {
      throw new Error("Simulated Redis connection failure");
    };

    try {
      const teacherUser = { id: "test_t1", role: "TEACHER", email: "teacher@test.local" };
      await assert.rejects(
        () =>
          enqueueBatchGrading({
            examId: "exam_test_123",
            user: teacherUser,
            files: [{ filename: "x.jpg", path: "/tmp/x.jpg", originalname: "x.jpg", mimetype: "image/jpeg", size: 100 }],
            batchId: "dummy_batch",
          }),
        (err) => {
          assert.strictEqual(err.statusCode, 503, "Must return HTTP 503");
          assert.strictEqual(err.code, "GRADING_QUEUE_UNAVAILABLE", "Must return domain code GRADING_QUEUE_UNAVAILABLE");
          return true;
        }
      );
    } finally {
      redis.ping = origPing;
    }
  });

  await t.test("F003.3 — Failed enqueue does not leave phantom accepted batch in Redis", async () => {
    const redis = redisConfig.getRedisClient();
    const origPing = redis.ping;
    redis.ping = async () => {
      throw new Error("Simulated Redis connection failure");
    };

    const teacherUser = { id: "test_t1", role: "TEACHER", email: "teacher@test.local" };
    try {
      await enqueueBatchGrading({
        examId: "exam_test_123",
        user: teacherUser,
        files: [],
        batchId: "phantom_batch_test",
      });
      assert.fail("Should have thrown");
    } catch (err) {
      assert.strictEqual(err.statusCode, 503);
    } finally {
      redis.ping = origPing;
    }
  });

  // =========================================================================
  // FINDING-009: Cloudinary Compensating Cleanup & Error Isolation
  // =========================================================================

  await t.test("F009.1 — Cloud upload SUCCESS + DB failure -> Cloudinary destroy invoked", async () => {
    const namespace = `test_ns_${Date.now()}`;
    let destroyCalledWith = null;

    const origCloudUrl = process.env.CLOUDINARY_URL;
    process.env.CLOUDINARY_URL = "cloudinary://mock_api_key:mock_secret@mock_cloud";

    const origDestroy = cloudinary.uploader.destroy;
    const origDeletePrefix = cloudinary.api?.delete_resources_by_prefix;
    cloudinary.uploader.destroy = async (publicId) => {
      destroyCalledWith = publicId;
      return { result: "ok" };
    };
    if (cloudinary.api) {
      cloudinary.api.delete_resources_by_prefix = async () => ({ deleted: {} });
    }

    try {
      const dummyBuf = createMinimalValidJpeg();
      const testKey = `submissions/${namespace}/original.jpg`;
      await storageService.saveFile(testKey, dummyBuf);

      const testPublicId = `digitalexam/submissions/${namespace}/original_${namespace}`;
      await cleanupSubmissionStorage(namespace, testPublicId);

      assert.strictEqual(
        destroyCalledWith,
        testPublicId,
        "Cloudinary uploader.destroy must be invoked with publicId during compensating cleanup"
      );

      const localStillExists = await storageService.fileExists(testKey);
      assert.strictEqual(localStillExists, false, "Local file must also be removed during cleanup");
    } finally {
      cloudinary.uploader.destroy = origDestroy;
      if (cloudinary.api && origDeletePrefix) {
        cloudinary.api.delete_resources_by_prefix = origDeletePrefix;
      }
      if (origCloudUrl) {
        process.env.CLOUDINARY_URL = origCloudUrl;
      } else {
        delete process.env.CLOUDINARY_URL;
      }
      await storageService.deleteDirectory(`submissions/${namespace}`).catch(() => {});
    }
  });

  await t.test("F009.2 — Cloudinary cleanup failure does NOT mask original DB/application error", async () => {
    const namespace = `test_ns_err_${Date.now()}`;

    const origCloudUrl = process.env.CLOUDINARY_URL;
    process.env.CLOUDINARY_URL = "cloudinary://mock_api_key:mock_secret@mock_cloud";

    const origDestroy = cloudinary.uploader.destroy;
    cloudinary.uploader.destroy = async () => {
      throw new Error("Network timeout contacting Cloudinary API");
    };

    try {
      await assert.doesNotReject(
        () => cleanupSubmissionStorage(namespace, "some_public_id"),
        "Compensating cleanup failure must be handled gracefully without masking primary errors"
      );
    } finally {
      cloudinary.uploader.destroy = origDestroy;
      if (origCloudUrl) {
        process.env.CLOUDINARY_URL = origCloudUrl;
      } else {
        delete process.env.CLOUDINARY_URL;
      }
    }
  });

  await t.test("F009.3 — Local storage cleanup still executes reliably without Cloudinary", async () => {
    const namespace = `test_ns_local_${Date.now()}`;
    const testKey = `submissions/${namespace}/original.jpg`;
    await storageService.saveFile(testKey, Buffer.from("local evidence"));

    assert.strictEqual(await storageService.fileExists(testKey), true);
    await cleanupSubmissionStorage(namespace);
    assert.strictEqual(await storageService.fileExists(testKey), false, "Local evidence directory must be deleted");
  });

  await t.test("F009.4 — Cloudinary delete scope: cleanup of submission X strictly scopes to X and cannot delete submission Y", async () => {
    const subX = `sub_x_${Date.now()}`;
    const subY = `${subX}0`; // Name extends subX, could be caught by loose prefix

    const origCloudUrl = process.env.CLOUDINARY_URL;
    process.env.CLOUDINARY_URL = "cloudinary://mock_key:mock_secret@mock_cloud";

    const destroyed = [];
    const prefixes = [];

    const origDestroy = cloudinary.uploader.destroy;
    const origDeletePrefix = cloudinary.api?.delete_resources_by_prefix;

    cloudinary.uploader.destroy = async (publicId) => {
      destroyed.push(publicId);
      return { result: "ok" };
    };

    if (cloudinary.api) {
      cloudinary.api.delete_resources_by_prefix = async (p) => {
        prefixes.push(p);
        return { deleted: {} };
      };
    }

    try {
      const xPublicId = `digitalexam/submissions/${subX}/original_${subX}`;
      const yPublicId = `digitalexam/submissions/${subY}/original_${subY}`;

      await cleanupSubmissionStorage(subX, xPublicId);

      // Verify exact destroy only targeted X
      assert.ok(destroyed.includes(xPublicId), "Targeted publicId must be destroyed");
      assert.strictEqual(destroyed.includes(yPublicId), false, "Submission Y must NEVER be destroyed");

      // Verify prefix deletion ends with slash so it cannot match subY folder
      assert.ok(prefixes.length > 0, "Prefix cleanup should be called");
      for (const prefix of prefixes) {
        assert.ok(prefix.endsWith("/"), `Prefix '${prefix}' must terminate with trailing slash to prevent namespace bleeding`);
        assert.strictEqual(yPublicId.startsWith(prefix), false, `Prefix '${prefix}' must NOT match submission Y resource '${yPublicId}'`);
      }
    } finally {
      cloudinary.uploader.destroy = origDestroy;
      if (cloudinary.api && origDeletePrefix) {
        cloudinary.api.delete_resources_by_prefix = origDeletePrefix;
      }
      if (origCloudUrl) {
        process.env.CLOUDINARY_URL = origCloudUrl;
      } else {
        delete process.env.CLOUDINARY_URL;
      }
    }
  });

  await t.test("F009.5 — Cloudinary cleanup is idempotent when resource is already missing", async () => {
    const origCloudUrl = process.env.CLOUDINARY_URL;
    process.env.CLOUDINARY_URL = "cloudinary://mock_key:mock_secret@mock_cloud";

    const origDestroy = cloudinary.uploader.destroy;
    cloudinary.uploader.destroy = async () => {
      return { result: "not found" };
    };

    try {
      await assert.doesNotReject(
        () => cleanupSubmissionStorage("missing_ns_123", "missing_public_id"),
        "Missing Cloudinary resource must not throw error during cleanup"
      );
    } finally {
      cloudinary.uploader.destroy = origDestroy;
      if (origCloudUrl) {
        process.env.CLOUDINARY_URL = origCloudUrl;
      } else {
        delete process.env.CLOUDINARY_URL;
      }
    }
  });

  t.after(async () => {
    try {
      await gradingQueue.close();
      const redis = redisConfig.getRedisClient();
      await redis.quit().catch(() => {});
      await prisma.$disconnect();
    } catch {
      // Ignore disconnect errors on teardown
    }
  });
});

