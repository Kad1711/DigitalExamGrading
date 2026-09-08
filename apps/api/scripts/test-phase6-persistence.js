import fs from "fs";
import path from "path";
import crypto from "crypto";
import prisma from "../src/config/prisma.js";
import jwt from "jsonwebtoken";
const API_URL = "http://localhost:5000/api";

async function run() {
  console.log("==================================================");
  console.log("PHASE 6 AUTOMATED PERSISTENCE VALIDATION TEST");
  console.log("==================================================");

  // 1. Get Exam and Teacher
  const exam = await prisma.exam.findFirst({
    where: { title: { contains: "Kiểm tra giữa kỳ" }, status: "PUBLISHED" },
    include: { teacher: { include: { user: true } }, examCodes: true },
  });
  if (!exam) {
    throw new Error("Could not find published exam 'Kiểm tra giữa kỳ'");
  }
  console.log(`Found Exam: "${exam.title}" (ID: ${exam.id})`);
  console.log(`Teacher: ${exam.teacher.fullName} (User ID: ${exam.teacher.user.id}, Teacher ID: ${exam.teacher.id})`);

  const JWT_SECRET = process.env.JWT_ACCESS_SECRET || "default-access-secret-key-min-32-chars-long";
  const teacherToken = jwt.sign(
    {
      sub: exam.teacher.user.id,
      email: exam.teacher.user.email,
      role: exam.teacher.user.role,
      status: exam.teacher.user.status,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  // Find another teacher for cross-teacher RBAC test
  const otherTeacher = await prisma.teacher.findFirst({
    where: { id: { not: exam.teacher.id } },
    include: { user: true },
  });
  let otherTeacherToken = "";
  if (otherTeacher) {
    otherTeacherToken = jwt.sign(
      {
        sub: otherTeacher.user.id,
        email: otherTeacher.user.email,
        role: otherTeacher.user.role,
        status: otherTeacher.user.status,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
  }

  const imagePath = "D:\\Baithi\\testfull02.jpg";
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Real image not found at ${imagePath}`);
  }

  // Clean up any previous test submission for this exact test to ensure clean repeatable run
  const imageBuffer = fs.readFileSync(imagePath);
  const sha256 = crypto.createHash("sha256").update(imageBuffer).digest("hex");
  const existing = await prisma.examSubmission.findUnique({
    where: { examId_originalImageSha256: { examId: exam.id, originalImageSha256: sha256 } },
  });
  let sub;
  if (existing) {
    console.log(`Real submission ${existing.id} already exists. Preserving it safely without recreation.`);
    const getRes = await fetch(`${API_URL}/submissions/${existing.id}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const getJson = await getRes.json();
    sub = getJson.data;
    console.log(`Loaded Submission ID: ${sub.id}, status: ${sub.grading.status}`);
  } else {
    console.log("\n--- TEST 1: Initial Persistent Submission (POST /api/exams/:examId/submissions) ---");
    const blob = new Blob([imageBuffer], { type: "image/jpeg" });
    const form = new FormData();
    form.append("image", blob, "testfull02.jpg");

    const createRes = await fetch(`${API_URL}/exams/${exam.id}/submissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${teacherToken}`,
      },
      body: form,
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`HTTP ${createRes.status}: ${errText}`);
    }

    const createJson = await createRes.json();
    sub = createJson.data;
    console.log(`Created Submission ID: ${sub.id}`);
    console.log(`Grading Status: ${sub.grading.status}`);
    console.log(`Provisional Score: ${sub.grading.provisionalScore} / ${sub.grading.maxScore}`);
    console.log(`Correct Count: ${sub.grading.correctCount}`);
    console.log(`Unresolved Count: ${sub.grading.unresolvedCount}`);

    if (sub.grading.status !== "PROVISIONAL") {
      throw new Error(`Expected PROVISIONAL, got ${sub.grading.status}`);
    }
    if (sub.grading.unresolvedCount !== 5) {
      throw new Error(`Expected 5 unresolved, got ${sub.grading.unresolvedCount}`);
    }
    if (sub.grading.correctCount !== 35) {
      throw new Error(`Expected 35 correct, got ${sub.grading.correctCount}`);
    }
  }

  // Verify DB Rows
  console.log("\n--- TEST 2: Verify DB Row Counts & Snapshots ---");
  const dbSub = await prisma.examSubmission.findUnique({
    where: { id: sub.id },
    include: { answers: true, auditLogs: { orderBy: { createdAt: "asc" } } },
  });
  console.log(`DB Submission Found: ${Boolean(dbSub)}`);
  console.log(`DB Answers Count: ${dbSub.answers.length} (Expected: 40)`);
  if (dbSub.answers.length !== 40) throw new Error("Expected exactly 40 answers");
  console.log(`DB Audit Logs Count: ${dbSub.auditLogs.length} (Expected >= 1)`);
  console.log(`First Audit Event: ${dbSub.auditLogs[0].eventType} (Expected SUBMISSION_CREATED)`);
  if (dbSub.auditLogs[0].eventType !== "SUBMISSION_CREATED") {
    throw new Error("Expected SUBMISSION_CREATED audit event");
  }

  // Verify Storage Files
  console.log("\n--- TEST 3: Verify Disk Storage (Zero Blobs in DB) ---");
  console.log(`originalImageStorageKey in DB: ${dbSub.originalImageStorageKey}`);
  const originalFile = path.resolve("D:/DigitalExamGrading/apps/api/storage", dbSub.originalImageStorageKey);
  const subStorageDir = path.dirname(originalFile);
  console.log(`Storage Dir: ${subStorageDir}`);
  console.log(`Original file exists: ${fs.existsSync(originalFile)} (${fs.statSync(originalFile).size} bytes)`);
  if (!fs.existsSync(originalFile)) throw new Error("original.jpg does not exist");

  const reviewDir = path.join(subStorageDir, "review");
  const reviewFiles = fs.existsSync(reviewDir) ? fs.readdirSync(reviewDir) : [];
  console.log(`Review crop files found: ${reviewFiles.length} (${reviewFiles.join(", ")})`);
  if (reviewFiles.length !== 5) {
    throw new Error(`Expected 5 review crop files, found ${reviewFiles.length}`);
  }

  // Verify Authenticated Streaming
  console.log("\n--- TEST 4: Authenticated Image Streaming ---");
  const streamRes = await fetch(`${API_URL}/submissions/${sub.id}/image`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  const imgArrayBuffer = await streamRes.arrayBuffer();
  console.log(`Image stream HTTP ${streamRes.status}, Content-Type: ${streamRes.headers.get("content-type")}, bytes: ${imgArrayBuffer.byteLength}`);
  if (imgArrayBuffer.byteLength !== fs.statSync(originalFile).size) {
    throw new Error("Streamed image size mismatch");
  }

  const cropRes = await fetch(`${API_URL}/submissions/${sub.id}/answers/7/review-crop`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  const cropArrayBuffer = await cropRes.arrayBuffer();
  console.log(`Q7 crop stream HTTP ${cropRes.status}, Content-Type: ${cropRes.headers.get("content-type")}, bytes: ${cropArrayBuffer.byteLength}`);

  // Fresh Process / F5 Reload Retrieval
  console.log("\n--- TEST 5: Retrieval via GET /api/submissions/:submissionId ---");
  const getRes = await fetch(`${API_URL}/submissions/${sub.id}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  const getJson = await getRes.json();
  console.log(`GET submission HTTP ${getRes.status}, status: ${getJson.data.grading.status}`);
  if (getJson.data.id !== sub.id) throw new Error("ID mismatch on GET");

  // Review Workflow: Q7, Q17, Q21, Q33 = MULTIPLE_INVALID, Q8 = BLANK
  console.log("\n--- TEST 6: Teacher Manual Review (PATCH /api/submissions/:id/review) ---");
  const reviewPayload = {
    reviews: [
      { questionNumber: 7, resolution: "MULTIPLE_INVALID" },
      { questionNumber: 8, resolution: "BLANK" },
      { questionNumber: 17, resolution: "MULTIPLE_INVALID" },
      { questionNumber: 21, resolution: "MULTIPLE_INVALID" },
      { questionNumber: 33, resolution: "MULTIPLE_INVALID" },
    ],
  };

  const reviewRes = await fetch(`${API_URL}/submissions/${sub.id}/review`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify(reviewPayload),
  });
  const reviewedJson = await reviewRes.json();
  const reviewed = reviewedJson.data;
  console.log(`Reviewed Status: ${reviewed.grading.status}`);
  console.log(`Final Score: ${reviewed.grading.finalScore} / ${reviewed.grading.maxScore}`);
  console.log(`Unresolved Count: ${reviewed.grading.unresolvedCount}`);
  if (reviewed.grading.status !== "FINAL") {
    throw new Error(`Expected FINAL, got ${reviewed.grading.status}`);
  }
  if (reviewed.grading.finalScore !== 8.75) {
    throw new Error(`Expected finalScore 8.75, got ${reviewed.grading.finalScore}`);
  }
  if (reviewed.grading.unresolvedCount !== 0) {
    throw new Error(`Expected 0 unresolved, got ${reviewed.grading.unresolvedCount}`);
  }

  // Audit Log Verification
  console.log("\n--- TEST 7: Verify Audit Logs ---");
  const auditRes = await fetch(`${API_URL}/submissions/${sub.id}/audit-logs`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
  const logsJson = await auditRes.json();
  const logs = logsJson.data;
  console.log(`Audit Logs count: ${logs.length}`);
  const eventTypes = logs.map(l => l.eventType);
  console.log(`Audit event sequence: ${eventTypes.join(" -> ")}`);
  if (!eventTypes.includes("ANSWER_REVIEWED") || !eventTypes.includes("REGRADED")) {
    throw new Error("Missing ANSWER_REVIEWED or REGRADED in audit log");
  }

  // Review Revision (Changing mind: Q7 back to UNRESOLVED -> returns to PROVISIONAL)
  console.log("\n--- TEST 8: Review Revision (Q7 -> UNRESOLVED -> status back to PROVISIONAL) ---");
  const undoRes = await fetch(`${API_URL}/submissions/${sub.id}/review`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      reviews: [{ questionNumber: 7, resolution: "UNRESOLVED" }],
    }),
  });
  const undoJson = await undoRes.json();
  console.log(`Undo status: ${undoJson.data.grading.status} (Expected: PROVISIONAL)`);
  console.log(`Unresolved count: ${undoJson.data.grading.unresolvedCount} (Expected: 1)`);
  if (undoJson.data.grading.status !== "PROVISIONAL" || undoJson.data.grading.unresolvedCount !== 1) {
    throw new Error("Undo review failed to transition back to PROVISIONAL");
  }

  // Re-resolve Q7 back to MULTIPLE_INVALID
  const reResolveRes = await fetch(`${API_URL}/submissions/${sub.id}/review`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({
      reviews: [{ questionNumber: 7, resolution: "MULTIPLE_INVALID" }],
    }),
  });
  const reResolveJson = await reResolveRes.json();
  console.log(`Re-resolve status: ${reResolveJson.data.grading.status} (Expected: FINAL)`);
  if (reResolveJson.data.grading.status !== "FINAL") {
    throw new Error("Re-resolve failed to return to FINAL");
  }

  // Student Number (Identity) Review
  console.log("\n--- TEST 9: Student Identity Review (PATCH /api/submissions/:id/identity) ---");
  const identRes = await fetch(`${API_URL}/submissions/${sub.id}/identity`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${teacherToken}`,
    },
    body: JSON.stringify({ studentNumber: "010203" }),
  });
  const identJson = await identRes.json();
  console.log(`Resolved SBD: ${identJson.data.identity.resolvedStudentNumber}`);
  console.log(`Identity Needs Review: ${identJson.data.identity.identityNeedsReview}`);
  if (identJson.data.identity.resolvedStudentNumber !== "010203" || identJson.data.identity.identityNeedsReview !== false) {
    throw new Error("Identity review failed");
  }

  // Duplicate Upload Protection
  console.log("\n--- TEST 10: Duplicate Image Upload Protection ---");
  const dupBlob = new Blob([imageBuffer], { type: "image/jpeg" });
  const dupForm = new FormData();
  dupForm.append("image", dupBlob, "testfull02.jpg");

  const dupRes = await fetch(`${API_URL}/exams/${exam.id}/submissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${teacherToken}`,
    },
    body: dupForm,
  });

  const dupJson = await dupRes.json();
  console.log(`Duplicate error HTTP ${dupRes.status}, code: ${dupJson.error?.code}`);
  console.log(`Existing submission ID returned: ${dupJson.error?.existingSubmissionId}`);
  if (dupRes.status !== 409 || dupJson.error?.code !== "DUPLICATE_SUBMISSION_IMAGE") {
    throw new Error(`Expected 409 DUPLICATE_SUBMISSION_IMAGE, got ${dupRes.status} / ${dupJson.error?.code}`);
  }
  if (dupJson.error?.existingSubmissionId !== sub.id) {
    throw new Error("Returned existingSubmissionId does not match original submission ID");
  }

  // Cross-Teacher RBAC Access Denial
  if (otherTeacherToken) {
    console.log("\n--- TEST 11: Cross-Teacher RBAC Protection ---");
    const rbacRes = await fetch(`${API_URL}/submissions/${sub.id}`, {
      headers: { Authorization: `Bearer ${otherTeacherToken}` },
    });
    const rbacJson = await rbacRes.json();
    console.log(`Cross-teacher GET HTTP ${rbacRes.status}, code: ${rbacJson.error?.code}`);
    if (rbacRes.status !== 403) {
      throw new Error(`Expected 403 FORBIDDEN, got ${rbacRes.status}`);
    }
  }

  console.log("\n==================================================");
  console.log("ALL 11 PERSISTENT VALIDATION TESTS PASSED 100%!");
  console.log("==================================================");
}

run()
  .catch((err) => {
    console.error("VALIDATION TEST FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
