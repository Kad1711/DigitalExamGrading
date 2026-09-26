# REMEDIATION PHASE 2.1 – PRODUCTION TOPOLOGY & CLEANUP VERIFICATION
**Project:** DigitalExamGrading  
**Author:** AI Agent (Pair Programming with User)  
**Date:** 2026-09-27  
**Scope:** Verification pass for Production Topology, Staging Cleanup, Image Validation Semantics, and Storage Isolation.  
**Frontend Protection Status:** `apps/web/**` 100% UNTOUCHED (User WIP preserved).  

---

## 1. Worker Deployment Topology

A rigorous trace was conducted across the production startup pipeline:
- `apps/api/package.json`: `"start": "node scripts/start-prod.js"`.
- `apps/api/scripts/start-prod.js`: Applies DB migrations and spawns `node src/server.js`.
- `apps/api/src/server.js`:
  ```javascript
  const server = app.listen(PORT, async () => {
    // Initialize BullMQ background queue worker only if Redis is configured
    const { isRedisConfigured } = await import("./config/redis.config.js");
    if (isRedisConfigured()) {
      const { initGradingWorker } = await import("./queue/grading.worker.js");
      initGradingWorker();
    }
  });
  ```
- `compose.yaml`: Configures a single container service `api` (`digital_exam_api`) running `node src/server.js` with volume mount `api_storage:/var/data/digitalexam`.

### Answers to Topology Questions:
1. **API Upload and BullMQ Worker Execution:**
   - Both the API upload HTTP handler and the BullMQ Worker currently run in the **EXACT SAME Node.js process** within the **EXACT SAME container/instance**.
   - There is no separate worker process, container, or external consumer deployed.
2. **Shared Volume across Containers:**
   - Because API and Worker share a single container and process, they share the exact same local filesystem.
3. **Multi-Instance / Cross-Machine Failure Mode:**
   - **Hypothetical Scenario:** If the API service is horizontally scaled across multiple instances (e.g. 2 replicas on Render or Kubernetes) where each replica runs `server.js` connecting to a single shared Redis:
     - Machine A receives the multipart upload and writes the staged image to Machine A's local ephemeral disk (`storage/staging/...`).
     - Machine A pushes the job to BullMQ/Redis referencing Machine A's local path (`stagingPath`).
     - If Machine B's worker pulls the job from Redis, Machine B attempts to read `stagingPath` from Machine B's filesystem, where the file **does not exist**.
   - **Classification:** Under a multi-instance topology without a shared network volume, this would produce a:
     ```text
     CONFIRMED DISTRIBUTED-STORAGE BUG
     ```
   - **Current Operational Reality:** In the current Docker Compose and single-service deployment setup, both components run co-located within the single process, guaranteeing shared filesystem access.

---

## 2. Shared-Filesystem Requirement

To ensure deployment operators do not scale instances blindly without appropriate storage infrastructure, the following architectural constraint is formally established:

> **ARCHITECTURAL LIMITATION:**  
> **Bulk grading currently requires API and Worker to share filesystem.**

### Path Forward for Horizontal Scaling:
Before decoupling workers into separate containers or scaling the API horizontally, the queue payload must transition from local filesystem paths to a distributed storage reference accessible by all nodes:
1. **Option A (Shared Volume):** Mount a shared network filesystem (such as AWS EFS, Google Cloud Filestore, Azure Files, or NFS) at `SUBMISSION_STORAGE_DIR` across all API and Worker containers.
2. **Option B (Object Storage Staging):** Multer streams uploads directly to an object storage staging bucket/folder (e.g. Cloudinary staging folder or AWS S3 bucket), and the BullMQ job passes the object storage key.
*(Note: Base64 will NOT be reintroduced, as that would revive the memory exhaustion issue resolved in Phase 2).*

---

## 3. Stale Staging Cleaner Verification

