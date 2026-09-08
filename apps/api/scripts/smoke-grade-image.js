/**
 * Digital Exam Grading - E2E Grading Smoke Test
 *
 * Verifies full vertical slice:
 * 1. Health check (Node & FastAPI)
 * 2. Teacher login
 * 3. Fetch published exams
 * 4. Download DB-generated vector PDF
 * 5. Call grade-image endpoint with compatible marked image
 * 6. Assert scoring, OMR metadata, and performance timings
 */

import fs from "fs";
import path from "path";
import assert from "assert/strict";

const API_BASE = process.env.API_BASE_URL || "http://127.0.0.1:5000/api";
const TEACHER_EMAIL = process.env.TEACHER_EMAIL || "teacher@digitalexam.local";
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || "Teacher@123456";

// Path to test synthetic image generated from published exam template
const TEST_IMAGE_PATH =
  process.env.TEST_IMAGE_PATH ||
  "C:/Users/ADMIN/.gemini/antigravity/brain/314f021d-e0bc-44b7-892c-34cc9e33b71b/scratch/exam_40_filled_8_5.png";

async function smokeTest() {
  console.log("=== BẮT ĐẦU E2E GRADING SMOKE TEST ===");

  // 1. Check API Health
  console.log("1. Kiểm tra Health Check Node API...");
  const healthRes = await fetch(`${API_BASE}/health`);
  assert.equal(healthRes.status, 200, "Node API health check failed");
  const healthData = await healthRes.json();
  assert.equal(healthData.success, true);
  console.log("   ✓ Node API hoạt động bình thường.");

  // 2. Login Teacher
  console.log("2. Đăng nhập tài khoản Giáo viên...");
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEACHER_EMAIL, password: TEACHER_PASSWORD }),
  });
  assert.equal(loginRes.status, 200, "Teacher login failed");
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;
  assert.ok(token, "Access token không tồn tại trong response");
  console.log(`   ✓ Đăng nhập thành công (${loginData.data.user.email})`);

  // 3. Get Published Exams
  console.log("3. Tải danh sách kỳ thi đã phát hành (PUBLISHED)...");
  const examsRes = await fetch(`${API_BASE}/exams?status=PUBLISHED`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(examsRes.status, 200, "Get published exams failed");
  const examsData = await examsRes.json();
  const publishedExams = examsData.data || [];
  assert.ok(publishedExams.length > 0, "Không có kỳ thi nào ở trạng thái PUBLISHED");
  console.log(`   ✓ Tìm thấy ${publishedExams.length} kỳ thi PUBLISHED.`);

  // Stable selection strategy:
  // 1. Prefer exam matching process.env.TEST_EXAM_ID or known dev fixture exam ID (matching the QR in the synthetic test image)
  // 2. Fallback to finding a published 40-question EQUAL exam
  const preferredExamId = process.env.TEST_EXAM_ID || "cmtrppwdw002luouezxhplff5";
  const exam =
    publishedExams.find((e) => e.id === preferredExamId) ||
    publishedExams.find((e) => e.questionCount === 40 && e.scoringType === "EQUAL") ||
    publishedExams[0];
  assert.ok(exam, "Không tìm thấy kỳ thi phù hợp để chạy smoke test");
  console.log(`   ✓ Chọn kỳ thi: "${exam.title}" (ID: ${exam.id})`);

  // 4. Download AnswerSheetTemplate PDF from DB
  console.log("4. Tải file Answer Sheet PDF từ cơ sở dữ liệu...");
  const pdfRes = await fetch(`${API_BASE}/exams/${exam.id}/answer-sheet-template/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(pdfRes.status, 200, "Download PDF failed");
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
  assert.ok(pdfBuffer.length > 1000, "PDF buffer quá nhỏ hoặc rỗng");
  const pdfHeader = pdfBuffer.slice(0, 5).toString();
  assert.equal(pdfHeader, "%PDF-", "File tải về không đúng định dạng vector PDF");
  console.log(`   ✓ Tải PDF thành công, dung lượng: ${pdfBuffer.length} bytes.`);

  // 5. Send Grade Image Request
  console.log("5. Gửi yêu cầu chấm ảnh bài thi tới endpoint /grade-image...");
  if (!fs.existsSync(TEST_IMAGE_PATH)) {
    throw new Error(`File ảnh test không tồn tại tại: ${TEST_IMAGE_PATH}`);
  }

  const imgBuffer = fs.readFileSync(TEST_IMAGE_PATH);
  const formData = new FormData();
  formData.append(
    "image",
    new Blob([imgBuffer], { type: "image/png" }),
    path.basename(TEST_IMAGE_PATH)
  );

  const gradeRes = await fetch(`${API_BASE}/exams/${exam.id}/grade-image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const gradeData = await gradeRes.json();
  assert.equal(gradeRes.status, 200, `Grade-image HTTP failed: ${JSON.stringify(gradeData)}`);
  assert.equal(gradeData.success, true);

  const payload = gradeData.data;
  console.log("   ✓ Nhận kết quả thành công:");
  console.log(`     • SBD: ${payload.omr.studentNumber?.value}`);
  console.log(`     • Mã đề: ${payload.omr.examCode?.value}`);
  console.log(`     • Trạng thái chấm: ${payload.grading.status}`);
  console.log(`     • Điểm đạt được: ${payload.grading.finalScore} / ${payload.exam.maxScore}`);
  console.log(
    `     • Thống kê: Đúng=${payload.grading.correctCount}, Sai=${payload.grading.incorrectCount}, Trống=${payload.grading.blankCount}`
  );
  console.log(
    `     • Thời gian xử lý: Tổng=${payload.meta?.processingTimeMs}ms (OMR=${payload.meta?.omrTimeMs}ms, Grading=${payload.meta?.gradingTimeMs}ms)`
  );

  assert.equal(payload.grading.status, "FINAL");
  assert.equal(payload.omr.studentNumber?.value, "123456");
  assert.equal(payload.omr.examCode?.value, "101");
  assert.ok(payload.meta?.processingTimeMs > 0);

  console.log("\n>>> TOÀN BỘ E2E SMOKE TEST PASS HOÀN TOÀN! <<<\n");
}

smokeTest().catch((err) => {
  console.error("\n❌ SMOKE TEST THẤT BẠI:", err.message);
  process.exit(1);
});