### Investigation Findings:
- In `REMEDIATION_PHASE2.md`, Section 4.3 claimed that orphaned staged files are reclaimed on startup or by a scheduled cleaner, while Section 14 stated this remained a residual risk needing implementation.
- Codebase inspection revealed that `cleanupStagedBatch(batchId)` and `cleanupStagedFile(storageKey)` were implemented and invoked on upload errors, enqueue failures, and job completions. However, **no startup scan or cron cleaner existed** to reclaim stale directories in `storage/staging/` if a hard server crash occurred mid-processing.
- **Classification:**
  ```text
  DOCUMENTATION OVERCLAIM
  ```

### Minimal Safe Implementation Applied:
Implemented `cleanupStaleStaging(maxAgeMs)` in `apps/api/src/services/storage/storage.service.js` with strict safety invariants:
1. **Boundary Confinement:** Path resolution strictly verifies that target directories reside directly beneath `<storageRoot>/staging`. Traversals (`..`, `/`, `\`) are strictly blocked.
2. **Symlink Protection:** Uses `fs.lstat` to identify and ignore symbolic links, preventing deletion outside the storage directory.
3. **TTL Enforcement:** Only entries whose modification time (`mtime`) is older than `maxAgeMs` (default: 24 hours) are deleted.
4. **Resilience & Startup Safety:** Wrapped in `try/catch`. Errors are logged via `console.warn` and **never thrown**, ensuring API bootstrap will never fail due to cleanup errors.
5. **Audit Logging:** Logs the number of cleaned stale resources.
6. **Registration:** Registered as a safe, non-blocking startup routine in `apps/api/src/server.js`.

---

## 4. PNG Validation Semantics

### Investigation Findings:
- Inspection of `apps/api/src/utils/image-validation.js` revealed that PNG validation previously checked only the 8-byte signature (`89 50 4E 47 0D 0A 1A 0A`) and `buffer.length < 24`.
- It did **not** verify chunk structure or decode raster pixels. Consequently, a file consisting of the 8-byte PNG signature followed by random bytes was accepted.
- Describing this as *"Only genuine PNG images are accepted"* was technically inaccurate.

### Resolution Applied (Option A + Option B):
1. **Structural Chunk Framing Validation:**
   - Enhanced `validateImageBuffer` and `validateImageFile` to enforce PNG specification structure:
     - Minimum length $\ge 45$ bytes (8-byte signature + 25-byte IHDR chunk + 12-byte IEND chunk).
     - First chunk header at offset 12 must strictly match ASCII `IHDR` (`0x49 0x48 0x44 0x52`).
     - Terminal slice must contain the `IEND` chunk marker (`0x49 0x45 0x4E 0x44`).
   - Files with signature-only, truncated payloads, missing IHDR, or missing IEND are cleanly rejected with HTTP 400.
2. **Corrected Semantics:**
   - The validation mechanism is formally defined as:
     ```text
     format-signature and structural chunk framing validation
     ```
   - Deep raster pixel decoding and image decompression are intentionally deferred to the computer vision pipeline (`apps/ai-service` via OpenCV/Pillow), avoiding heavy Node.js dependencies while maintaining security against malformed files.

---

## 5. Cloudinary Deletion Scope

### Investigation Findings:
- In `apps/api/src/services/storage/storage.service.js`, `cleanupSubmissionStorage` called:
  ```javascript
  await deletePrefixFromCloudinary(`digitalexam/submissions/${namespace}`);
  ```
- In Cloudinary, `delete_resources_by_prefix` performs a raw substring prefix match. If submission X had namespace `sub-1` and submission Y had namespace `sub-10`, a prefix of `digitalexam/submissions/sub-1` could match and delete resources belonging to `sub-10`.

### Resolution Applied:
1. **Strict Folder Boundary with Trailing Slash:**
   - In `cloudinary-storage.service.js`, `deletePrefixFromCloudinary(prefix)` enforces that all prefixes end with a trailing slash (`/`):
     ```javascript
     const safePrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
     await cloudinary.api.delete_resources_by_prefix(safePrefix);
     ```
   - `digitalexam/submissions/sub-1/` matches `digitalexam/submissions/sub-1/original_sub-1`, but can **never** match `digitalexam/submissions/sub-10/original_sub-10`.
2. **Direct PublicId Targeting:**
   - `cleanupSubmissionStorage` directly invokes `deleteFromCloudinary(cloudinaryPublicId, { resourceType: "image" })` for the exact uploaded asset.
3. **Idempotency Guarantee:**
   - Both `deleteFromCloudinary` and `deletePrefixFromCloudinary` catch errors and non-existent resource responses (`not found`), logging notices without re-throwing or masking primary database errors.

---

## 6. Working-Tree Attribution

The working tree contains files modified across different phases. Their exact provenance is clarified below:

| File | Originating Pass | Purpose & Rationale |
|---|---|---|
| `apps/web/src/pages/TeacherStatisticsPage.jsx` | **User WIP** | User added `+ Plus` import. **100% untouched by agent.** |
| `apps/api/scripts/start-prod.js` | **Pre-Phase 1 Hotfix** | Added `cleanupOrphanedStudents()` per user prompt (removing 347 unassigned ghost students). |
| `apps/api/src/services/admin-dashboard.service.js` | **Pre-Phase 1 Hotfix** | Added `{ enrollments: { some: {} } }` filter for student count accuracy. |
| `apps/api/src/middlewares/class-access.middleware.js` | **Phase 1** | BOLA/IDOR authorization guard (`requireClassStudentAccess`). |
| `apps/api/src/routes/class.routes.js` | **Phase 1** | Applied access middleware to `GET /classes/:classId/students`. |
| `apps/api/src/services/student-enrollment.service.js` | **Phase 1** | Removed `initialPassword` from class student responses. |
| `apps/api/src/services/submission-review.service.js` | **Phase 1** | Removed heuristic auto-linking in review workflow. |
| `apps/api/src/services/student-result.service.js` | **Phase 1** | Fail-closed on candidate duplicate results. |
| `apps/api/tests/class-management.test.js` | **Phase 1** | Asserted `initialPassword === undefined`. |
| `apps/api/src/services/submission.service.js` | **Phase 1.1** | Fail-closed confidence checks & `pg_advisory_xact_lock` against TOCTOU race conditions. |
| `apps/ai-service/app/omr/bubble_reader.py` | **Phase 2** | OMR ambiguous bubble boundary fix (`0.34/0.33` $\rightarrow$ `MULTIPLE`). |
| `apps/ai-service/tests/test_bubble_calibration.py` | **Phase 2** | 12 boundary matrix test cases. |
| `apps/api/src/config/batch-upload.config.js` | **Phase 2** | Batch limits (50 files, 15MB/file, 150MB total). |
| `apps/api/src/config/redis.config.js` | **Phase 2** | Redis active readiness probe `checkRedisHealth()`. |
| `apps/api/src/queue/grading.queue.js` | **Phase 2** | Fail-fast 503 `GRADING_QUEUE_UNAVAILABLE`, storage references only. |
| `apps/api/src/queue/grading.worker.js` | **Phase 2** | Worker reads storage reference, unlinks files in `finally`. |
| `apps/api/src/routes/grading.routes.js` | **Phase 2** | Multer diskStorage streaming, pre-upload Redis check. |
| `apps/api/src/controllers/submission.controller.js` | **Phase 2** | Enforces aggregate byte limit and validates magic bytes on staged files. |
| `apps/api/package.json` | **Phase 2** | Registered `remediation-phase2.test.js` in test script. |
| `apps/api/src/utils/image-validation.js` | **Phase 2 & 2.1** | Added structural PNG chunk validation (IHDR/IEND). |
| `apps/api/src/services/storage/cloudinary-storage.service.js` | **Phase 2 & 2.1** | Enforced folder trailing slash in `deletePrefixFromCloudinary`. |
| `apps/api/src/services/storage/storage.service.js` | **Phase 2 & 2.1** | Added `cleanupStaleStaging()` and folder trailing slash. |
| `apps/api/src/server.js` | **Phase 2.1** | Registered startup safe call to `cleanupStaleStaging()`. |
| `apps/api/tests/remediation-phase2.test.js` | **Phase 2 & 2.1** | 22 comprehensive tests (15 Phase 2 + 7 Phase 2.1). |

---

## 7. Code Changes Summary

1. [apps/api/src/utils/image-validation.js](file:///d:/Learning_AI/DigitalExamGrading/apps/api/src/utils/image-validation.js):
   - Added minimum PNG length check ($\ge 45$ bytes).
   - Added mandatory `IHDR` chunk check at bytes 12-15.
   - Added `IEND` chunk marker check in the tail slice.
   - Updated both in-memory `validateImageBuffer` and streamed `validateImageFile`.
2. [apps/api/src/services/storage/storage.service.js](file:///d:/Learning_AI/DigitalExamGrading/apps/api/src/services/storage/storage.service.js):
   - Implemented `cleanupStaleStaging(maxAgeMs)` with boundary and symlink safety checks.
   - Appended trailing slash to Cloudinary folder prefix in `cleanupSubmissionStorage`.
3. [apps/api/src/services/storage/cloudinary-storage.service.js](file:///d:/Learning_AI/DigitalExamGrading/apps/api/src/services/storage/cloudinary-storage.service.js):
   - Guaranteed trailing slash on `prefix` passed to `delete_resources_by_prefix`.
4. [apps/api/src/server.js](file:///d:/Learning_AI/DigitalExamGrading/apps/api/src/server.js):
   - Registered `cleanupStaleStaging(24 * 60 * 60 * 1000)` on server listen inside non-blocking `try/catch`.

---

## 8. Tests Added

7 new regression tests added to [apps/api/tests/remediation-phase2.test.js](file:///d:/Learning_AI/DigitalExamGrading/apps/api/tests/remediation-phase2.test.js):
1. `F005.4b — PNG signature only (< 45 bytes) rejected by validator`
2. `F005.4c — PNG signature + random payload (missing IHDR) rejected by validator`
3. `F005.4d — PNG missing IEND chunk rejected by validator`
4. `F005.4e — validateImageFile rejects malformed PNG on disk`
5. `F005.8 — cleanupStaleStaging safely cleans expired items without traversing outside root`
6. `F009.4 — Cloudinary delete scope: cleanup of submission X strictly scopes to X and cannot delete submission Y`
7. `F009.5 — Cloudinary cleanup is idempotent when resource is already missing`

---

## 9. Test Results

### Node.js Backend API Suite (`npm --prefix apps/api test`):
```text
==================================================
Test DB selected: exam_grading_test
Normal dev DB:   NOT USED
Test Storage:    ./storage-test
==================================================

ℹ tests 209
ℹ suites 7
ℹ pass 209
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 166827.6749
```
- **Total Backend Tests:** **209 / 209 PASS (100%)**
- **Failures:** 0
- **Skipped:** 0

### Python OMR Suite (`docker exec digital_exam_ai python -m pytest`):
```text
======================== 55 passed, 2 warnings in 7.17s ========================
```
- **Total Python Tests:** **55 / 55 PASS (100%)**
- **Failures:** 0

---

## 10. Residual Production Limitations

1. **Shared Filesystem Requirement for Batch Grading:**
   - Deployers must run the API server and BullMQ worker on a shared filesystem (or single container/instance as currently configured).
   - Horizontal autoscaling to multiple independent containers without shared storage remains unsupported until object storage staging or shared network volumes are introduced.
2. **In-Flight Crash Staging Reclamation:**
   - Staging files orphaned by an abrupt hard kill (`SIGKILL` / kernel OOM) during job execution will remain on disk until the next server restart triggers `cleanupStaleStaging()`. Deploying an external daily cron job or recurring scheduler is recommended for deployments with high uptime and frequent abrupt restarts.
3. **Database Schema Plaintext Password:**
   - As documented in Phase 1.1, `Student.initialPassword` remains in the PostgreSQL schema pending the approved One-Time Activation Token migration in Phase 3.

---

### Final Working Tree Confirmation:
**No apps/web files were modified.**
